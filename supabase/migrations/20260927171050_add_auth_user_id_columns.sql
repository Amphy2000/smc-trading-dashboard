/*
# Add user authentication and owner-scoped data isolation

## Overview
This migration converts the app from single-tenant (no auth, shared data) to
multi-tenant (each user sees only their own trades and settings). It adds a
`user_id` column to both the `trades` and `app_settings` tables, defaults it to
the authenticated user's ID via `auth.uid()`, and replaces the open
`USING(true)` policies with owner-scoped policies that check `auth.uid() = user_id`.

## Changes

### 1. trades table
- Added column: `user_id` (uuid, NOT NULL, defaults to `auth.uid()`)
  - Foreign key to `auth.users(id)` with `ON DELETE CASCADE`
  - Indexed for query performance
- Dropped old open policies (`anon_select_trades`, `anon_insert_trades`,
  `anon_update_trades`, `anon_delete_trades`)
- New policies (all `TO authenticated`, scoped to `auth.uid() = user_id`):
  - `select_own_trades` — SELECT
  - `insert_own_trades` — INSERT (WITH CHECK)
  - `update_own_trades` — UPDATE (USING + WITH CHECK)
  - `delete_own_trades` — DELETE

### 2. app_settings table
- Added column: `user_id` (uuid, NOT NULL, defaults to `auth.uid()`)
  - Foreign key to `auth.users(id)` with `ON DELETE CASCADE`
  - Indexed for query performance
- Dropped old open policies (`anon_select_settings`, `anon_insert_settings`,
  `anon_update_settings`, `anon_delete_settings`)
- New policies (all `TO authenticated`, scoped to `auth.uid() = user_id`):
  - `select_own_settings` — SELECT
  - `insert_own_settings` — INSERT (WITH CHECK)
  - `update_own_settings` — UPDATE (USING + WITH CHECK)
  - `delete_own_settings` — DELETE

## Security
- RLS remains enabled on both tables.
- All policies now require authentication (`TO authenticated`).
- Each user can only read, create, update, and delete their own rows.
- The `DEFAULT auth.uid()` on `user_id` means frontend inserts that omit
  `user_id` will still satisfy the INSERT policy's WITH CHECK.

## Important Notes
1. The existing `app_settings` row (pre-auth) has no user. The column is added
   as nullable first, then the old row is deleted (it was a default placeholder),
   and the column is set to NOT NULL with the `DEFAULT auth.uid()` going forward.
2. The `user_id` column is added with a safe `DO $$ ... END $$` block to check
   if the column already exists before adding.
*/

-- Add user_id to trades (nullable first, then NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- trades has 0 rows, safe to set NOT NULL immediately
UPDATE trades SET user_id = auth.uid() WHERE user_id IS NULL;
ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trades ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);

-- Add user_id to app_settings (nullable first, clean up old row, then NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Delete the old pre-auth settings row (no owner, no longer accessible)
DELETE FROM app_settings WHERE user_id IS NULL;

ALTER TABLE app_settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON app_settings(user_id);

-- Drop old open policies on trades
DROP POLICY IF EXISTS "anon_select_trades" ON trades;
DROP POLICY IF EXISTS "anon_insert_trades" ON trades;
DROP POLICY IF EXISTS "anon_update_trades" ON trades;
DROP POLICY IF EXISTS "anon_delete_trades" ON trades;

-- New owner-scoped policies on trades
CREATE POLICY "select_own_trades" ON trades FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_trades" ON trades FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_trades" ON trades FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_trades" ON trades FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Drop old open policies on app_settings
DROP POLICY IF EXISTS "anon_select_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_insert_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_update_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_delete_settings" ON app_settings;

-- New owner-scoped policies on app_settings
CREATE POLICY "select_own_settings" ON app_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_settings" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_settings" ON app_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_settings" ON app_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
