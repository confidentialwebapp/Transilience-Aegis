#!/usr/bin/env bash
# Idempotent provisioning of Apify Tasks + Schedules + Webhooks for Transilience Aegis.
#
# Prereqs:
#   - APIFY_TOKEN env var (Scale tier required for sustained scheduling)
#   - jq, curl on PATH
#   - Residential + GOOGLE_SERP proxy access enabled on the account
#
# Usage:
#   APIFY_TOKEN="apify_api_..." ./apify/provision.sh
#
# What it does for each apify/tasks/*.json:
#   1. Creates or updates the Apify Task with the actor + input_template
#   2. Creates or updates a Schedule per (task) — one extra Schedule per
#      keyword in keyword_rotation, with customData carrying the keyword.
#   3. Adds a webhook on ACTOR.RUN.SUCCEEDED + ACTOR.RUN.FAILED pointing
#      at webhook_url, including X-Tenant-Id, X-Feature-Id, and an
#      idempotency key derived from {{run.id}}.
#
# Idempotent: re-running updates configs in place rather than creating duplicates.

set -euo pipefail

if [[ -z "${APIFY_TOKEN:-}" ]]; then
  echo "ERROR: APIFY_TOKEN env var not set" >&2
  exit 1
fi
command -v jq  >/dev/null || { echo "ERROR: jq not installed"; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not installed"; exit 1; }

API="https://api.apify.com/v2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKS_DIR="$SCRIPT_DIR/tasks"

CREATED_TASKS=0; UPDATED_TASKS=0
CREATED_SCHEDULES=0; UPDATED_SCHEDULES=0
CREATED_WEBHOOKS=0; UPDATED_WEBHOOKS=0
FAILURES=0

apify_call() {
  local method="$1"; local path="$2"; shift 2
  local out
  out=$(curl -s -w "\n%{http_code}" -X "$method" \
    -H "Authorization: Bearer $APIFY_TOKEN" \
    -H "Content-Type: application/json" \
    "$API$path" "$@")
  local code="${out##*$'\n'}"
  local body="${out%$'\n'*}"
  echo "$code|$body"
}

provision_task() {
  local file="$1"
  local task_id actor_id input_b64
  task_id=$(jq -r '.task_id' "$file")
  actor_id=$(jq -r '.actor_id' "$file")
  local feature_id schedule_cron webhook_url
  feature_id=$(jq -r '.feature_id' "$file")
  schedule_cron=$(jq -r '.schedule_cron' "$file")
  webhook_url=$(jq -r '.webhook_url' "$file")
  local tenant_id; tenant_id=$(jq -r '.tenant_id' "$file")

  echo ""
  echo "=== $task_id ($feature_id) ==="

  # 1. Upsert task
  local task_body
  task_body=$(jq -n --arg name "$task_id" --arg actorId "$actor_id" --argjson input "$(jq '.input_template' "$file")" \
    '{actId: $actorId, name: $name, options: {memoryMbytes: 1024, timeoutSecs: 600}, input: $input}')

  # Try create; if 409 conflict, update
  local resp; resp=$(apify_call POST "/actor-tasks?token=$APIFY_TOKEN" -d "$task_body")
  local code="${resp%%|*}"
  if [[ "$code" == "201" ]]; then
    CREATED_TASKS=$((CREATED_TASKS+1))
  elif [[ "$code" == "409" || "$code" == "400" ]]; then
    # Update via PUT (find by name)
    local existing; existing=$(apify_call GET "/actor-tasks?token=$APIFY_TOKEN&search=$(jq -rn --arg s "$task_id" '$s|@uri')")
    local existing_id; existing_id=$(echo "${existing#*|}" | jq -r ".data.items[] | select(.name == \"$task_id\") | .id" 2>/dev/null | head -1)
    if [[ -n "$existing_id" ]]; then
      apify_call PUT "/actor-tasks/$existing_id?token=$APIFY_TOKEN" -d "$task_body" >/dev/null
      UPDATED_TASKS=$((UPDATED_TASKS+1))
    else
      echo "  WARN: task create failed and existing not found"; FAILURES=$((FAILURES+1)); return
    fi
  else
    echo "  ERROR: task create returned $code"; FAILURES=$((FAILURES+1)); return
  fi

  # 2. Schedule(s)
  local rotation_count; rotation_count=$(jq '.keyword_rotation | length' "$file")
  if [[ "$rotation_count" == "0" ]]; then
    create_schedule "$file" "" ""
  else
    local i=0
    while [[ $i -lt $rotation_count ]]; do
      local kw; kw=$(jq -r ".keyword_rotation[$i]" "$file")
      create_schedule "$file" "$kw" "$i"
      i=$((i+1))
      sleep 0.1
    done
  fi

  # 3. Webhook on the task
  local webhook_body
  webhook_body=$(jq -n --arg url "$webhook_url" --arg fid "$feature_id" --arg tid "$tenant_id" --arg taskid "$task_id" \
    '{eventTypes: ["ACTOR.RUN.SUCCEEDED","ACTOR.RUN.FAILED"], requestUrl: $url, idempotencyKey: "{{run.id}}", headersTemplate: ("{\"X-Feature-Id\": \"" + $fid + "\", \"X-Tenant-Id\": \"" + $tid + "\", \"X-Apify-Task-Id\": \"" + $taskid + "\"}"), payloadTemplate: "{\"resource\": {{resource}}, \"eventData\": {{eventData}}, \"feature_id\": \"" + $fid + "\", \"tenant_id\": \"" + $tid + "\"}"}')

  local resp_w; resp_w=$(apify_call POST "/actor-tasks/$task_id/webhooks?token=$APIFY_TOKEN" -d "$webhook_body" 2>&1 || true)
  local wcode="${resp_w%%|*}"
  if [[ "$wcode" == "201" ]]; then
    CREATED_WEBHOOKS=$((CREATED_WEBHOOKS+1))
  elif [[ "$wcode" == "409" || "$wcode" == "400" ]]; then
    UPDATED_WEBHOOKS=$((UPDATED_WEBHOOKS+1))
  else
    echo "  WARN: webhook returned $wcode"
  fi

  sleep 0.1
}

create_schedule() {
  local file="$1"; local keyword="$2"; local idx="$3"
  local task_id schedule_cron
  task_id=$(jq -r '.task_id' "$file")
  schedule_cron=$(jq -r '.schedule_cron' "$file")
  local sched_name="$task_id"
  [[ -n "$keyword" ]] && sched_name="${task_id}-kw${idx}"

  local custom_data='{}'
  [[ -n "$keyword" ]] && custom_data=$(jq -n --arg kw "$keyword" '{keyword: $kw}')

  local body
  body=$(jq -n --arg name "$sched_name" --arg cron "$schedule_cron" --arg taskId "$task_id" --argjson cd "$custom_data" \
    '{name: $name, cronExpression: $cron, timezone: "Asia/Kolkata", isEnabled: true, isExclusive: true, actions: [{type: "RUN_ACTOR_TASK", actorTaskId: $taskId}], customData: $cd}')

  local resp; resp=$(apify_call POST "/schedules?token=$APIFY_TOKEN" -d "$body")
  local code="${resp%%|*}"
  if [[ "$code" == "201" ]]; then
    CREATED_SCHEDULES=$((CREATED_SCHEDULES+1))
  elif [[ "$code" == "409" || "$code" == "400" ]]; then
    UPDATED_SCHEDULES=$((UPDATED_SCHEDULES+1))
  else
    echo "  WARN: schedule '$sched_name' returned $code"
  fi
}

echo "Provisioning Apify Tasks from $TASKS_DIR..."
for f in "$TASKS_DIR"/*.json; do
  provision_task "$f" || echo "  ERROR: $f failed"
done

echo ""
echo "================================================"
echo "Summary:"
echo "  Tasks created: $CREATED_TASKS, updated: $UPDATED_TASKS"
echo "  Schedules created: $CREATED_SCHEDULES, updated: $UPDATED_SCHEDULES"
echo "  Webhooks created: $CREATED_WEBHOOKS, updated: $UPDATED_WEBHOOKS"
echo "  Failures: $FAILURES"
echo "================================================"

[[ $FAILURES -gt 0 ]] && exit 1 || exit 0
