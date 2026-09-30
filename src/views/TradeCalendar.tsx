import { useState, useMemo } from 'react';
import type { Trade } from '@/lib/types';
import { Card, Badge } from '@/components/ui';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Calendar, Target, Activity, Minus,
} from 'lucide-react';

interface CalendarProps {
  trades: Trade[];
}

interface DayStats {
  date: Date;
  trades: Trade[];
  pips: number;
  pnl: number;
  wins: number;
  losses: number;
  winRate: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function TradeCalendar({ trades }: CalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);

  const closedTrades = trades.filter((t) => t.status === 'closed');

  const dayMap = useMemo(() => {
    const map = new Map<string, DayStats>();
    for (const t of closedTrades) {
      const tradeDate = new Date(t.closed_at || t.opened_at);
      const key = `${tradeDate.getFullYear()}-${tradeDate.getMonth()}-${tradeDate.getDate()}`;
      if (!map.has(key)) {
        map.set(key, {
          date: new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate()),
          trades: [],
          pips: 0,
          pnl: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        });
      }
      const day = map.get(key)!;
      day.trades.push(t);
      day.pips += t.pips_result || 0;
      day.pnl += t.profit_loss || 0;
      if ((t.pips_result || 0) > 0) day.wins++;
      else if ((t.pips_result || 0) < 0) day.losses++;
    }
    for (const day of map.values()) {
      const total = day.wins + day.losses;
      day.winRate = total > 0 ? (day.wins / total) * 100 : 0;
    }
    return map;
  }, [closedTrades]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: (DayStats | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${currentYear}-${currentMonth}-${d}`;
      days.push(dayMap.get(key) || null);
    }
    return days;
  }, [currentMonth, currentYear, dayMap]);

  const monthStats = useMemo(() => {
    let totalPips = 0;
    let totalPnl = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let tradingDays = 0;

    for (const day of calendarDays) {
      if (day && day.trades.length > 0) {
        totalPips += day.pips;
        totalPnl += day.pnl;
        totalWins += day.wins;
        totalLosses += day.losses;
        tradingDays++;
      }
    }

    const totalTrades = totalWins + totalLosses;
    return {
      totalPips,
      totalPnl,
      totalWins,
      totalLosses,
      totalTrades,
      tradingDays,
      winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
    };
  }, [calendarDays]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const formatPips = (p: number) => `${p > 0 ? '+' : ''}${p.toFixed(0)}p`;
  const formatPnl = (p: number) => `${p > 0 ? '+' : ''}$${p.toFixed(2)}`;

  const getDayBg = (day: DayStats | null): string => {
    if (!day) return '';
    if (day.pips > 0) {
      const intensity = Math.min(Math.abs(day.pips) / 100, 1);
      return `rgba(34, 197, 94, ${0.08 + intensity * 0.15})`;
    }
    if (day.pips < 0) {
      const intensity = Math.min(Math.abs(day.pips) / 100, 1);
      return `rgba(239, 68, 68, ${0.08 + intensity * 0.15})`;
    }
    return 'rgba(100, 116, 139, 0.05)';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" /> Trade Calendar
        </h1>
        <p className="text-sm text-slate-500 mt-1">Visualize your daily P/L and trading patterns on a calendar</p>
      </div>

      {closedTrades.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No closed trades yet</p>
          <p className="text-sm text-slate-500 mt-1">Close some trades to see them appear on the calendar.</p>
        </Card>
      ) : (
        <>
          {/* Month summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-xs text-slate-400 uppercase">Month Pips</p>
              </div>
              <p className={`text-2xl font-bold font-mono ${monthStats.totalPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {monthStats.totalPips > 0 ? '+' : ''}{monthStats.totalPips.toFixed(0)}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs text-slate-400 uppercase">Month P&L</span>
              </div>
              <p className={`text-2xl font-bold font-mono ${monthStats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {monthStats.totalPnl > 0 ? '+' : ''}${monthStats.totalPnl.toFixed(2)}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-xs text-slate-400 uppercase">Win Rate</p>
              </div>
              <p className={`text-2xl font-bold font-mono ${monthStats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {monthStats.winRate.toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500">{monthStats.totalWins}W / {monthStats.totalLosses}L</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-xs text-slate-400 uppercase">Trading Days</p>
              </div>
              <p className="text-2xl font-bold font-mono text-slate-200">{monthStats.tradingDays}</p>
              <p className="text-xs text-slate-500">{monthStats.totalTrades} trades</p>
            </Card>
          </div>

          {/* Calendar */}
          <Card className="p-4 sm:p-6">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base sm:text-lg font-semibold text-slate-100 min-w-[140px] text-center">
                  {MONTHS[currentMonth]} {currentYear}
                </h2>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={goToToday}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Today
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-center text-[10px] sm:text-xs text-slate-500 font-medium uppercase py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((day, i) => {
                if (!day) {
                  return <div key={i} className="aspect-square rounded-lg bg-slate-900/30" />;
                }

                const isToday = sameDay(day.date, today);
                const isSelected = selectedDay && sameDay(day.date, selectedDay.date);
                const hasTrades = day.trades.length > 0;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`aspect-square rounded-lg p-1 sm:p-1.5 flex flex-col items-center justify-center transition-all border ${
                      isSelected
                        ? 'border-blue-500 ring-1 ring-blue-500/30'
                        : isToday
                        ? 'border-blue-500/40'
                        : 'border-transparent hover:border-slate-700'
                    } ${hasTrades ? 'cursor-pointer' : 'cursor-default'}`}
                    style={{ backgroundColor: getDayBg(day) }}
                  >
                    <span className={`text-xs sm:text-sm font-medium ${
                      isToday ? 'text-blue-400 font-bold' : hasTrades ? 'text-slate-200' : 'text-slate-600'
                    }`}>
                      {day.date.getDate()}
                    </span>
                    {hasTrades && (
                      <>
                        <span className={`text-[9px] sm:text-[10px] font-mono font-bold ${
                          day.pips > 0 ? 'text-green-400' : day.pips < 0 ? 'text-red-400' : 'text-slate-400'
                        }`}>
                          {formatPips(day.pips)}
                        </span>
                        <span className="text-[8px] text-slate-500 hidden sm:block">
                          {day.trades.length}T
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-500/20" /> Profit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500/20" /> Loss
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-500/10" /> No trades
              </span>
            </div>
          </Card>

          {/* Selected day detail */}
          {selectedDay && (
            <Card className="p-5 border-blue-500/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedDay.trades.length} trade{selectedDay.trades.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold font-mono ${selectedDay.pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPips(selectedDay.pips)}
                  </p>
                  <p className={`text-xs font-mono ${selectedDay.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPnl(selectedDay.pnl)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Win Rate</p>
                  <p className={`text-lg font-bold font-mono ${selectedDay.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedDay.winRate.toFixed(0)}%
                  </p>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Wins</p>
                  <p className="text-lg font-bold font-mono text-green-400">{selectedDay.wins}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Losses</p>
                  <p className="text-lg font-bold font-mono text-red-400">{selectedDay.losses}</p>
                </div>
              </div>

              {/* Trade list */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {selectedDay.trades.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 px-3 bg-slate-800/30 rounded-lg gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {t.direction === 'BUY'
                        ? <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
                        : <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      <span className="text-sm text-slate-200 font-medium">{t.pair}</span>
                      <Badge variant={t.direction === 'BUY' ? 'success' : 'danger'}>{t.direction}</Badge>
                      {t.setup_type && (
                        <span className="text-xs text-slate-500 hidden sm:inline">{t.setup_type}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-sm font-mono font-bold ${(t.pips_result || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPips(t.pips_result || 0)}
                      </span>
                      {(t.profit_loss || 0) !== 0 && (
                        <span className={`text-xs font-mono hidden sm:inline ${(t.profit_loss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPnl(t.profit_loss || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Best/worst day callout */}
          {monthStats.tradingDays > 0 && !selectedDay && (() => {
            const tradingDays = calendarDays.filter((d): d is DayStats => d !== null && d.trades.length > 0);
            if (tradingDays.length === 0) return null;
            const best = tradingDays.reduce((a, b) => a.pips > b.pips ? a : b);
            const worst = tradingDays.reduce((a, b) => a.pips < b.pips ? a : b);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4 bg-green-500/5 border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-slate-400 uppercase">Best Day</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    {best.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-lg font-bold font-mono text-green-400">{formatPips(best.pips)}</p>
                  <p className="text-xs text-slate-500">{best.trades.length} trades · {best.winRate.toFixed(0)}% WR</p>
                </Card>
                <Card className="p-4 bg-red-500/5 border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-slate-400 uppercase">Worst Day</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    {worst.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-lg font-bold font-mono text-red-400">{formatPips(worst.pips)}</p>
                  <p className="text-xs text-slate-500">{worst.trades.length} trades · {worst.winRate.toFixed(0)}% WR</p>
                </Card>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
