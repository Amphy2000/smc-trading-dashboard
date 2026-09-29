import { useMemo } from 'react';
import type { Candle, Trade } from '@/lib/types';
import { getPipSize } from '@/lib/forex';
import { SESSION_LABELS, MENTAL_LABELS, EXIT_LABELS } from '@/lib/edgeAnalyzer';
import { Card, Badge } from '@/components/ui';
import {
  TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpToLine,
  Target, Shield, Clock, Brain, Zap,
} from 'lucide-react';

interface TradeReplayProps {
  trade: Trade;
  candles: Candle[];
}

export function TradeReplay({ trade, candles }: TradeReplayProps) {
  const pipSize = getPipSize(trade.pair);

  const tradeTime = new Date(trade.opened_at).getTime();
  const exitTime = trade.closed_at ? new Date(trade.closed_at).getTime() : Date.now();

  const windowCandles = useMemo(() => {
    const beforeCount = 15;
    const afterCount = 10;

    let entryIdx = candles.findIndex((c) => c.time >= tradeTime);
    if (entryIdx === -1) entryIdx = Math.max(0, candles.length - 20);

    const start = Math.max(0, entryIdx - beforeCount);
    const end = Math.min(candles.length, entryIdx + afterCount);

    return candles.slice(start, end);
  }, [candles, tradeTime]);

  const entryIdxInWindow = useMemo(() => {
    const idx = windowCandles.findIndex((c) => c.time >= tradeTime);
    return idx === -1 ? Math.floor(windowCandles.length / 2) : idx;
  }, [windowCandles, tradeTime]);

  const width = 800;
  const height = 360;
  const padding = { top: 20, right: 70, bottom: 30, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const candleWidth = windowCandles.length > 0 ? chartWidth / windowCandles.length : 1;
  const bodyWidth = Math.max(candleWidth * 0.6, 2);

  const allValues: number[] = [];
  for (const c of windowCandles) {
    allValues.push(c.high, c.low);
  }
  if (trade.entry_price) allValues.push(trade.entry_price);
  if (trade.stop_loss) allValues.push(trade.stop_loss);
  if (trade.take_profit) allValues.push(trade.take_profit);
  if (trade.exit_price) allValues.push(trade.exit_price);

  const maxPrice = allValues.length > 0 ? Math.max(...allValues) : 1;
  const minPrice = allValues.length > 0 ? Math.min(...allValues) : 0;
  const priceRange = maxPrice - minPrice || 1;
  const padded = priceRange * 0.12;
  const yMax = maxPrice + padded;
  const yMin = minPrice - padded;
  const yRange = yMax - yMin;

  const yToPx = (price: number) => padding.top + ((yMax - price) / yRange) * chartHeight;
  const xToPx = (i: number) => padding.left + i * candleWidth + candleWidth / 2;

  const formatPrice = (p: number) => {
    if (p > 50) return p.toFixed(2);
    return p.toFixed(5);
  };

  const isBuy = trade.direction === 'BUY';
  const dirColor = isBuy ? '#22c55e' : '#ef4444';
  const entryX = xToPx(entryIdxInWindow);

  const priceLines = Array.from({ length: 5 }, (_, i) => yMin + (yRange / 4) * i);

  const exitIdxInWindow = useMemo(() => {
    if (!trade.exit_price) return -1;
    const idx = windowCandles.findIndex((c) => c.time >= exitTime);
    return idx === -1 ? -1 : idx;
  }, [windowCandles, exitTime, trade.exit_price]);

  return (
    <div className="space-y-3">
      {/* Trade summary header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isBuy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          {isBuy ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-slate-100">{trade.pair}</span>
            <Badge variant={isBuy ? 'success' : 'danger'}>{trade.direction}</Badge>
            <Badge variant={trade.status === 'open' ? 'info' : 'neutral'}>{trade.status}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date(trade.opened_at).toLocaleString()}
            {trade.closed_at && ` → ${new Date(trade.closed_at).toLocaleString()}`}
          </p>
        </div>
        {trade.pips_result !== null && (
          <div className="text-right">
            <p className={`text-lg font-mono font-bold ${trade.pips_result >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trade.pips_result > 0 ? '+' : ''}{trade.pips_result.toFixed(1)}p
            </p>
            {trade.profit_loss !== null && (
              <p className={`text-xs font-mono ${trade.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${trade.profit_loss.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chart with trade overlays */}
      {windowCandles.length > 0 ? (
        <div style={{ height }} className="w-full bg-slate-900/40 rounded-lg overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
            {/* Price grid */}
            {priceLines.map((p, i) => (
              <g key={i}>
                <line
                  x1={padding.left} y1={yToPx(p)}
                  x2={width - padding.right} y2={yToPx(p)}
                  stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,4"
                />
                <text
                  x={width - padding.right + 5} y={yToPx(p) + 4}
                  fill="#64748b" fontSize="11" fontFamily="monospace"
                >
                  {formatPrice(p)}
                </text>
              </g>
            ))}

            {/* Candles */}
            {windowCandles.map((c, i) => {
              const isBull = c.close >= c.open;
              const color = isBull ? '#22c55e' : '#ef4444';
              const x = xToPx(i);
              const wickTop = yToPx(c.high);
              const wickBottom = yToPx(c.low);
              const bodyTop = yToPx(Math.max(c.open, c.close));
              const bodyBottom = yToPx(Math.min(c.open, c.close));
              const bodyH = Math.max(bodyBottom - bodyTop, 1);

              return (
                <g key={i}>
                  <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth="1" />
                  <rect
                    x={x - bodyWidth / 2} y={bodyTop}
                    width={bodyWidth} height={bodyH}
                    fill={color} opacity={0.9}
                  />
                </g>
              );
            })}

            {/* SL line (red dashed) */}
            {trade.stop_loss && (
              <g>
                <line
                  x1={padding.left} y1={yToPx(trade.stop_loss)}
                  x2={width - padding.right} y2={yToPx(trade.stop_loss)}
                  stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" opacity="0.7"
                />
                <rect x={padding.left} y={yToPx(trade.stop_loss) - 7} width="22" height="14" fill="#1e293b" rx="3" />
                <text x={padding.left + 4} y={yToPx(trade.stop_loss) + 3} fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="700">
                  SL
                </text>
              </g>
            )}

            {/* TP line (green dashed) */}
            {trade.take_profit && (
              <g>
                <line
                  x1={padding.left} y1={yToPx(trade.take_profit)}
                  x2={width - padding.right} y2={yToPx(trade.take_profit)}
                  stroke="#22c55e" strokeWidth="1" strokeDasharray="4,3" opacity="0.7"
                />
                <rect x={padding.left} y={yToPx(trade.take_profit) - 7} width="22" height="14" fill="#1e293b" rx="3" />
                <text x={padding.left + 4} y={yToPx(trade.take_profit) + 3} fill="#22c55e" fontSize="10" fontFamily="monospace" fontWeight="700">
                  TP
                </text>
              </g>
            )}

            {/* Entry marker */}
            <g>
              <line
                x1={entryX} y1={yToPx(trade.entry_price)}
                x2={width - padding.right} y2={yToPx(trade.entry_price)}
                stroke={dirColor} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.8"
              />
              <circle cx={entryX} cy={yToPx(trade.entry_price)} r="5" fill={dirColor} stroke="#0f172a" strokeWidth="2" />
              {isBuy ? (
                <ArrowUpToLine x={entryX - 8} y={yToPx(trade.entry_price) - 18} width={16} height={16} color={dirColor} />
              ) : (
                <ArrowDownToLine x={entryX - 8} y={yToPx(trade.entry_price) + 4} width={16} height={16} color={dirColor} />
              )}
              <text x={entryX + 8} y={yToPx(trade.entry_price) - 8} fill={dirColor} fontSize="10" fontFamily="monospace" fontWeight="700">
                {formatPrice(trade.entry_price)}
              </text>
            </g>

            {/* Exit marker */}
            {trade.exit_price && exitIdxInWindow >= 0 && (
              <g>
                <circle
                  cx={xToPx(exitIdxInWindow)}
                  cy={yToPx(trade.exit_price)}
                  r="5"
                  fill="none"
                  stroke={dirColor}
                  strokeWidth="2"
                />
                <line
                  x1={xToPx(exitIdxInWindow)}
                  y1={yToPx(trade.exit_price)}
                  x2={xToPx(exitIdxInWindow)}
                  y2={yToPx(trade.exit_price) + (isBuy ? 20 : -20)}
                  stroke={dirColor}
                  strokeWidth="1"
                  opacity="0.5"
                />
                <text
                  x={xToPx(exitIdxInWindow) + 8}
                  y={yToPx(trade.exit_price) + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {formatPrice(trade.exit_price)}
                </text>
              </g>
            )}

            {/* Entry vertical line */}
            <line
              x1={entryX} y1={padding.top}
              x2={entryX} y2={height - padding.bottom}
              stroke={dirColor} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.4"
            />
          </svg>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm bg-slate-900/40 rounded-lg">
          No chart data available for this period
        </div>
      )}

      {/* Trade details grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-800/40 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase">Entry</span>
          </div>
          <p className="text-sm font-mono text-slate-200">{formatPrice(trade.entry_price)}</p>
        </div>

        {trade.exit_price !== null && (
          <div className="bg-slate-800/40 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-slate-500 uppercase">Exit</span>
            </div>
            <p className="text-sm font-mono text-slate-200">{formatPrice(trade.exit_price)}</p>
          </div>
        )}

        {trade.stop_loss !== null && (
          <div className="bg-slate-800/40 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-slate-500 uppercase">SL</span>
            </div>
            <p className="text-sm font-mono text-red-400">{formatPrice(trade.stop_loss)}</p>
          </div>
        )}

        {trade.take_profit !== null && (
          <div className="bg-slate-800/40 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-slate-500 uppercase">TP</span>
            </div>
            <p className="text-sm font-mono text-green-400">{formatPrice(trade.take_profit)}</p>
          </div>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-3 text-xs">
        {trade.session && (
          <span className="text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {SESSION_LABELS[trade.session]}
          </span>
        )}
        {trade.setup_type && (
          <span className="text-slate-500 flex items-center gap-1">
            <Zap className="w-3 h-3" /> {trade.setup_type}
          </span>
        )}
        {trade.mental_state && (
          <span className="text-slate-500 flex items-center gap-1">
            <Brain className="w-3 h-3" /> {MENTAL_LABELS[trade.mental_state]}
          </span>
        )}
        {trade.exit_reason && (
          <span className="text-slate-500">
            Exit: {EXIT_LABELS[trade.exit_reason]}
          </span>
        )}
        {trade.planned_rr != null && trade.planned_rr > 0 && (
          <span className="text-slate-500">
            Planned R:R 1:{trade.planned_rr!.toFixed(1)}
          </span>
        )}
        {trade.confidence_level !== null && (
          <span className="text-slate-500">
            Confidence: {trade.confidence_level}/10
          </span>
        )}
      </div>

      {/* Confluences */}
      {trade.confluences && trade.confluences.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/50">
          {trade.confluences.map((c) => (
            <span key={c} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Notes */}
      {trade.notes && (
        <div className="pt-2 border-t border-slate-800/50">
          <p className="text-xs text-slate-400 leading-relaxed">{trade.notes}</p>
        </div>
      )}

      {/* MFE / MAE */}
      {(trade.max_favorable_pips !== null || trade.max_adverse_pips !== null) && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/50">
          {trade.max_favorable_pips !== null && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-slate-500">Max favorable:</span>
              <span className="text-xs font-mono text-green-400">+{trade.max_favorable_pips!.toFixed(1)}p</span>
            </div>
          )}
          {trade.max_adverse_pips !== null && (
            <div className="flex items-center gap-2">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-slate-500">Max adverse:</span>
              <span className="text-xs font-mono text-red-400">{trade.max_adverse_pips!.toFixed(1)}p</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
