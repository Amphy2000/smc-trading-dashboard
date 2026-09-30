import { useMemo } from 'react';
import type { Trade } from '@/lib/types';
import { Card, StatCard, Badge } from '@/components/ui';
import { EquityCurve } from '@/components/EquityCurve';
import { TrendingUp, TrendingDown, Target, Percent, Award, BarChart3 } from 'lucide-react';

interface AnalyticsProps {
  trades: Trade[];
}

export function Analytics({ trades }: AnalyticsProps) {
  const closedTrades = trades.filter((t) => t.status === 'closed');

  const stats = useMemo(() => {
    const wins = closedTrades.filter((t) => (t.pips_result || 0) > 0);
    const losses = closedTrades.filter((t) => (t.pips_result || 0) <= 0);
    const totalPips = closedTrades.reduce((s, t) => s + (t.pips_result || 0), 0);
    const totalPnL = closedTrades.reduce((s, t) => s + (t.profit_loss || 0), 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pips_result || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pips_result || 0), 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
    const expectancy = closedTrades.length > 0 ? totalPips / closedTrades.length : 0;

    // Equity curve
    let running = 0;
    const equity = [0, ...closedTrades.map((t) => (running += t.pips_result || 0))];

    // By pair
    const byPair: Record<string, { trades: number; pips: number; wins: number }> = {};
    for (const t of closedTrades) {
      if (!byPair[t.pair]) byPair[t.pair] = { trades: 0, pips: 0, wins: 0 };
      byPair[t.pair].trades++;
      byPair[t.pair].pips += t.pips_result || 0;
      if ((t.pips_result || 0) > 0) byPair[t.pair].wins++;
    }

    // By strategy
    const byStrategy: Record<string, { trades: number; pips: number; wins: number }> = {};
    for (const t of closedTrades) {
      const key = t.strategy || 'Unknown';
      if (!byStrategy[key]) byStrategy[key] = { trades: 0, pips: 0, wins: 0 };
      byStrategy[key].trades++;
      byStrategy[key].pips += t.pips_result || 0;
      if ((t.pips_result || 0) > 0) byStrategy[key].wins++;
    }

    // By direction
    const buys = closedTrades.filter((t) => t.direction === 'BUY');
    const sells = closedTrades.filter((t) => t.direction === 'SELL');
    const buyPips = buys.reduce((s, t) => s + (t.pips_result || 0), 0);
    const sellPips = sells.reduce((s, t) => s + (t.pips_result || 0), 0);

    return {
      wins: wins.length,
      losses: losses.length,
      totalPips,
      totalPnL,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      equity,
      byPair,
      byStrategy,
      buyPips,
      sellPips,
      buyCount: buys.length,
      sellCount: sells.length,
    };
  }, [closedTrades]);

  if (closedTrades.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Analytics</h1>
        <Card className="p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No closed trades yet</p>
          <p className="text-sm text-slate-500 mt-1">Close some trades in your journal to see performance analytics.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Performance Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Based on {closedTrades.length} closed trades</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Net Pips" value={`${stats.totalPips > 0 ? '+' : ''}${stats.totalPips.toFixed(0)}`} trend={stats.totalPips >= 0 ? 'up' : 'down'} icon={<Target className="w-5 h-5" />} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} subtext={`${stats.wins}W / ${stats.losses}L`} trend={stats.winRate >= 50 ? 'up' : 'down'} icon={<Percent className="w-5 h-5" />} />
        <StatCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} subtext={stats.profitFactor >= 1 ? 'Profitable' : 'Unprofitable'} trend={stats.profitFactor >= 1 ? 'up' : 'down'} icon={<Award className="w-5 h-5" />} />
        <StatCard label="Expectancy" value={`${stats.expectancy > 0 ? '+' : ''}${stats.expectancy.toFixed(1)}p`} subtext="per trade" trend={stats.expectancy >= 0 ? 'up' : 'down'} icon={<TrendingUp className="w-5 h-5" />} />
      </div>

      {/* Equity curve */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Equity Curve</h2>
        <div style={{ height: 240 }}>
          <EquityCurve values={stats.equity} height={240} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avg win/loss */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">Win / Loss Analysis</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
              <span className="text-sm text-slate-400">Average Win</span>
              <span className="text-sm font-mono text-green-400">+{stats.avgWin.toFixed(1)} pips</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
              <span className="text-sm text-slate-400">Average Loss</span>
              <span className="text-sm font-mono text-red-400">-{stats.avgLoss.toFixed(1)} pips</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
              <span className="text-sm text-slate-400">Net P&L</span>
              <span className={`text-sm font-mono font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${stats.totalPnL > 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-400">Win/Loss Ratio</span>
              <span className="text-sm font-mono text-slate-300">
                {stats.avgLoss > 0 ? (stats.avgWin / stats.avgLoss).toFixed(2) : 'N/A'}
              </span>
            </div>
          </div>
        </Card>

        {/* Direction comparison */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">Buy vs Sell Performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-400 font-mono">{stats.buyPips > 0 ? '+' : ''}{stats.buyPips.toFixed(0)}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.buyCount} buy trades</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
              <TrendingDown className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-400 font-mono">{stats.sellPips > 0 ? '+' : ''}{stats.sellPips.toFixed(0)}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.sellCount} sell trades</p>
            </div>
          </div>
        </Card>
      </div>

      {/* By pair table */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Performance by Currency Pair</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-800">
                <th className="text-left py-2 px-2">Pair</th>
                <th className="text-right py-2 px-2">Trades</th>
                <th className="text-right py-2 px-2">Win Rate</th>
                <th className="text-right py-2 px-2">Total Pips</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.byPair).sort((a, b) => b[1].pips - a[1].pips).map(([pair, data]) => (
                <tr key={pair} className="border-b border-slate-800/50">
                  <td className="py-2 px-2 font-semibold text-slate-200">{pair}</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-300">{data.trades}</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-300">{((data.wins / data.trades) * 100).toFixed(0)}%</td>
                  <td className={`py-2 px-2 text-right font-mono ${data.pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.pips > 0 ? '+' : ''}{data.pips.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* By strategy table */}
      {Object.keys(stats.byStrategy).length > 1 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Performance by Strategy</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase border-b border-slate-800">
                  <th className="text-left py-2 px-2">Strategy</th>
                  <th className="text-right py-2 px-2">Trades</th>
                  <th className="text-right py-2 px-2">Win Rate</th>
                  <th className="text-right py-2 px-2">Total Pips</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byStrategy).sort((a, b) => b[1].pips - a[1].pips).map(([strategy, data]) => (
                  <tr key={strategy} className="border-b border-slate-800/50">
                    <td className="py-2 px-2 font-semibold text-slate-200">{strategy}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-300">{data.trades}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-300">{((data.wins / data.trades) * 100).toFixed(0)}%</td>
                    <td className={`py-2 px-2 text-right font-mono ${data.pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.pips > 0 ? '+' : ''}{data.pips.toFixed(0)}
                    </td>
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
