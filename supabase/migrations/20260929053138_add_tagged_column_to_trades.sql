/*
# Add tagged column to trades table

1. Changes
- Adds `tagged` boolean column to `trades` table, defaulting to NULL.
- Auto-synced trades from MT5 start as NULL (untagged). Manually logged trades are implicitly tagged.
- The frontend uses this to prompt users to tag synced trades with metadata (mental state, setup type, confidence).
- Existing trades: NULL means "unknown" — the frontend's isTradeTagged() helper resolves this heuristically.

2. Security
- No RLS changes. Existing policies remain in place.
*/

ALTER TABLE trades ADD COLUMN IF NOT EXISTS tagged boolean DEFAULT null;
