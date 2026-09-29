/*
 * Complete database setup for your new Supabase project
 * Copy this entire script and paste it into your Supabase SQL Editor
 * (Dashboard > SQL Editor > New Query), then click Run
 */

-- ============================================================
-- TRADES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  entry_price numeric NOT NULL,
  exit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  lot_size numeric NOT NULL DEFAULT 0.01,
  pips_result numeric,
  profit_loss numeric,
  strategy text,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),

  -- Edge Analyzer metadata
  session text,
  setup_type text,
  confidence_level integer CHECK (confidence_level IS NULL OR (confidence_level >= 1 AND confidence_level <= 10)),
  mental_state text,
  confluences jsonb,
  exit_reason text,
  max_favorable_pips numeric,
  max_adverse_pips numeric,
  planned_rr numeric,
  day_of_week integer
);

CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session);
CREATE INDEX IF NOT EXISTS idx_trades_setup_type ON trades(setup_type);
CREATE INDEX IF NOT EXISTS idx_trades_day_of_week ON trades(day_of_week);

-- ============================================================
-- APP_SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_balance numeric NOT NULL DEFAULT 10000,
  risk_per_trade numeric NOT NULL DEFAULT 2,
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz DEFAULT now(),
  custom_setup_types jsonb,
  custom_confluences jsonb,
  trading_style text DEFAULT 'smc'
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Trades policies (open access — no auth login screen in this app)
CREATE POLICY "anon_select_trades" ON trades FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_trades" ON trades FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_trades" ON trades FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_trades" ON trades FOR DELETE
  TO anon, authenticated USING (true);

-- App settings policies
CREATE POLICY "anon_select_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_settings" ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_settings" ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_settings" ON app_settings FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- SEED DEFAULT SETTINGS ROW
-- ============================================================
INSERT INTO app_settings (account_balance, risk_per_trade, currency)
VALUES (10000, 2, 'USD')
ON CONFLICT DO NOTHING;
