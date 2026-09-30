/*
# Add broker connections table for MetaApi integration

1. New Tables
- `broker_connections` — stores each user's MT5 broker connection details
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, defaults to auth.uid())
  - `metaapi_account_id` (text) — the account ID returned by MetaApi after creating the connection
  - `login` (text) — the trader's MT5 login number
  - `server` (text) — the broker server name (e.g. "ICMarkets-Demo")
  - `platform` (text) — "mt5" or "mt4"
  - `status` (text) — "connecting", "connected", "deploying", "syncing", "active", "error", "disconnected"
  - `last_sync_at` (timestamptz) — when trades were last pulled
  - `last_error` (text) — last error message if any
  - `broker_name` (text) — display name of the broker
  - `account_currency` (text) — e.g. "USD"
  - `account_leverage` (text) — e.g. "1:500"
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `broker_connections`
- Owner-scoped CRUD: each authenticated user can only access their own connections
*/

CREATE TABLE IF NOT EXISTS broker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  metaapi_account_id text,
  login text NOT NULL,
  server text NOT NULL,
  platform text NOT NULL DEFAULT 'mt5',
  status text NOT NULL DEFAULT 'connecting',
  last_sync_at timestamptz,
  last_error text,
  broker_name text,
  account_currency text,
  account_leverage text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE broker_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_broker_connections" ON broker_connections;
CREATE POLICY "select_own_broker_connections" ON broker_connections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_broker_connections" ON broker_connections;
CREATE POLICY "insert_own_broker_connections" ON broker_connections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_broker_connections" ON broker_connections;
CREATE POLICY "update_own_broker_connections" ON broker_connections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_broker_connections" ON broker_connections;
CREATE POLICY "delete_own_broker_connections" ON broker_connections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
