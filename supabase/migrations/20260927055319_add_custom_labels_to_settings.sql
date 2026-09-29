/*
# Add custom setup types and confluences to app_settings

## Purpose
Make TraderDNA trader-agnostic by allowing each trader to define their own
setup types and confluence labels. This replaces hardcoded SMC-only labels
with a flexible system where any trader (SMC, price action, ICT, indicator-
based) can customize the tags they use to classify their trades.

## Changes to `app_settings`
1. `custom_setup_types` (jsonb, nullable) — Array of custom setup type strings.
   Stored as JSON array: ["Order Block", "FVG Fill", "VWAP Bounce", ...]
   If null, the app uses a default SMC preset.
2. `custom_confluences` (jsonb, nullable) — Array of custom confluence strings.
   Stored as JSON array: ["HTF Bias Aligned", "Liquidity Sweep", "VWAP cross", ...]
   If null, the app uses a default SMC preset.
3. `trading_style` (text, nullable) — The trader's selected style preset:
   'smc', 'price_action', 'ict', 'indicator', 'custom'.
   Defaults to 'smc' for backward compatibility.

## Security
- No changes to RLS policies. Existing CRUD policies on `app_settings` still apply.
- No new tables created.

## Notes
1. All new columns are nullable so existing settings are not affected.
2. The frontend will populate these fields through the Settings page.
3. jsonb allows flexible array storage of arbitrary string labels.
4. When null, the app falls back to preset defaults based on trading_style.
*/

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS custom_setup_types jsonb,
  ADD COLUMN IF NOT EXISTS custom_confluences jsonb,
  ADD COLUMN IF NOT EXISTS trading_style text DEFAULT 'smc';