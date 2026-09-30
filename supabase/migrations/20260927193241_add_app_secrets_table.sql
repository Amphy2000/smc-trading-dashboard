/*
# Add app_secrets table for storing third-party API tokens

This table stores sensitive API tokens (like MetaApi) that edge functions need.
RLS is enabled with NO policies, so only the service role key (which bypasses RLS)
can read or write. Regular users and the anon key get zero access.

1. New Tables
- `app_secrets` — key/value store for third-party API tokens
  - `id` (uuid, primary key)
  - `key` (text, unique) — e.g. "metaapi_token"
  - `value` (text) — the actual token
  - `updated_at` (timestamptz)

2. Security
- RLS enabled, NO policies created
- Only the service role key (used by edge functions) can access this table
- No anon or authenticated access whatsoever
*/

CREATE TABLE IF NOT EXISTS app_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;
