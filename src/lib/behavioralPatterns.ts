import type { Trade, BehavioralPattern, EdgeValidation } from './types';
import { MENTAL_LABELS, SESSION_LABELS } from './edgeAnalyzer';
import type { MentalState, TradingSession } from './types';

function isWin(t: Trade): boolean {
  return (t.pips_result ?? 0) > 0;
}

function pips(t: Trade): number {
  return t.pips_result ?? 0;
}

function sortByOpenedAt(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
}

function timeBetweenMinutes(a: Trade, b: Trade): number {
  return (new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()) / 60000;
}

function sameDay(a: Trade, b: Trade): boolean {
  const da = new Date(a.opened_at);
  const db = new Date(b.opened_at);
  return da.toDateString() === db.toDateString();
}

// --- Behavioral pattern detectors ---

function detectRevengeTrading(trades: Trade[]): BehavioralPattern | null {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  if (closed.length < 6) return null;

  let revengeCount = 0;
  let revengePips = 0;
  let normalAfterLossPips = 0;
  let normalAfterLossCount = 0;

  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1];
    const curr = closed[i];
    const prevLost = !isWin(prev);
    const quickEntry = timeBetweenMinutes(prev, curr) < 30;
    const isRevengeMental = curr.mental_state === 'revenge' || curr.mental_state === 'fomo' || curr.mental_state === 'stressed';

    if (prevLost && (quickEntry || isRevengeMental)) {
      revengeCount++;
      revengePips += pips(curr);
    } else if (prevLost && !quickEntry && !isRevengeMental) {
      normalAfterLossCount++;
      normalAfterLossPips += pips(curr);
    }
  }

  if (revengeCount < 2) return null;

  const avgRevenge = revengePips / revengeCount;
  const avgNormal = normalAfterLossCount > 0 ? normalAfterLossPips / normalAfterLossCount : 0;
  const revengeWinRate = closed.filter((_, i) => i > 0 && !isWin(closed[i - 1]) && (timeBetweenMinutes(closed[i - 1], closed[i]) < 30 || closed[i].mental_state === 'revenge' || closed[i].mental_state === 'fomo')).filter(isWin).length / revengeCount;

  const worseThanNormal = avgRevenge < avgNormal - 5;
  if (!worseThanNormal && avgRevenge >= 0) return null;

  return {
    id: 'revenge_trading',
    title: 'Revenge Trading After Losses',
    description: `After a loss, you enter trades within 30 minutes or while emotionally charged ${revengeCount} times. These trades average ${avgRevenge.toFixed(1)} pips vs ${avgNormal.toFixed(1)} pips for your calm post-loss trades.`,
    severity: avgRevenge < -10 ? 'critical' : 'warning',
    evidence: `${revengeCount} revenge entries detected, ${revengeWinRate > 0 ? (revengeWinRate * 100).toFixed(0) : 0}% win rate on these vs your normal post-loss recovery rate`,
    affectedTrades: revengeCount,
    estimatedCost: revengePips,
  };
}

function detectTilt(trades: Trade[]): BehavioralPattern | null {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  if (closed.length < 5) return null;

  let tiltCount = 0;
  let tiltPips = 0;
  let streakStart = -1;

  for (let i = 0; i < closed.length; i++) {
    if (!isWin(closed[i])) {
      if (streakStart === -1) streakStart = i;
      const streakLen = i - streakStart + 1;
      if (streakLen >= 2) {
        const nextTrade = closed[i + 1];
        if (nextTrade && (nextTrade.mental_state === 'revenge' || nextTrade.mental_state === 'fomo' || nextTrade.mental_state === 'stressed' || (timeBetweenMinutes(closed[i], nextTrade) < 15))) {
          tiltCount++;
          tiltPips += pips(nextTrade);
        }
      }
    } else {
      streakStart = -1;
    }
  }

  if (tiltCount < 2) return null;

  return {
    id: 'tilt',
    title: 'Tilt Spiral After Losing Streaks',
    description: `After ${tiltCount} losing streaks of 2+, you immediately entered trades while emotionally compromised or within 15 minutes. These tilt-driven trades cost you ${tiltPips.toFixed(0)} pips.`,
    severity: tiltPips < -20 ? 'critical' : 'warning',
    evidence: `${tiltCount} tilt entries after losing streaks, averaging ${(tiltPips / tiltCount).toFixed(1)} pips per trade`,
    affectedTrades: tiltCount,
    estimatedCost: tiltPips,
  };
}

function detectOvertrading(trades: Trade[]): BehavioralPattern | null {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  if (closed.length < 8) return null;

  const byDay = new Map<string, Trade[]>();
  for (const t of closed) {
    const key = new Date(t.opened_at).toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(t);
  }

  let highVolumeDays = 0;
  let highVolumePips = 0;
  let highVolumeTrades = 0;
  let normalDays = 0;
  let normalPips = 0;
  let normalTrades = 0;

  const avgTradesPerDay = closed.length / byDay.size;
  const threshold = Math.max(4, Math.ceil(avgTradesPerDay * 2));

  for (const [, dayTrades] of byDay) {
    const dayPips = dayTrades.reduce((s, t) => s + pips(t), 0);
    if (dayTrades.length >= threshold) {
      highVolumeDays++;
      highVolumePips += dayPips;
      highVolumeTrades += dayTrades.length;
    } else {
      normalDays++;
      normalPips += dayPips;
      normalTrades += dayTrades.length;
    }
  }

  if (highVolumeDays < 2) return null;

  const avgHigh = highVolumePips / highVolumeTrades;
  const avgNormal = normalDays > 0 ? normalPips / normalTrades : 0;

  if (avgHigh >= avgNormal) return null;

  return {
    id: 'overtrading',
    title: 'Overtrading on High-Volume Days',
    description: `On ${highVolumeDays} days you took ${threshold}+ trades (vs your average of ${avgTradesPerDay.toFixed(1)}). These high-volume days averaged ${avgHigh.toFixed(1)} pips/trade vs ${avgNormal.toFixed(1)} pips/trade on normal days.`,
    severity: avgHigh < -5 ? 'critical' : 'warning',
    evidence: `${highVolumeTrades} trades across ${highVolumeDays} high-volume days, net ${highVolumePips.toFixed(0)} pips`,
    affectedTrades: highVolumeTrades,
    estimatedCost: highVolumePips,
  };
}

function detectEmotionalStateChain(trades: Trade[]): BehavioralPattern | null {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed' && t.mental_state));
  if (closed.length < 8) return null;

  const stateTransitions = new Map<string, { wins: number; total: number; pips: number }>();

  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1];
    const curr = closed[i];
    if (!prev.mental_state || !curr.mental_state) continue;

    const prevLost = !isWin(prev);
    const key = `${prev.mental_state}->${curr.mental_state}`;
    if (!stateTransitions.has(key)) stateTransitions.set(key, { wins: 0, total: 0, pips: 0 });
    const entry = stateTransitions.get(key)!;
    entry.total++;
    entry.pips += pips(curr);
    if (isWin(curr)) entry.wins++;
  }

  let worstTransition: { key: string; entry: { wins: number; total: number; pips: number } } | null = null;
  for (const [key, entry] of stateTransitions) {
    if (entry.total >= 3 && entry.pips < -10) {
      if (!worstTransition || entry.pips < worstTransition.entry.pips) {
        worstTransition = { key, entry };
      }
    }
  }

  if (!worstTransition) return null;

  const [fromState, toState] = worstTransition.key.split('->');
  const fromLabel = MENTAL_LABELS[fromState as MentalState] || fromState;
  const toLabel = MENTAL_LABELS[toState as MentalState] || toState;
  const winRate = (worstTransition.entry.wins / worstTransition.entry.total) * 100;

  return {
    id: 'emotional_chain',
    title: `Emotional Spiral: ${fromLabel} → ${toLabel}`,
    description: `When you feel ${fromLabel.toLowerCase()} and then enter your next trade feeling ${toLabel.toLowerCase()}, you lose ${Math.abs(worstTransition.entry.pips).toFixed(0)} pips with only ${winRate.toFixed(0)}% win rate across ${worstTransition.entry.total} occurrences.`,
    severity: worstTransition.entry.pips < -20 ? 'critical' : 'warning',
    evidence: `${worstTransition.entry.total} transitions, ${winRate.toFixed(0)}% win rate, ${worstTransition.entry.pips.toFixed(0)} pips net`,
    affectedTrades: worstTransition.entry.total,
    estimatedCost: worstTransition.entry.pips,
  };
}

function detectSessionFatigue(trades: Trade[]): BehavioralPattern | null {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  if (closed.length < 10) return null;

  const bySessionTimes = new Map<string, { firstHalf: Trade[]; secondHalf: Trade[] }>();
  for (const t of closed) {
    const session = t.session || 'off_hours';
    if (!bySessionTimes.has(session)) bySessionTimes.set(session, { firstHalf: [], secondHalf: [] });
    const entry = bySessionTimes.get(session)!;
    entry.firstHalf.push(t);
  }

  for (const [, entry] of bySessionTimes) {
    const mid = Math.floor(entry.firstHalf.length / 2);
    entry.secondHalf = entry.firstHalf.slice(mid);
    entry.firstHalf = entry.firstHalf.slice(0, mid);
  }

  let worstSession: { session: string; first: number; second: number; count: number } | null = null;
  for (const [session, { firstHalf, secondHalf }] of bySessionTimes) {
    if (secondHalf.length < 3) continue;
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, t) => s + pips(t), 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.reduce((s, t) => s + pips(t), 0) / secondHalf.length;
    const decline = firstAvg - secondAvg;
    if (decline > 5 && firstAvg > 0) {
      if (!worstSession || decline > (worstSession.first - worstSession.second)) {
        worstSession = { session, first: firstAvg, second: secondAvg, count: secondHalf.length };
      }
    }
  }

  if (!worstSession) return null;

  return {
    id: 'session_fatigue',
    title: `Performance Decay in ${SESSION_LABELS[worstSession.session as TradingSession] || worstSession.session}`,
    description: `Your trades in the ${SESSION_LABELS[worstSession.session as TradingSession] || worstSession.session} start strong (${worstSession.first.toFixed(1)} pips/trade) but drop to ${worstSession.second.toFixed(1)} pips/trade in the second half. You may be experiencing fatigue or loss of focus as the session progresses.`,
    severity: worstSession.first - worstSession.second > 10 ? 'warning' : 'info',
    evidence: `${worstSession.count} trades in declining half, avg dropped from ${worstSession.first.toFixed(1)} to ${worstSession.second.toFixed(1)} pips`,
    affectedTrades: worstSession.count,
    estimatedCost: (worstSession.first - worstSession.second) * worstSession.count,
  };
}

function detectLateSessionImpulse(trades: Trade[]): BehavioralPattern | null {
  const closed = trades.filter((t) => t.status === 'closed');
  if (closed.length < 8) return null;

  const lateTrades = closed.filter((t) => {
    const h = new Date(t.opened_at).getUTCHours();
    return h >= 20 || h < 1;
  });
  const earlyTrades = closed.filter((t) => {
    const h = new Date(t.opened_at).getUTCHours();
    return h >= 7 && h < 20;
  });

  if (lateTrades.length < 3 || earlyTrades.length < 3) return null;

  const lateAvg = lateTrades.reduce((s, t) => s + pips(t), 0) / lateTrades.length;
  const earlyAvg = earlyTrades.reduce((s, t) => s + pips(t), 0) / earlyTrades.length;
  const lateWinRate = (lateTrades.filter(isWin).length / lateTrades.length) * 100;

  if (lateAvg >= earlyAvg - 3) return null;

  return {
    id: 'late_session_impulse',
    title: 'Late-Night Impulse Trading',
    description: `You took ${lateTrades.length} trades between 8 PM and 1 AM UTC, averaging ${lateAvg.toFixed(1)} pips vs ${earlyAvg.toFixed(1)} during normal hours. These late trades have a ${lateWinRate.toFixed(0)}% win rate.`,
    severity: lateAvg < -5 ? 'critical' : 'warning',
    evidence: `${lateTrades.length} late-night trades, ${lateWinRate.toFixed(0)}% win rate, ${lateAvg.toFixed(1)} avg pips`,
    affectedTrades: lateTrades.length,
    estimatedCost: lateTrades.reduce((s, t) => s + pips(t), 0),
  };
}

function detectImpatience(trades: Trade[]): BehavioralPattern | null {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  if (closed.length < 10) return null;

  const gaps: number[] = [];
  for (let i = 1; i < closed.length; i++) {
    gaps.push(timeBetweenMinutes(closed[i - 1], closed[i]));
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)] || 0;

  let quickCount = 0;
  let quickPips = 0;
  let patientCount = 0;
  let patientPips = 0;

  for (let i = 1; i < closed.length; i++) {
    const gap = timeBetweenMinutes(closed[i - 1], closed[i]);
    if (gap < medianGap * 0.3 && medianGap > 60) {
      quickCount++;
      quickPips += pips(closed[i]);
    } else if (gap > medianGap * 1.5) {
      patientCount++;
      patientPips += pips(closed[i]);
    }
  }

  if (quickCount < 3 || patientCount < 3) return null;

  const quickAvg = quickPips / quickCount;
  const patientAvg = patientPips / patientCount;

  if (quickAvg >= patientAvg - 3) return null;

  return {
    id: 'impatience',
    title: 'Impatience is Costing You',
    description: `When you wait patiently between trades (>${(medianGap * 1.5 / 60).toFixed(1)}h gap), you average ${patientAvg.toFixed(1)} pips/trade. When you re-enter quickly (<${(medianGap * 0.3 / 60).toFixed(1)}h gap), you average only ${quickAvg.toFixed(1)} pips/trade. Your patience is an edge.`,
    severity: quickAvg < -5 ? 'warning' : 'info',
    evidence: `${quickCount} impatient entries vs ${patientCount} patient entries, ${quickAvg.toFixed(1)} vs ${patientAvg.toFixed(1)} avg pips`,
    affectedTrades: quickCount,
    estimatedCost: quickPips,
  };
}

function detectFridaySyndrome(trades: Trade[]): BehavioralPattern | null {
  const closed = trades.filter((t) => t.status === 'closed');
  if (closed.length < 10) return null;

  const fridayTrades = closed.filter((t) => {
    const d = t.day_of_week ?? new Date(t.opened_at).getDay();
    return d === 5;
  });
  const otherTrades = closed.filter((t) => {
    const d = t.day_of_week ?? new Date(t.opened_at).getDay();
    return d !== 5 && d !== 6;
  });

  if (fridayTrades.length < 3 || otherTrades.length < 5) return null;

  const fridayAvg = fridayTrades.reduce((s, t) => s + pips(t), 0) / fridayTrades.length;
  const otherAvg = otherTrades.reduce((s, t) => s + pips(t), 0) / otherTrades.length;
  const fridayWinRate = (fridayTrades.filter(isWin).length / fridayTrades.length) * 100;

  if (fridayAvg >= otherAvg - 3) return null;

  return {
    id: 'friday_syndrome',
    title: 'Friday Performance Drop',
    description: `Your Friday trades average ${fridayAvg.toFixed(1)} pips with ${fridayWinRate.toFixed(0)}% win rate, compared to ${otherAvg.toFixed(1)} pips on other weekdays. You may be rushing to close the week or forcing setups before the weekend.`,
    severity: fridayAvg < -5 ? 'warning' : 'info',
    evidence: `${fridayTrades.length} Friday trades, ${fridayWinRate.toFixed(0)}% win rate vs ${(otherTrades.filter(isWin).length / otherTrades.length * 100).toFixed(0)}% on other days`,
    affectedTrades: fridayTrades.length,
    estimatedCost: fridayTrades.reduce((s, t) => s + pips(t), 0),
  };
}

export function detectBehavioralPatterns(trades: Trade[]): BehavioralPattern[] {
  const detectors = [
    detectRevengeTrading,
    detectTilt,
    detectOvertrading,
    detectEmotionalStateChain,
    detectSessionFatigue,
    detectLateSessionImpulse,
    detectImpatience,
    detectFridaySyndrome,
  ];

  const patterns: BehavioralPattern[] = [];
  for (const detector of detectors) {
    const pattern = detector(trades);
    if (pattern) patterns.push(pattern);
  }

  return patterns.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.estimatedCost - b.estimatedCost;
  });
}

// --- Statistical edge validation ---

function logFactorial(n: number): number {
  if (n <= 1) return 0;
  let result = 0;
  for (let i = 2; i <= n; i++) result += Math.log(i);
  return result;
}

function binomialProbability(k: number, n: number, p: number): number {
  if (n === 0) return 1;
  const logCoeff = logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  const logProb = logCoeff + k * Math.log(p) + (n - k) * Math.log(1 - p);
  return Math.exp(logProb);
}

function binomialTest(wins: number, n: number, p0: number): number {
  if (n === 0) return 1;
  let pValue = 0;
  const observed = wins;
  const expected = n * p0;

  if (wins >= expected) {
    for (let k = wins; k <= n; k++) {
      pValue += binomialProbability(k, n, p0);
    }
  } else {
    for (let k = 0; k <= wins; k++) {
      pValue += binomialProbability(k, n, p0);
    }
  }
  return Math.min(pValue, 1);
}

function wilsonInterval(wins: number, n: number, z: number): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 };
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt(p * (1 - p) / n + (z * z) / (4 * n * n));
  return {
    lower: Math.max(0, (center - margin) * 100),
    upper: Math.min(100, (center + margin) * 100),
  };
}

export function validateEdge(trades: Trade[]): EdgeValidation {
  const closed = trades.filter((t) => t.status === 'closed');
  const wins = closed.filter(isWin).length;
  const losses = closed.length - wins;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
  const n = closed.length;

  const pValue = binomialTest(wins, n, 0.5);
  const ci = wilsonInterval(wins, n, 1.96);

  const isSignificant = pValue < 0.05 && n >= 10;
  const sampleAdequate = n >= 30;

  const recommendedTrades = Math.ceil(Math.pow(1.96, 2) * 0.25 / (0.05 * 0.05));

  let verdict: string;
  if (n < 10) {
    verdict = 'Not enough data. Keep logging trades — you need at least 10 for any statistical analysis.';
  } else if (n < 30) {
    if (winRate > 55) {
      verdict = `Your ${winRate.toFixed(0)}% win rate looks promising, but with only ${n} trades this could easily be luck. The true rate is likely between ${ci.lower.toFixed(0)}% and ${ci.upper.toFixed(0)}%. Keep logging to narrow this range.`;
    } else if (winRate < 45) {
      verdict = `Your ${winRate.toFixed(0)}% win rate is below break-even, but with only ${n} trades it's too early to conclude. The true rate could be anywhere from ${ci.lower.toFixed(0)}% to ${ci.upper.toFixed(0)}%.`;
    } else {
      verdict = `Your ${winRate.toFixed(0)}% win rate is near coin-flip territory. With ${n} trades, the confidence interval is ${ci.lower.toFixed(0)}%–${ci.upper.toFixed(0)}% — you need more data to know if you have an edge.`;
    }
  } else {
    if (isSignificant && winRate > 50) {
      verdict = `Statistically significant edge detected. Your ${winRate.toFixed(0)}% win rate over ${n} trades is unlikely to be chance (p=${pValue.toFixed(3)}). The true win rate is likely between ${ci.lower.toFixed(0)}% and ${ci.upper.toFixed(0)}%.`;
    } else if (isSignificant && winRate < 50) {
      verdict = `Statistically significant negative edge. Your ${winRate.toFixed(0)}% win rate over ${n} trades is worse than random (p=${pValue.toFixed(3)}). Something in your system is working against you — review your patterns below.`;
    } else {
      verdict = `No statistically significant edge. Your ${winRate.toFixed(0)}% win rate over ${n} trades is indistinguishable from a coin flip (p=${pValue.toFixed(3)}). You need about ${recommendedTrades} trades for a reliable test. Keep logging and focus on consistency.`;
    }
  }

  return {
    winRate,
    totalTrades: n,
    wins,
    losses,
    isStatisticallySignificant: isSignificant,
    confidenceInterval: ci,
    pValue,
    verdict,
    sampleSizeAdequate: sampleAdequate,
    recommendedTradesForSignificance: recommendedTrades,
  };
}

// --- Behavioral warnings for pre-trade gate ---

export interface BehavioralWarning {
  level: 'stop' | 'friction' | 'awareness';
  message: string;
  detail: string;
}

export function getBehavioralWarnings(trades: Trade[], currentMentalState?: MentalState): BehavioralWarning[] {
  const warnings: BehavioralWarning[] = [];
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  if (closed.length < 3) return warnings;

  const lastTrade = closed[closed.length - 1];
  const lastTwo = closed.slice(-2);
  const recentLosses = lastTwo.filter((t) => !isWin(t)).length;

  // Loss streak gate
  if (recentLosses >= 2) {
    const streakLosses = [];
    for (let i = closed.length - 1; i >= 0; i--) {
      if (!isWin(closed[i])) streakLosses.push(closed[i]);
      else break;
    }
    const streakPips = streakLosses.reduce((s, t) => s + pips(t), 0);
    warnings.push({
      level: 'stop',
      message: `You've lost ${streakLosses.length} trades in a row (${streakPips.toFixed(0)} pips).`,
      detail: 'Your data shows you perform worse after losing streaks. Step away, review these trades, and come back with a clear head. The market will be here tomorrow.',
    });
  }

  // Revenge trading gate
  if (currentMentalState === 'revenge' || currentMentalState === 'fomo') {
    warnings.push({
      level: 'stop',
      message: `You marked your mental state as ${currentMentalState === 'revenge' ? 'Revenge' : 'FOMO'}.`,
      detail: `Your historical data shows trades entered in this state lose significantly more. This is your pattern — not a judgment. Consider waiting until you feel calm or focused before entering.`,
    });
  }

  // Recent overtrading friction
  const todayTrades = closed.filter((t) => sameDay(lastTrade, t));
  if (todayTrades.length >= 4) {
    const todayPips = todayTrades.reduce((s, t) => s + pips(t), 0);
    if (todayPips < 0) {
      warnings.push({
        level: 'friction',
        message: `You've already taken ${todayTrades.length} trades today and are net ${todayPips.toFixed(0)} pips.`,
        detail: 'Your data shows overtrading on red days leads to larger losses. Consider whether this next trade is part of your plan or an attempt to recover.',
      });
    }
  }

  // Quick re-entry after loss
  if (!isWin(lastTrade)) {
    const lastTime = new Date(lastTrade.opened_at).getTime();
    const minutesSince = (Date.now() - lastTime) / 60000;
    if (minutesSince < 30 && closed.length >= 6) {
      warnings.push({
        level: 'friction',
        message: `It's been only ${minutesSince.toFixed(0)} minutes since your last loss.`,
        detail: 'Your pattern data shows quick re-entries after losses perform worse than patient entries. Take a moment to review the last trade before proceeding.',
      });
    }
  }

  // Stressed state awareness
  if (currentMentalState === 'stressed' || currentMentalState === 'tired') {
    warnings.push({
      level: 'awareness',
      message: `You're feeling ${MENTAL_LABELS[currentMentalState].toLowerCase()}.`,
      detail: 'Your past trades in this state have underperformed. This doesn\'t mean skip the trade, but be extra disciplined about your rules and risk management.',
    });
  }

  return warnings;
}
