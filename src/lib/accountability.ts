import type { Trade } from './types';
import { isTradeTagged } from './types';
import { MENTAL_LABELS } from './edgeAnalyzer';
import type { MentalState } from './types';

function isWin(t: Trade): boolean {
  return (t.pips_result ?? 0) > 0;
}

function pips(t: Trade): number {
  return t.pips_result ?? 0;
}

function sortByOpenedAt(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
}

export interface AccountabilityStreak {
  current: number;
  longest: number;
  brokenCount: number;
  totalTagged: number;
  message: string;
  level: 'excellent' | 'good' | 'building' | 'broken';
}

export interface RuleViolation {
  trade: Trade;
  rule: string;
  detail: string;
}

const GOOD_STATES: MentalState[] = ['focused', 'calm', 'confident'];
const BAD_STATES: MentalState[] = ['revenge', 'fomo', 'stressed'];

export function calculateAccountabilityStreak(trades: Trade[]): AccountabilityStreak {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  const tagged = closed.filter(isTradeTagged);

  if (tagged.length === 0) {
    return {
      current: 0,
      longest: 0,
      brokenCount: 0,
      totalTagged: 0,
      message: 'Tag your trades to start building an accountability streak.',
      level: 'building',
    };
  }

  let current = 0;
  let longest = 0;
  let broken = 0;

  for (const t of tagged) {
    const violations = getRuleViolations(t);
    if (violations.length === 0) {
      current++;
      if (current > longest) longest = current;
    } else {
      if (current >= 2) broken++;
      current = 0;
    }
  }

  const level: AccountabilityStreak['level'] =
    current >= 5 ? 'excellent' :
    current >= 3 ? 'good' :
    current >= 1 ? 'building' : 'broken';

  let message: string;
  if (current >= 5) {
    message = `${current} trades in a row following your rules. This is elite discipline — keep it up.`;
  } else if (current >= 3) {
    message = `${current} trades in a row following your rules. You're building a real habit.`;
  } else if (current >= 1) {
    message = `You followed your rules on your last trade. Keep the streak going.`;
  } else if (broken > 0) {
    message = `Your streak was broken on the last trade. Review what rule was violated and reset.`;
  } else {
    message = `Tag your trades to start building an accountability streak.`;
  }

  return {
    current,
    longest,
    brokenCount: broken,
    totalTagged: tagged.length,
    message,
    level,
  };
}

export function getRuleViolations(t: Trade): RuleViolation[] {
  const violations: RuleViolation[] = [];

  if (t.mental_state && BAD_STATES.includes(t.mental_state)) {
    violations.push({
      trade: t,
      rule: 'No trading in emotional states',
      detail: `Entered while feeling ${MENTAL_LABELS[t.mental_state].toLowerCase()} — your rules say don't trade in this state.`,
    });
  }

  if (t.planned_rr != null && t.planned_rr < 1.5 && t.planned_rr > 0) {
    violations.push({
      trade: t,
      rule: 'Minimum 1.5:1 risk-reward',
      detail: `Planned R:R was ${t.planned_rr.toFixed(1)}:1 — below your minimum standard.`,
    });
  }

  if (t.exit_reason === 'fear' || t.exit_reason === 'greed' || t.exit_reason === 'revenge_close') {
    violations.push({
      trade: t,
      rule: 'No emotional exits',
      detail: `Exited due to ${t.exit_reason === 'fear' ? 'fear' : t.exit_reason === 'greed' ? 'greed (held too long)' : 'revenge'} — follow your exit plan.`,
    });
  }

  if (!t.setup_type) {
    violations.push({
      trade: t,
      rule: 'Tag every trade with a setup type',
      detail: 'No setup type recorded — you should know what setup you\'re trading before entering.',
    });
  }

  if (t.confidence_level != null && t.confidence_level <= 3) {
    violations.push({
      trade: t,
      rule: 'Only take high-conviction trades',
      detail: `Confidence was ${t.confidence_level}/10 — consider whether low-conviction trades are worth the risk.`,
    });
  }

  return violations;
}

export function getLastViolation(trades: Trade[]): RuleViolation | null {
  const closed = sortByOpenedAt(trades.filter((t) => t.status === 'closed'));
  const tagged = closed.filter(isTradeTagged);
  if (tagged.length === 0) return null;

  const last = tagged[tagged.length - 1];
  const violations = getRuleViolations(last);
  return violations.length > 0 ? violations[0] : null;
}
