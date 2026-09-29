import { useState, useMemo } from 'react';
import type { PairData, StrategyConfig, BacktestResult } from '@/lib/types';
import { Card, Button, Input, Select, PairSelect } from '@/components/ui';
import { EquityCurve } from '@/components/EquityCurve';
import { runBacktest } from '@/lib/backtest';

import { DEFAULT_STRATEGY } from '@/lib/signalEngine';
import { Play, BarChart3 } from 'lucide-react';

interface BacktestProps {
  pairs: PairData[];
}

export function Backtest({ pairs }: BacktestProps) {
  const [selectedSymbol, setSelectedSymbol] = useState('EUR/USD');
  const [strategy, setStrategy] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [allResults, setAllResults] = useState<BacktestResult[]>([]);

  const runSingle = () => {
    const pair = pairs.find((p) => p.symbol === selectedSymbol);
    if (!pair) return;
    setRunning(true);
    setTimeout(() => {
      const result = runBacktest(selectedSymbol, pair.candles, strategy);
      setResults(result);
      setRunning(false);
    }, 100);
  };

  const runAll = () => {
    setRunning(true);
    setTimeout(() => {
      const all = pairs.map((p) => runBacktest(p.symbol, p.candles, strategy));
      setAllResults(all.sort((a, b) => b.totalPips - a.totalPips));
      setRunning(false);
    }, 100);
  };

  const equityCurve = useMemo(() => {
    if (!results) return [];
    let running = 0;
    return [0, ...results.trades.map((t) => (running += t.pips))];
  }, [results]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">SMC Backtester</h1>
        <p className="text-sm text-slate-500 mt-1">Backtest order block, liquidity sweep, and structure-based entries on historical data</p>
      </div>

      {/* Config */}
      <Card className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <PairSelect label="Instrument" value={selectedSymbol} onChange={setSelectedSymbol} />
          <Input label="Swing Length" type="number" value={strategy.swingLength} onChange={(v) => setStrategy({ ...strategy, swingLength: +v })} />
          <Input label="Min OB Strength" type="number" step="0.1" value={strategy.minOrderBlockStrength} onChange={(v) => setStrategy({ ...strategy, minOrderBlockStrength: +v })} />
          <Input label="Min R:R" type="number" step="0.1" value={strategy.riskRewardMin} onChange={(v) => setStrategy({ ...strategy, riskRewardMin: +v })} />
          <Input label="Liquidity Min Touches" type="number" value={strategy.liquidityMinTouches} onChange={(v) => setStrategy({ ...strategy, liquidityMinTouches: +v })} />
          <Input label="ATR SL Multiplier" type="number" step="0.1" value={strategy.atrMultiplierSL} onChange={(v) => setStrategy({ ...strategy, atrMultiplierSL: +v })} />
          <Input label="FVG Max Age" type="number" value={strategy.fvgMaxAge} onChange={(v) => setStrategy({ ...strategy, fvgMaxAge: +v })} />
          <Input label="Min Confidence" type="number" value={strategy.minConfidence} onChange={(v) => setStrategy({ ...strategy, minConfidence: +v })} />
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button onClick={runSingle} disabled={running} size="sm">
            <Play className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Backtest</span> {selectedSymbol}
          </Button>
          <Button variant="secondary" onClick={runAll} disabled={running} size="sm">
            <BarChart3 className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Backtest</span> All
          </Button>
        </div>
      </Card>

      {running && (
        <Card className="p-8 text-center">
          <div className="animate-pulse text-slate-400">Running SMC backtest...</div>
        </Card>
      )}

      {/* Single pair results */}
      {results && !running && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-slate-400 uppercase">Total Trades</p>
              <p className="text-2xl font-bold text-slate-100 font-mono mt-1">{results.totalTrades}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-400 uppercase">Win Rate</p>
              <p className={`text-2xl font-bold font-mono mt-1 ${results.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {results.winRate.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">{results.wins}W / {results.losses}L</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-400 uppercase">Total Pips</p>
              <p className={`text-2xl font-bold font-mono mt-1 ${results.totalPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {results.totalPips > 0 ? '+' : ''}{results.totalPips.toFixed(0)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-400 uppercase">Profit Factor</p>
              <p className={`text-2xl font-bold font-mono mt-1 ${results.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                {results.profitFactor.toFixed(2)}
              </p>
            </Card>
          </div>

          {/* Equity curve */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Equity Curve (pips)</h3>
            <div style={{ height: 220 }}>
              <EquityCurve values={equityCurve} height={220} />
            </div>
          </Card>

          {/* Detailed stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Trade Statistics</h3>
              <div className="space-y-2">
                <StatRow label="Average Win" value={`+${results.avgWinPips.toFixed(1)} pips`} color="text-green-400" />
                <StatRow label="Average Loss" value={`-${results.avgLossPips.toFixed(1)} pips`} color="text-red-400" />
                <StatRow label="Max Drawdown" value={`${results.maxDrawdownPips.toFixed(0)} pips`} color="text-amber-400" />
                <StatRow label="Longest Win Streak" value={`${results.longestWinStreak} trades`} color="text-green-400" />
                <StatRow label="Longest Loss Streak" value={`${results.longestLossStreak} trades`} color="text-red-400" />
                <StatRow label="Strategy" value={results.strategy} color="text-slate-300" />
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Recent Trades</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {results.trades.slice(-10).reverse().map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-800/40 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${t.direction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.direction}</span>
                      <span className="text-slate-500 text-xs">{new Date(t.entryTime).toLocaleDateString()}</span>
                      <span className="text-slate-600 text-xs">{t.reason}</span>
                    </div>
                    <span className={`font-mono ${t.pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.pips > 0 ? '+' : ''}{t.pips.toFixed(1)}p
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* All pairs comparison */}
      {allResults.length > 0 && !running && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">All Pairs Performance Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase border-b border-slate-800">
                  <th className="text-left py-2 px-2">Pair</th>
                  <th className="text-right py-2 px-2">Trades</th>
                  <th className="text-right py-2 px-2">Win Rate</th>
                  <th className="text-right py-2 px-2">Total Pips</th>
                  <th className="text-right py-2 px-2">Profit Factor</th>
                  <th className="text-right py-2 px-2">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {allResults.map((r) => (
                  <tr key={r.pair} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 px-2 font-semibold text-slate-200">{r.pair}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-300">{r.totalTrades}</td>
                    <td className={`py-2 px-2 text-right font-mono ${r.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.winRate.toFixed(0)}%
                    </td>
                    <td className={`py-2 px-2 text-right font-mono ${r.totalPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.totalPips > 0 ? '+' : ''}{r.totalPips.toFixed(0)}
                    </td>
                    <td className={`py-2 px-2 text-right font-mono ${r.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.profitFactor.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-amber-400">{r.maxDrawdownPips.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-800/50 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-mono ${color}`}>{value}</span>
    </div>
  );
}
