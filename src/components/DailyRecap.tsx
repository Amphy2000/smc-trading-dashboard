import { useMemo } from 'react';
import type { Trade } from '@/lib/types';
import { Card, Badge } from '@/components/ui';
import { SESSION_LABELS } from '@/lib/edgeAnalyzer';
import {
  TrendingUp, TrendingDown, Activity, Target, Clock,
  Flame, Brain, AlertTriangle, Calendar,
} from 'lucide-react';

interface DailyRecapProps {
  trades: Trade[];
}

function isSameDay(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();
}

export function DailyRecap({ trades }: DailyRecapProps) {
  const today = new Date();

  const todayTrades = useMemo(() => {
    return trades.filter((t) => isSameDay(t.opened_at, today));
  }, [trades, today]);

  const todayClosed = todayTrades.filter((t) => t.status === 'closed');
  const todayOpen = todayTrades.filter((t) => t.status === 'open');
  const wins = todayClosed.filter((t) => (t.pips_result || 0) > 0);
  const losses = todayClosed.filter((t) => (t.pips_result || 0) < 0);
  const totalPips = todayClosed.reduce((s, t) => s + (t.pips_result || 0), 0);
  const winRate = todayClosed.length > 0 ? (wins.length / todayClosed.length) * 100 : 0;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayClosed = trades.filter((t) =>
    t.status === 'closed' && t.closed_at && isSameDay(t.closed_at, yesterday)
  );
  const yesterdayPips = yesterdayClosed.reduce((s, t) => s + (t.pips_result || 0), 0);

  const dayDiff = yesterdayClosed.length > 0 ? totalPips - yesterdayPips : 0;

  const sessions = useMemo(() => {
    const map: Record<string, { trades: number; pips: number }> = {};
    for (const t of todayClosed) {
      const s = t.session || 'off_hours';
      if (!map[s]) map[s] = { trades: 0, pips: 0 };
      map[s].trades++;
      map[s].pips += t.pips_result || 0;
    }
    return Object.entries(map).sort((a, b) => b[1].pips - a[1].pips);
  }, [todayClosed]);

  const bestSession = sessions[0];
  const worstSession = sessions[sessions.length - 1];

  const avgConfidence = todayTrades.length > 0
    ? todayTrades.reduce((s, t) => s + (t.confidence_level || 5), 0) / todayTrades.length
    : 0;

  const mentalStates = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of todayTrades) {
      const m = t.mental_state || 'neutral';
      map[m] = (map[m] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [todayTrades]);

  const dominantMental = mentalStates[0]?.[0];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[today.getDay()];

  if (todayTrades.length === 0) {
    return (
      <Card className="p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{dayName} Recap</h2>
            <p className="text-xs text-slate-500">No trades logged today yet</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Log your first trade of the day to start building your daily recap.
          At the end of the day, you'll see your win rate, best session, and performance vs yesterday — automatically.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">{dayName} Recap</h2>
            <p className="text-xs text-slate-500">
              {todayClosed.length} closed / {todayOpen.length} open today
            </p>
          </div>
        </div>
        {yesterdayClosed.length > 0 && (
          <div className={`text-right ${dayDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            <p className="text-xs text-slate-500">vs yesterday</p>
            <p className="text-sm font-mono font-bold">
              {dayDiff > 0 ? '+' : ''}{dayDiff.toFixed(0)}p
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase">Pips Today</span>
          </div>
          <p className={`text-lg font-bold font-mono ${totalPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPips > 0 ? '+' : ''}{totalPips.toFixed(0)}
          </p>
        </div>

        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase">Win Rate</span>
          </div>
          <p className="text-lg font-bold text-slate-100">{winRate.toFixed(0)}%</p>
          <p className="text-[10px] text-slate-500">{wins.length}W / {losses.length}L</p>
        </div>

        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase">Best Session</span>
          </div>
          {bestSession ? (
            <>
              <p className="text-sm font-semibold text-slate-200 truncate">
                {SESSION_LABELS[bestSession[0] as keyof typeof SESSION_LABELS] || bestSession[0]}
              </p>
              <p className={`text-[10px] font-mono ${bestSession[1].pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {bestSession[1].pips > 0 ? '+' : ''}{bestSession[1].pips.toFixed(0)}p
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">—</p>
          )}
        </div>

        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Brain className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase">Mindset</span>
          </div>
          <p className="text-sm font-semibold text-slate-200 capitalize truncate">
            {dominantMental || 'neutral'}
          </p>
          <p className="text-[10px] text-slate-500">
            {avgConfidence.toFixed(0)}/10 avg confidence
          </p>
        </div>
      </div>

      {todayClosed.length >= 3 && worstSession && bestSession && worstSession[0] !== bestSession[0] && (
        <div className="mt-3 flex items-start gap-2 bg-slate-800/30 rounded-lg p-3">
          {worstSession[1].pips < 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-xs text-slate-400 leading-relaxed">
            Your strongest session today was{' '}
            <span className="text-slate-200 font-medium">
              {SESSION_LABELS[bestSession[0] as keyof typeof SESSION_LABELS] || bestSession[0]}
            </span>
            {' '}({bestSession[1].pips > 0 ? '+' : ''}{bestSession[1].pips.toFixed(0)}p).
            {worstSession[1].pips < 0 && (
              <> Avoid trading during{' '}
                <span className="text-red-400">
                  {SESSION_LABELS[worstSession[0] as keyof typeof SESSION_LABELS] || worstSession[0]}
                </span>{' '}
                — it cost you {worstSession[1].pips.toFixed(0)}p today.</>
            )}
          </p>
        </div>
      )}

      {todayOpen.length > 0 && (
        <div className="mt-3 flex items-center gap-2 bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/10">
          <Flame className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            <span className="text-blue-400 font-medium">{todayOpen.length} open position{todayOpen.length > 1 ? 's' : ''}</span>
            {' — close them and log the exit to complete today\'s recap'}
          </p>
        </div>
      )}
    </Card>
  );
}
