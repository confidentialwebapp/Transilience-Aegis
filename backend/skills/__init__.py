"""AI skills framework — composable, context-aware Claude operations.

Design philosophy: an AEGIS user shouldn't have to leave the platform to
get an LLM-powered answer about their data. Every skill is a self-contained
operation that:
  1. fetch_context(...) — pulls the relevant rows from Supabase
  2. invoke(context, model) — sends a structured prompt to Claude, parses response
  3. result is logged to skill_invocations with token + cost accounting

Skills are first-class — registered in `registry.py`, exposed via the
/api/v1/skills/invoke endpoint, and surface throughout the UI as "Ask AI"
buttons that pre-fill the right skill + parameters.

Default model is `claude-haiku-4-5` (cheap, fast). High-stakes skills
(advisory drafting, complex triage with multiple sources) override to
`claude-sonnet-4-6`.

Cost discipline: every invocation logs input_tokens, output_tokens, and
USD cost. The /api/v1/skills/usage endpoint surfaces this so the user
can see their spend, and we cache by (skill, input_hash) for 1 hour to
avoid re-billing for the same query.
"""
