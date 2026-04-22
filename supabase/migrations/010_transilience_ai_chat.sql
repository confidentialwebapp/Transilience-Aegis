-- TAI-AEGIS Phase 8: "Transilience AI" — context-aware chat with the user's threat data.
--
-- This is the AI-native primary surface. Every customer can ask questions
-- about their alerts, advisories, profiles, and IOCs in natural language,
-- attach files (images via Vision; text/PDF/CSV/JSON inline), and get
-- responses grounded in their own org's data.

-- ------------------------------------------------------------------
-- Conversations — one row per chat thread.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid,                     -- supabase auth.users.id when known
  title text NOT NULL DEFAULT 'New conversation',
  default_model text NOT NULL DEFAULT 'claude-haiku-4-5',
  total_cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  total_input_tokens integer NOT NULL DEFAULT 0,
  total_output_tokens integer NOT NULL DEFAULT 0,
  message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_org_recent
  ON chat_conversations(org_id, last_message_at DESC NULLS LAST)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conv_user
  ON chat_conversations(user_id, last_message_at DESC NULLS LAST)
  WHERE user_id IS NOT NULL;

-- ------------------------------------------------------------------
-- Messages — one row per turn (user or assistant).
-- Attachments stored inline as JSONB array:
--   [{type: "image"|"text"|"pdf"|"json", name, mime, size_bytes, data_b64?}]
-- For MVP we store small files (<2 MB) inline. Larger uploads can move to
-- Modal Volume later.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text,                     -- the rendered text body
  attachments jsonb DEFAULT '[]',   -- per-attachment objects (no base64 in DB by default)
  model text,                       -- which model produced an assistant turn
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_usd numeric(10, 6) DEFAULT 0,
  duration_ms integer DEFAULT 0,
  cached boolean DEFAULT false,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_time
  ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_msg_org_time
  ON chat_messages(org_id, created_at DESC);
