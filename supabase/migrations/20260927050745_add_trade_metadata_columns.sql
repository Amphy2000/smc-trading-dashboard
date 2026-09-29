/*
# Add rich trade metadata for Edge Analyzer

## Purpose
Transforms the basic trade journal into a rich data source for discovering
a trader's personal edge. Adds columns for trading session, setup type,
self-rated confidence, mental/emotional state, confluence checklist,
exit reasoning, and max favorable/adverse excursion tracking.

## New Columns on `trades`
1. `session` (text, nullable) — Trading session: 'asia', 'london', 'new_york', 'overlap', 'off_hours'
2. `setup_type` (text, nullable) — Type of setup: 'order_block', 'fvg', 'liquidity_sweep', 'break_retest', 'choch_bos', 'trend_pullback', 'range_reversal', 'news_spike', 'other'
3. `confidence_level` (integer, nullable, 1-10) — Trader's self-rated confidence before entering
4. `mental_state` (text, nullable) — 'focused', 'calm', 'neutral', 'tired', 'stressed', 'fomo', 'revenge', 'confident'
5. `confluences` (jsonb, nullable) — Array of checked confluences: ['htf_alignment', 'mtf_poi', 'ltf_mss', 'liquidity_sweep', 'fvg_fill', 'ob_mitigation', 'rr_met', 'pd_zone', 'news_aware']
6. `exit_reason` (text, nullable) — 'target', 'stop', 'manual', 'trailing', 'time_exit', 'breakeven', 'fear', 'greed', 'revenge_close'
7. `max_favorable_pips` (numeric, nullable) — Best pip movement during trade (for counterfactual analysis)
8. `max_adverse_pips` (numeric, nullable) — Worst pip movement during trade (drawdown analysis)
9. `planned_rr` (numeric, nullable) — Planned risk:reward ratio at entry
10. `day_of_week` (integer, nullable, 0-6) — Day of week (0=Sunday) for day-of-week analysis

## Security
- No changes to RLS policies. Existing CRUD policies on `trades` still apply.
- No new tables created.

## Notes
1. All new columns are nullable so existing trades are not affected.
2. The frontend will populate these fields through the enhanced journal form.
3. `confluences` is jsonb to allow flexible array storage.
4. `max_favorable_pips` and `max_adverse_pips` enable "money left on table" analysis.
*/

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS session text,
  ADD COLUMN IF NOT EXISTS setup_type text,
  ADD COLUMN IF NOT EXISTS confidence_level integer CHECK (confidence_level IS NULL OR (confidence_level >= 1 AND confidence_level <= 10)),
  ADD COLUMN IF NOT EXISTS mental_state text,
  ADD COLUMN IF NOT EXISTS confluences jsonb,
  ADD COLUMN IF NOT EXISTS exit_reason text,
  ADD COLUMN IF NOT EXISTS max_favorable_pips numeric,
  ADD COLUMN IF NOT EXISTS max_adverse_pips numeric,
  ADD COLUMN IF NOT EXISTS planned_rr numeric,
  ADD COLUMN IF NOT EXISTS day_of_week integer;

CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session);
CREATE INDEX IF NOT EXISTS idx_trades_setup_type ON trades(setup_type);
CREATE INDEX IF NOT EXISTS idx_trades_day_of_week ON trades(day_of_week);