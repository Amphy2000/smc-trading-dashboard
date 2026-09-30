import type { Trade, EdgeInsight, HeatmapCell, ConfluenceStats, PreTradeScore, TradingSession, MentalState, TradeConfig } from './types';

// Preset libraries for different trading styles
export const STYLE_PRESETS: Record<string, { label: string; setupTypes: string[]; confluences: string[] }> = {
  smc: {
    label: 'Smart Money Concepts (SMC)',
    setupTypes: ['Order Block', 'Fair Value Gap', 'Liquidity Sweep', 'Break & Retest', 'CHoCH / BOS', 'Trend Pullback', 'Range Reversal', 'News Spike', 'Other'],
    confluences: ['HTF Bias Aligned', 'MTF at POI', 'LTF MSS / CHoCH', 'Liquidity Sweep', 'FVG Fill', 'OB Mitigation', 'R:R Ratio Met', 'Premium/Discount Zone', 'News-Aware Entry'],
  },
  price_action: {
    label: 'Price Action',
    setupTypes: ['Pin Bar', 'Engulfing', 'Inside Bar', 'Support/Resistance Bounce', 'Trendline Bounce', 'Breakout', 'Failed Breakout', 'Double Top/Bottom', 'Other'],
    confluences: ['Key Level', 'Trend Alignment', 'Multiple Touch', 'Round Number', 'Higher Timeframe Confirmation', 'R:R Ratio Met', 'News-Aware Entry', 'Session Timing', 'Clean Price Action'],
  },
  ict: {
    label: 'ICT Concepts',
    setupTypes: ['Order Block', 'Fair Value Gap', 'Liquidity Sweep', 'Silver Bullet', 'Asian Range', 'Judas Swing', 'Power of 3 (AMD)', 'Turtle Soup', 'Other'],
    confluences: ['Draw on Liquidity', 'Killzone Timing', 'HTF Narrative', 'FVG Fill', 'OB Mitigation', 'Liquidity Raid', 'R:R Ratio Met', 'News Event', 'Equilibrium'],
  },
  indicator: {
    label: 'Indicator-Based',
    setupTypes: ['RSI Divergence', 'MACD Crossover', 'EMA Crossover', 'Bollinger Bounce', 'Stochastic Reversal', 'VWAP Bounce', 'Fibonacci Retracement', 'Pivot Point', 'Other'],
    confluences: ['Trend Filter', 'Volume Confirmation', 'Multiple Indicator Agreement', 'Support/Resistance', 'R:R Ratio Met', 'Session Timing', 'News-Aware', 'Divergence', 'Overbought/Oversold'],
  },
  custom: {
    label: 'Custom',
    setupTypes: ['Setup A', 'Setup B', 'Setup C', 'Other'],
    confluences: ['Confluence A', 'Confluence B', 'Confluence C', 'R:R Ratio Met'],
  },
};

export const DEFAULT_CONFIG: TradeConfig = {
  setupTypes: STYLE_PRESETS.smc.setupTypes,
  confluences: STYLE_PRESETS.smc.confluences,
};

export function getConfigFromSettings(settings: { custom_setup_types?: string[] | null; custom_confluences?: string[] | null; trading_style?: string | null }): TradeConfig {
  const style = settings.trading_style || 'smc';
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.smc;
  return {
    setupTypes: settings.custom_setup_types || preset.setupTypes,
    confluences: settings.custom_confluences || preset.confluences,
  };
}

export const SESSION_LABELS: Record<TradingSession, string> = {
  asia: 'Asian Session',
  london: 'London Session',
  new_york: 'New York Session',
  overlap: 'London/NY Overlap',
  off_hours: 'Off Hours',
};

export const MENTAL_LABELS: Record<MentalState, string> = {
  focused: 'Focused',
  calm: 'Calm',
  neutral: 'Neutral',
  tired: 'Tired',
  stressed: 'Stressed',
  fomo: 'FOMO',
  revenge: 'Revenge',
  confident: 'Confident',
};

export const EXIT_LABELS: Record<string, string> = {
  target: 'Take Profit Hit',
  stop: 'Stop Loss Hit',
  manual: 'Manual Exit',
  trailing: 'Trailing Stop',
  time_exit: 'Time-Based Exit',
  breakeven: 'Breakeven',
  fear: 'Exited in Fear',
  greed: 'Held Too Long (Greed)',
  revenge_close: 'Revenge Close',
};

export function getSessionFromTime(date: Date): TradingSession {
  const hourUTC = date.getUTCHours();
  if (hourUTC >= 12 && hourUTC < 17) return 'overlap';
  if (hourUTC >= 7 && hourUTC < 12) return 'london';
  if (hourUTC >= 17 && hourUTC < 21) return 'new_york';
  if (hourUTC >= 0 && hourUTC < 7) return 'asia';
  return 'off_hours';
}

export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function winsCount(t: Trade): boolean {
  return (t.pips_result ?? 0) > 0;
}

function groupStats(trades: Trade[]): { wins: number; totalPips: number; count: number; avgPips: number; winRate: number } {
  const wins = trades.filter(winsCount).length;
  const totalPips = trades.reduce((s, t) => s + (t.pips_result ?? 0), 0);
  const count = trades.length;
  return {
    wins,
    totalPips,
    count,
    avgPips: count > 0 ? totalPips / count : 0,
    winRate: count > 0 ? (wins / count) * 100 : 0,
  };
}

export function bySession(trades: Trade[]): HeatmapCell[] {
  const closed = trades.filter((t) => t.status === 'closed');
  const groups: Record<string, Trade[]> = {};
  for (const t of closed) {
    const key = t.session || getSessionFromTime(new Date(t.opened_at));
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups).map(([key, ts]) => {
    const s = groupStats(ts);
    return {
      label: SESSION_LABELS[key as TradingSession] || key,
      winRate: s.winRate,
      totalPips: s.totalPips,
      tradeCount: s.count,
      avgPips: s.avgPips,
    };
  }).sort((a, b) => b.totalPips - a.totalPips);
}

export function byDayOfWeek(trades: Trade[]): HeatmapCell[] {
  const closed = trades.filter((t) => t.status === 'closed');
  const groups: Trade[][] = Array.from({ length: 7 }, () => []);
  for (const t of closed) {
    const day = t.day_of_week ?? getDayOfWeek(new Date(t.opened_at));
    if (groups[day]) groups[day].push(t);
  }
  return groups.map((ts, i) => {
    const s = groupStats(ts);
    return {
      label: DAY_NAMES[i],
      winRate: s.winRate,
      totalPips: s.totalPips,
      tradeCount: s.count,
      avgPips: s.avgPips,
    };
  }).filter((c) => c.tradeCount > 0);
}

export function byHourOfDay(trades: Trade[]): HeatmapCell[] {
  const closed = trades.filter((t) => t.status === 'closed');
  const groups: Record<number, Trade[]> = {};
  for (const t of closed) {
    const hour = new Date(t.opened_at).getUTCHours();
    if (!groups[hour]) groups[hour] = [];
    groups[hour].push(t);
  }
  return Array.from({ length: 24 }, (_, h) => {
    const ts = groups[h] || [];
    const s = groupStats(ts);
    return {
      label: `${h.toString().padStart(2, '0')}:00`,
      winRate: s.winRate,
      totalPips: s.totalPips,
      tradeCount: s.count,
      avgPips: s.avgPips,
    };
  }).filter((c) => c.tradeCount > 0);
}

export function bySetupType(trades: Trade[]): HeatmapCell[] {
  const closed = trades.filter((t) => t.status === 'closed' && t.setup_type);
  const groups: Record<string, Trade[]> = {};
  for (const t of closed) {
    const key = t.setup_type!;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups).map(([key, ts]) => {
    const s = groupStats(ts);
    return {
      label: key,
      winRate: s.winRate,
      totalPips: s.totalPips,
      tradeCount: s.count,
      avgPips: s.avgPips,
    };
  }).sort((a, b) => b.totalPips - a.totalPips);
}

export function byMentalState(trades: Trade[]): HeatmapCell[] {
  const closed = trades.filter((t) => t.status === 'closed' && t.mental_state);
  const groups: Record<string, Trade[]> = {};
  for (const t of closed) {
    const key = t.mental_state!;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups).map(([key, ts]) => {
    const s = groupStats(ts);
    return {
      label: MENTAL_LABELS[key as MentalState] || key,
      winRate: s.winRate,
      totalPips: s.totalPips,
      tradeCount: s.count,
      avgPips: s.avgPips,
    };
  }).sort((a, b) => b.winRate - a.winRate);
}

export function byConfidenceLevel(trades: Trade[]): HeatmapCell[] {
  const closed = trades.filter((t) => t.status === 'closed' && t.confidence_level != null);
  const buckets: Record<string, Trade[]> = { '1-3': [], '4-6': [], '7-8': [], '9-10': [] };
  for (const t of closed) {
    const c = t.confidence_level!;
    if (c <= 3) buckets['1-3'].push(t);
    else if (c <= 6) buckets['4-6'].push(t);
    else if (c <= 8) buckets['7-8'].push(t);
    else buckets['9-10'].push(t);
  }
  return Object.entries(buckets).map(([key, ts]) => {
    const s = groupStats(ts);
    return {
      label: `Confidence ${key}`,
      winRate: s.winRate,
      totalPips: s.totalPips,
      tradeCount: s.count,
      avgPips: s.avgPips,
    };
  }).filter((c) => c.tradeCount > 0);
}

export function byPair(trades: Trade[]): HeatmapCell[] {
  const closed = trades.filter((t) => t.status === 'closed');
  const groups: Record<string, Trade[]> = {};
  for (const t of closed) {
    if (!groups[t.pair]) groups[t.pair] = [];
    groups[t.pair].push(t);
  }
  return Object.entries(groups).map(([key, ts]) => {
    const s = groupStats(ts);
    return {
      label: key,
      winRate: s.winRate,
      totalPips: s.totalPips,
      tradeCount: s.count,
      avgPips: s.avgPips,
    };
  }).sort((a, b) => b.totalPips - a.totalPips);
}

export function byDirection(trades: Trade[]): { buy: HeatmapCell; sell: HeatmapCell } {
  const closed = trades.filter((t) => t.status === 'closed');
  const buys = closed.filter((t) => t.direction === 'BUY');
  const sells = closed.filter((t) => t.direction === 'SELL');
  const bs = groupStats(buys);
  const ss = groupStats(sells);
  return {
    buy: { label: 'Buy', winRate: bs.winRate, totalPips: bs.totalPips, tradeCount: bs.count, avgPips: bs.avgPips },
    sell: { label: 'Sell', winRate: ss.winRate, totalPips: ss.totalPips, tradeCount: ss.count, avgPips: ss.avgPips },
  };
}

export function confluenceStats(trades: Trade[]): ConfluenceStats[] {
  const closed = trades.filter((t) => t.status === 'closed' && t.confluences && t.confluences.length > 0);
  const stats: Record<string, { wins: number; totalPips: number; count: number }> = {};
  for (const t of closed) {
    for (const c of t.confluences!) {
      if (!stats[c]) stats[c] = { wins: 0, totalPips: 0, count: 0 };
      stats[c].count++;
      stats[c].totalPips += t.pips_result ?? 0;
      if (winsCount(t)) stats[c].wins++;
    }
  }
  return Object.entries(stats).map(([c, s]) => ({
    confluence: c,
    trades: s.count,
    wins: s.wins,
    winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0,
    avgPips: s.count > 0 ? s.totalPips / s.count : 0,
    totalPips: s.totalPips,
  })).sort((a, b) => b.winRate - a.winRate);
}

export function counterfactualAnalysis(trades: Trade[]): {
  avgMoneyLeftOnTable: number;
  avgAdverseBeforeWin: number;
  earlyExitCount: number;
  lateExitCount: number;
  insights: string[];
} {
  const closed = trades.filter(
    (t) => t.status === 'closed' && t.max_favorable_pips != null && t.pips_result != null
  );
  if (closed.length === 0) {
    return { avgMoneyLeftOnTable: 0, avgAdverseBeforeWin: 0, earlyExitCount: 0, lateExitCount: 0, insights: [] };
  }

  let totalLeftOnTable = 0;
  let earlyExitCount = 0;
  let lateExitCount = 0;
  let adverseBeforeWin = 0;
  let winCount = 0;

  for (const t of closed) {
    const mfe = t.max_favorable_pips!;
    const result = t.pips_result!;

    if (mfe > result && mfe > 0) {
      totalLeftOnTable += mfe - result;
      if (result > 0) earlyExitCount++;
    }

    if (result < 0 && t.max_adverse_pips != null && Math.abs(t.max_adverse_pips) > Math.abs(result)) {
      lateExitCount++;
    }

    if (result > 0 && t.max_adverse_pips != null) {
      adverseBeforeWin += Math.abs(t.max_adverse_pips);
      winCount++;
    }
  }

  const insights: string[] = [];
  const avgLeft = totalLeftOnTable / closed.length;

  if (earlyExitCount > 0) {
    insights.push(
      `You exited early on ${earlyExitCount} winning trade${earlyExitCount > 1 ? 's' : ''}, leaving an average of ${avgLeft.toFixed(1)} pips on the table per trade.`
    );
  }
  if (lateExitCount > 0) {
    insights.push(
      `You held ${lateExitCount} losing trade${lateExitCount > 1 ? 's' : ''} past your initial adverse excursion — consider tighter stops or faster acceptance of losses.`
    );
  }
  if (winCount > 0) {
    const avgAdv = adverseBeforeWin / winCount;
    insights.push(
      `Winning trades dipped an average of ${avgAdv.toFixed(1)} pips before going your way — your stop placement needs at least this much room.`
    );
  }

  return {
    avgMoneyLeftOnTable: avgLeft,
    avgAdverseBeforeWin: winCount > 0 ? adverseBeforeWin / winCount : 0,
    earlyExitCount,
    lateExitCount,
    insights,
  };
}

export function generateEdgeInsights(trades: Trade[]): EdgeInsight[] {
  const closed = trades.filter((t) => t.status === 'closed');
  if (closed.length < 3) return [];

  const insights: EdgeInsight[] = [];

  // Best session
  const sessions = bySession(closed);
  if (sessions.length > 0) {
    const best = sessions[0];
    const worst = sessions[sessions.length - 1];
    if (best.tradeCount >= 2) {
      insights.push({
        category: 'Session',
        label: 'Best Trading Session',
        value: best.label,
        detail: `${best.winRate.toFixed(0)}% win rate, +${best.totalPips.toFixed(0)} pips over ${best.tradeCount} trades`,
        isPositive: best.totalPips > 0,
        sampleSize: best.tradeCount,
      });
    }
    if (worst.tradeCount >= 2 && worst.totalPips < 0) {
      insights.push({
        category: 'Session',
        label: 'Worst Trading Session',
        value: worst.label,
        detail: `${worst.winRate.toFixed(0)}% win rate, ${worst.totalPips.toFixed(0)} pips over ${worst.tradeCount} trades — consider avoiding this session`,
        isPositive: false,
        sampleSize: worst.tradeCount,
      });
    }
  }

  // Best setup
  const setups = bySetupType(closed);
  if (setups.length > 0) {
    const best = setups[0];
    if (best.tradeCount >= 2) {
      insights.push({
        category: 'Setup',
        label: 'Most Profitable Setup',
        value: best.label,
        detail: `${best.winRate.toFixed(0)}% win rate, +${best.totalPips.toFixed(0)} pips over ${best.tradeCount} trades`,
        isPositive: best.totalPips > 0,
        sampleSize: best.tradeCount,
      });
    }
  }

  // Best pair
  const pairs = byPair(closed);
  if (pairs.length > 0) {
    const best = pairs[0];
    if (best.tradeCount >= 2) {
      insights.push({
        category: 'Pair',
        label: 'Best Currency Pair',
        value: best.label,
        detail: `${best.winRate.toFixed(0)}% win rate, +${best.totalPips.toFixed(0)} pips over ${best.tradeCount} trades`,
        isPositive: best.totalPips > 0,
        sampleSize: best.tradeCount,
      });
    }
  }

  // Mental state correlation
  const mental = byMentalState(closed);
  if (mental.length > 0) {
    const best = mental[0];
    const worst = mental[mental.length - 1];
    if (best.tradeCount >= 2) {
      insights.push({
        category: 'Psychology',
        label: 'Best Mental State',
        value: best.label,
        detail: `${best.winRate.toFixed(0)}% win rate when feeling ${best.label.toLowerCase()} — trade more in this state`,
        isPositive: best.totalPips > 0,
        sampleSize: best.tradeCount,
      });
    }
    if (worst.tradeCount >= 2 && worst.totalPips < 0) {
      insights.push({
        category: 'Psychology',
        label: 'Dangerous Mental State',
        value: worst.label,
        detail: `${worst.winRate.toFixed(0)}% win rate, ${worst.totalPips.toFixed(0)} pips when feeling ${worst.label.toLowerCase()} — stop trading in this state`,
        isPositive: false,
        sampleSize: worst.tradeCount,
      });
    }
  }

  // Confidence calibration
  const confidence = byConfidenceLevel(closed);
  if (confidence.length >= 2) {
    const high = confidence.find((c) => c.label.includes('9-10') || c.label.includes('7-8'));
    const low = confidence.find((c) => c.label.includes('1-3') || c.label.includes('4-6'));
    if (high && low && high.tradeCount >= 2 && low.tradeCount >= 2) {
      const calibrated = high.winRate > low.winRate;
      insights.push({
        category: 'Confidence',
        label: calibrated ? 'Confidence is Calibrated' : 'Confidence is NOT Calibrated',
        value: `${high.winRate.toFixed(0)}% vs ${low.winRate.toFixed(0)}%`,
        detail: calibrated
          ? `Your high-confidence trades win ${high.winRate.toFixed(0)}% vs ${low.winRate.toFixed(0)}% for low-confidence — trust your gut`
          : `Your high-confidence trades win ${high.winRate.toFixed(0)}% vs ${low.winRate.toFixed(0)}% for low-confidence — your gut is not predicting outcomes`,
        isPositive: calibrated,
        sampleSize: high.tradeCount + low.tradeCount,
      });
    }
  }

  // Day of week
  const days = byDayOfWeek(closed);
  if (days.length > 0) {
    const best = [...days].sort((a, b) => b.totalPips - a.totalPips)[0];
    const worst = [...days].sort((a, b) => a.totalPips - b.totalPips)[0];
    if (best.tradeCount >= 2 && best.totalPips > 0) {
      insights.push({
        category: 'Day',
        label: 'Best Day to Trade',
        value: best.label,
        detail: `${best.winRate.toFixed(0)}% win rate, +${best.totalPips.toFixed(0)} pips over ${best.tradeCount} trades`,
        isPositive: true,
        sampleSize: best.tradeCount,
      });
    }
    if (worst.tradeCount >= 2 && worst.totalPips < 0) {
      insights.push({
        category: 'Day',
        label: 'Worst Day to Trade',
        value: worst.label,
        detail: `${worst.winRate.toFixed(0)}% win rate, ${worst.totalPips.toFixed(0)} pips over ${worst.tradeCount} trades`,
        isPositive: false,
        sampleSize: worst.tradeCount,
      });
    }
  }

  // Direction bias
  const dir = byDirection(closed);
  if (dir.buy.tradeCount >= 2 || dir.sell.tradeCount >= 2) {
    if (dir.buy.totalPips !== dir.sell.totalPips) {
      const better = dir.buy.totalPips > dir.sell.totalPips ? dir.buy : dir.sell;
      insights.push({
        category: 'Direction',
        label: 'Directional Edge',
        value: better.label,
        detail: `${better.winRate.toFixed(0)}% win rate, ${better.totalPips > 0 ? '+' : ''}${better.totalPips.toFixed(0)} pips on ${better.label.toLowerCase()} trades`,
        isPositive: better.totalPips > 0,
        sampleSize: better.tradeCount,
      });
    }
  }

  // Counterfactual
  const cf = counterfactualAnalysis(closed);
  if (cf.earlyExitCount > 0) {
    insights.push({
      category: 'Exit Quality',
      label: 'Early Exit Problem',
      value: `${cf.earlyExitCount} trades`,
      detail: `You left an average of ${cf.avgMoneyLeftOnTable.toFixed(1)} pips on the table by exiting winning trades early`,
      isPositive: false,
      sampleSize: cf.earlyExitCount,
    });
  }

  return insights;
}

export function scorePreTrade(
  trades: Trade[],
  params: {
    pair: string;
    direction: 'BUY' | 'SELL';
    session: TradingSession;
    setupType: string;
    confidence: number;
    mentalState: MentalState;
    confluences: string[];
    dayOfWeek: number;
  }
): PreTradeScore {
  const closed = trades.filter((t) => t.status === 'closed');
  const insights: string[] = [];

  if (closed.length < 5) {
    return {
      score: 50,
      recommendation: 'caution',
      matchedHistory: closed.length,
      historicalWinRate: 0,
      historicalAvgPips: 0,
      insights: ['Not enough trade history yet — log at least 5 trades to get meaningful predictions.'],
    };
  }

  let score = 50;
  let matchedTrades: Trade[] = [];

  // Match by pair
  const pairMatches = closed.filter((t) => t.pair === params.pair);
  if (pairMatches.length >= 2) {
    const s = groupStats(pairMatches);
    if (s.winRate >= 55) {
      score += 8;
      insights.push(`You perform well on ${params.pair}: ${s.winRate.toFixed(0)}% win rate over ${s.count} trades.`);
    } else if (s.winRate < 40) {
      score -= 10;
      insights.push(`You struggle with ${params.pair}: only ${s.winRate.toFixed(0)}% win rate over ${s.count} trades.`);
    }
    matchedTrades = pairMatches;
  }

  // Match by setup type
  const setupMatches = closed.filter((t) => t.setup_type === params.setupType);
  if (setupMatches.length >= 2) {
    const s = groupStats(setupMatches);
    if (s.winRate >= 55) {
      score += 10;
      insights.push(`Your "${params.setupType}" setups win ${s.winRate.toFixed(0)}% of the time.`);
    } else if (s.winRate < 40) {
      score -= 12;
      insights.push(`Your "${params.setupType}" setups only win ${s.winRate.toFixed(0)}% — be cautious.`);
    }
    matchedTrades = matchedTrades.length > 0 ? matchedTrades.filter((t) => t.setup_type === params.setupType) : setupMatches;
  }

  // Match by session
  const sessionMatches = closed.filter((t) => {
    const ts = t.session || getSessionFromTime(new Date(t.opened_at));
    return ts === params.session;
  });
  if (sessionMatches.length >= 2) {
    const s = groupStats(sessionMatches);
    if (s.winRate >= 55) {
      score += 7;
      insights.push(`The ${SESSION_LABELS[params.session]} is profitable for you: ${s.winRate.toFixed(0)}% win rate.`);
    } else if (s.winRate < 40) {
      score -= 8;
      insights.push(`The ${SESSION_LABELS[params.session]} is unprofitable for you: ${s.winRate.toFixed(0)}% win rate.`);
    }
  }

  // Match by mental state
  const mentalMatches = closed.filter((t) => t.mental_state === params.mentalState);
  if (mentalMatches.length >= 2) {
    const s = groupStats(mentalMatches);
    if (s.winRate >= 55) {
      score += 8;
      insights.push(`When you feel ${MENTAL_LABELS[params.mentalState].toLowerCase()}, you win ${s.winRate.toFixed(0)}% of the time.`);
    } else if (s.winRate < 40) {
      score -= 15;
      insights.push(`When you feel ${MENTAL_LABELS[params.mentalState].toLowerCase()}, you only win ${s.winRate.toFixed(0)}% — strongly consider sitting this one out.`);
    }
  }

  // Match by day of week
  const dayMatches = closed.filter((t) => {
    const d = t.day_of_week ?? getDayOfWeek(new Date(t.opened_at));
    return d === params.dayOfWeek;
  });
  if (dayMatches.length >= 3) {
    const s = groupStats(dayMatches);
    if (s.winRate < 35) {
      score -= 8;
      insights.push(`This day of week has been unprofitable for you: ${s.winRate.toFixed(0)}% win rate.`);
    } else if (s.winRate >= 60) {
      score += 5;
      insights.push(`This day of week is strong for you: ${s.winRate.toFixed(0)}% win rate.`);
    }
  }

  // Match by direction
  const dirMatches = closed.filter((t) => t.direction === params.direction);
  if (dirMatches.length >= 3) {
    const s = groupStats(dirMatches);
    if (s.winRate >= 58) {
      score += 5;
      insights.push(`Your ${params.direction} trades perform well: ${s.winRate.toFixed(0)}% win rate.`);
    } else if (s.winRate < 38) {
      score -= 7;
      insights.push(`Your ${params.direction} trades underperform: ${s.winRate.toFixed(0)}% win rate.`);
    }
  }

  // Confluence scoring
  const confStats = confluenceStats(closed);
  for (const c of params.confluences) {
    const stat = confStats.find((s) => s.confluence === c);
    if (stat && stat.trades >= 2) {
      if (stat.winRate >= 60) {
        score += 4;
        insights.push(`"${c}" has been a strong confluence: ${stat.winRate.toFixed(0)}% win rate.`);
      } else if (stat.winRate < 35) {
        score -= 3;
        insights.push(`"${c}" has not been helpful: ${stat.winRate.toFixed(0)}% win rate.`);
      }
    }
  }

  // Confidence calibration penalty
  const highConfTrades = closed.filter((t) => t.confidence_level != null && t.confidence_level >= 7);
  if (highConfTrades.length >= 3) {
    const s = groupStats(highConfTrades);
    if (params.confidence >= 7 && s.winRate < 45) {
      score -= 8;
      insights.push(`Your high-confidence trades only win ${s.winRate.toFixed(0)}% — your confidence is not well-calibrated yet.`);
    } else if (params.confidence >= 7 && s.winRate >= 60) {
      score += 5;
      insights.push(`Your high-confidence trades win ${s.winRate.toFixed(0)}% — trust this setup.`);
    }
  }

  // Streak detection
  const recent = closed.slice(-5);
  const recentLosses = recent.filter((t) => !winsCount(t)).length;
  if (recentLosses >= 4) {
    score -= 15;
    insights.push(`You've lost ${recentLosses} of your last ${recent.length} trades — consider stepping back and reviewing before entering.`);
  } else if (recentLosses <= 1 && recent.length >= 4) {
    score += 5;
    insights.push(`You're on a good run: only ${recentLosses} loss in last ${recent.length} trades.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const finalMatched = matchedTrades.length > 0 ? matchedTrades : closed;
  const finalStats = groupStats(finalMatched);

  let recommendation: PreTradeScore['recommendation'] = 'caution';
  if (score >= 75) recommendation = 'strong_take';
  else if (score >= 60) recommendation = 'take';
  else if (score >= 40) recommendation = 'caution';
  else recommendation = 'avoid';

  if (insights.length === 0) {
    insights.push('Not enough matched history for specific insights — proceed with standard risk management.');
  }

  return {
    score,
    recommendation,
    matchedHistory: finalMatched.length,
    historicalWinRate: finalStats.winRate,
    historicalAvgPips: finalStats.avgPips,
    insights,
  };
}
