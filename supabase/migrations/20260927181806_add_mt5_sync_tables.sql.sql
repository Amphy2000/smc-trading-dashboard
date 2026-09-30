/*
# MT5 Auto-Sync Tables

## What this does
Adds tables to support automated trade import from MT5 via emailed reports.
Traders can email their MT5 account history report from MT5 Mobile to a special
address. An edge function receives the email, parses the trade data, and auto-logs
each trade into the trades table.

## New Tables
1. `mt5_sync_queue` — Holds incoming MT5 report data before it's processed into trades.
2. `mt5_sync_tokens` — Per-user sync tokens so each trader gets a unique email address.

## Security
- RLS enabled on both tables.
- Users can only read/write their own sync queue entries and tokens.
- The edge function uses the service role key to insert on behalf of users.
*/

CREATE TABLE IF NOT EXISTS mt5_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_content text NOT NULL,
  source text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  trades_parsed int DEFAULT 0,
  trades_imported int DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mt5_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sync_queue" ON mt5_sync_queue;
CREATE POLICY "select_own_sync_queue" ON mt5_sync_queue FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sync_queue" ON mt5_sync_queue;
CREATE POLICY "insert_own_sync_queue" ON mt5_sync_queue FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sync_queue" ON mt5_sync_queue;
CREATE POLICY "update_own_sync_queue" ON mt5_sync_queue FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sync_queue" ON mt5_sync_queue;
CREATE POLICY "delete_own_sync_queue" ON mt5_sync_queue FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS mt5_sync_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email_address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mt5_sync_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sync_token" ON mt5_sync_tokens;
CREATE POLICY "select_own_sync_token" ON mt5_sync_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sync_token" ON mt5_sync_tokens;
CREATE POLICY "insert_own_sync_token" ON mt5_sync_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sync_token" ON mt5_sync_tokens;
CREATE POLICY "delete_own_sync_token" ON mt5_sync_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mt5_sync_queue_user_id ON mt5_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_mt5_sync_queue_status ON mt5_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_mt5_sync_tokens_token ON mt5_sync_tokens(token);
