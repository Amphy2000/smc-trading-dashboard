import { useMemo } from 'react';
import type { Trade, HeatmapCell, EdgeInsight } from '@/lib/types';
import { Card, StatCard, Badge } from '@/components/ui';
import { EquityCurve } from '@/components/EquityCurve';
import {
  bySession, byDayOfWeek, byHourOfDay, bySetupType, byMentalState,
  byConfidenceLevel, byPair, byDirection, confluenceStats,
  counterfactualAnalysis, generateEdgeInsights,
  SESSION_LABELS, MENTAL_LABELS,
} from '@/lib/edgeAnalyzer';
import {
  Dna, Clock, Calendar, Brain, Smile, Zap, Layers, TrendingUp,
  TrendingDown, AlertTriangle, Target, Activity, Fingerprint,
} from 'lucide-react';

interface EdgeDNAProps {
  trades: Trade[];
}

function winRateColor(wr: number): string {
  if (wr >= 60) return 'text-green-400';
  if (wr >= 50) return 'text-blue-400';
  if (wr >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function pipColor(pips: number): string {
  return pips >= 0 ? 'text-green-400' : 'text-red-400';
}

function HeatmapRow({ cell, maxPips }: { cell: HeatmapCell; maxPips: number }) {
  const intensity = maxPips > 0 ? Math.min(Math.abs(cell.totalPips) / maxPips, 1) : 0;
  const bg = cell.totalPips >= 0
    ? `rgba(34, 197, 94, ${0.05 + intensity * 0.2})`
    : `rgba(239, 68, 68, ${0.05 + intensity * 0.2})`;

  return (
    <div
      className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors hover:bg-slate-800/40 gap-2"
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <span className="text-sm text-slate-200 font-medium truncate">{cell.label}</span>
        <span className="text-xs text-slate-500 hidden sm:inline">{cell.tradeCount} trades</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <span className={`text-xs sm:text-sm font-mono ${winRateColor(cell.winRate)}`}>{cell.winRate.toFixed(0)}%</span>
        <span className={`text-xs sm:text-sm font-mono font-bold text-right ${pipColor(cell.totalPips)}`}>
          {cell.totalPips > 0 ? '+' : ''}{cell.totalPips.toFixed(0)}p
        </span>
        <span className="text-xs text-slate-500 text-right hidden sm:inline">{cell.avgPips.toFixed(1)}p/tr</span>
      </div>
    </div>
  );
}

function HeatmapSection({ title, icon, cells, emptyMsg }: {
  title: string; icon: React.ReactNode; cells: HeatmapCell[]; emptyMsg: string;
}) {
  const maxPips = Math.max(...cells.map((c) => Math.abs(c.totalPips)), 1);
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      </div>
      {cells.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between py-1 px-3 text-[10px] uppercase text-slate-500 border-b border-slate-800 mb-1">
            <span>Category</span>
            <div className="flex gap-2 sm:gap-4">
              <span>Win%</span>
              <span>Pips</span>
              <span className="hidden sm:inline">Avg/Trade</span>
            </div>
          </div>
          {cells.map((c) => <HeatmapRow key={c.label} cell={c} maxPips={maxPips} />)}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-6">{emptyMsg}</p>
      )}
    </Card>
  );
}

export function EdgeDNA({ trades }: EdgeDNAProps) {
  const closedTrades = trades.filter((t) => t.status === 'closed');

  const insights = useMemo(() => generateEdgeInsights(trades), [trades]);
  const sessionData = useMemo(() => bySession(trades), [trades]);
  const dayData = useMemo(() => byDayOfWeek(trades), [trades]);
  const hourData = useMemo(() => byHourOfDay(trades), [trades]);
  const setupData = useMemo(() => bySetupType(trades), [trades]);
  const mentalData = useMemo(() => byMentalState(trades), [trades]);
  const confidenceData = useMemo(() => byConfidenceLevel(trades), [trades]);
  const pairData = useMemo(() => byPair(trades), [trades]);
  const dirData = useMemo(() => byDirection(trades), [trades]);
  const confStats = useMemo(() => confluenceStats(trades), [trades]);
  const cf = useMemo(() => counterfactualAnalysis(trades), [trades]);

  // Equity curve
  const equity = useMemo(() => {
    let running = 0;
    return [0, ...closedTrades.map((t) => (running += t.pips_result || 0))];
  }, [closedTrades]);

  const totalPips = closedTrades.reduce((s, t) => s + (t.pips_result || 0), 0);
  const wins = closedTrades.filter((t) => (t.pips_result || 0) > 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

  if (closedTrades.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Edge DNA</h1>
          <p className="text-sm text-slate-500 mt-1">Discover your personal trading edge from your own data</p>
        </div>
        <Card className="p-12 text-center">
          <Fingerprint className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No closed trades yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Log trades with rich metadata (setup type, mental state, confidence, confluences) and close them to unlock your personal performance DNA.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Dna className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" /> Edge DNA
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Based on {closedTrades.length} closed trades — your personal performance fingerprint
        </p>
      </div>

      {closedTrades.length < 5 && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-400">
            Only {closedTrades.length} trade{closedTrades.length !== 1 ? 's' : ''} logged. Log at least 5 for meaningful patterns. The more trades you log, the more accurate your edge DNA becomes.
          </span>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Pips" value={`${totalPips > 0 ? '+' : ''}${totalPips.toFixed(0)}`} trend={totalPips >= 0 ? 'up' : 'down'} icon={<Target className="w-5 h-5" />} />
        <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} subtext={`${wins.length}W / ${closedTrades.length - wins.length}L`} trend={winRate >= 50 ? 'up' : 'down'} icon={<Activity className="w-5 h-5" />} />
        <StatCard label="Trades Logged" value={closedTrades.length} subtext={`${trades.length} total`} icon={<Layers className="w-5 h-5" />} />
        <StatCard label="Money Left on Table" value={`${cf.avgMoneyLeftOnTable.toFixed(1)}p`} subtext="avg per trade" trend={cf.avgMoneyLeftOnTable > 0 ? 'down' : 'neutral'} icon={<AlertTriangle className="w-5 h-5" />} />
      </div>

      {/* Edge insights - the unique value */}
      {insights.length > 0 && (
        <Card className="p-5 border-blue-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">Your Edge Insights</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`rounded-lg p-4 border ${
                  ins.isPositive
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {ins.isPositive ? (
                      <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-xs text-slate-500 uppercase tracking-wide">{ins.category}</span>
                  </div>
                  <Badge variant={ins.isPositive ? 'success' : 'danger'}>n={ins.sampleSize}</Badge>
                </div>
                <p className="text-sm font-semibold text-slate-200 mt-1">{ins.label}</p>
                <p className="text-sm text-slate-400 mt-0.5">{ins.value}</p>
                <p className="text-xs text-slate-500 mt-1.5">{ins.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Equity curve */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Equity Curve (pips)</h2>
        <div style={{ height: 220 }}>
          <EquityCurve values={equity} height={220} />
        </div>
      </Card>

      {/* Counterfactual analysis */}
      {cf.insights.length > 0 && (
        <Card className="p-5 border-amber-500/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-slate-100">Exit Quality Analysis</h2>
          </div>
          <div className="space-y-3">
            {cf.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 bg-slate-800/40 rounded-lg p-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <p className="text-sm text-slate-300">{ins}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeatmapSection
          title="Performance by Setup Type"
          icon={<Zap className="w-4 h-4 text-blue-400" />}
          cells={setupData}
          emptyMsg="Tag your trades with setup types to see which setups work best for you"
        />
        <HeatmapSection
          title="Performance by Session"
          icon={<Clock className="w-4 h-4 text-blue-400" />}
          cells={sessionData}
          emptyMsg="Trade session data will appear here"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeatmapSection
          title="Performance by Day of Week"
          icon={<Calendar className="w-4 h-4 text-blue-400" />}
          cells={dayData}
          emptyMsg="Day-of-week patterns will appear here"
        />
        <HeatmapSection
          title="Performance by Mental State"
          icon={<Smile className="w-4 h-4 text-blue-400" />}
          cells={mentalData}
          emptyMsg="Tag your mental state on trades to see how psychology affects your results"
        />
      </div>

      {/* Confidence calibration */}
      <HeatmapSection
        title="Confidence Calibration — Does Your Gut Predict Results?"
        icon={<Brain className="w-4 h-4 text-blue-400" />}
        cells={confidenceData}
        emptyMsg="Rate your confidence on each trade to see if your gut is calibrated"
      />

      {/* Hour heatmap */}
      {hourData.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-300">Performance by Hour (UTC)</h2>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {hourData.map((h) => {
              const intensity = Math.min(Math.abs(h.totalPips) / (Math.max(...hourData.map((x) => Math.abs(x.totalPips)), 1)), 1);
              return (
                <div
                  key={h.label}
                  className="flex flex-col items-center gap-1 flex-shrink-0 group"
                  title={`${h.tradeCount} trades, ${h.winRate.toFixed(0)}% WR, ${h.totalPips.toFixed(0)} pips`}
                >
                  <div
                    className="w-10 rounded-t-md transition-all group-hover:opacity-80"
                    style={{
                      height: `${30 + intensity * 60}px`,
                      backgroundColor: h.totalPips >= 0
                        ? `rgba(34, 197, 94, ${0.3 + intensity * 0.7})`
                        : `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`,
                    }}
                  />
                  <span className="text-[9px] text-slate-500 -rotate-45 origin-left whitespace-nowrap">{h.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Confluence effectiveness */}
      {confStats.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-300">Confluence Effectiveness</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1 px-3 text-[10px] uppercase text-slate-500 border-b border-slate-800">
              <span>Confluence</span>
              <div className="flex gap-2 sm:gap-4">
                <span>Trades</span>
                <span>Win%</span>
                <span>Pips</span>
              </div>
            </div>
            {confStats.map((s) => (
              <div key={s.confluence} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/40 gap-2">
                <span className="text-sm text-slate-300 truncate">{s.confluence}</span>
                <div className="flex gap-2 sm:gap-4 flex-shrink-0">
                  <span className="text-xs sm:text-sm font-mono text-slate-400 text-right">{s.trades}</span>
                  <span className={`text-xs sm:text-sm font-mono text-right ${winRateColor(s.winRate)}`}>{s.winRate.toFixed(0)}%</span>
                  <span className={`text-xs sm:text-sm font-mono font-bold text-right ${pipColor(s.totalPips)}`}>
                    {s.totalPips > 0 ? '+' : ''}{s.totalPips.toFixed(0)}p
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pair and direction breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeatmapSection
          title="Performance by Pair"
          icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          cells={pairData}
          emptyMsg="Pair performance will appear here once you have closed trades"
        />
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-300">Buy vs Sell</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-400 font-mono">{dirData.buy.totalPips > 0 ? '+' : ''}{dirData.buy.totalPips.toFixed(0)}p</p>
              <p className="text-xs text-slate-400 mt-1">{dirData.buy.winRate.toFixed(0)}% WR / {dirData.buy.tradeCount} trades</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
              <TrendingDown className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-400 font-mono">{dirData.sell.totalPips > 0 ? '+' : ''}{dirData.sell.totalPips.toFixed(0)}p</p>
              <p className="text-xs text-slate-400 mt-1">{dirData.sell.winRate.toFixed(0)}% WR / {dirData.sell.tradeCount} trades</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
