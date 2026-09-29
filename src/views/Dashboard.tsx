import { useMemo } from 'react';
import type { PairData, TradingSignal, Trade, ViewName } from '@/lib/types';
import { isTradeTagged } from '@/lib/types';
import { Card, StatCard, Badge, Button } from '@/components/ui';
import { EquityCurve } from '@/components/EquityCurve';
import { DailyRecap } from '@/components/DailyRecap';
import {
  generateEdgeInsights, counterfactualAnalysis, bySession, bySetupType,
  scorePreTrade, getSessionFromTime, getDayOfWeek, SESSION_LABELS,
} from '@/lib/edgeAnalyzer';
import { detectBehavioralPatterns, validateEdge, getBehavioralWarnings } from '@/lib/behavioralPatterns';
import { calculateAccountabilityStreak, getRuleViolations } from '@/lib/accountability';
import { scanAllPairs, DEFAULT_STRATEGY } from '@/lib/signalEngine';
import {
  Dna, Fingerprint, TrendingUp, TrendingDown, Activity, Target,
  ArrowRight, Zap, Clock, AlertTriangle, ClipboardCheck,
  BarChart3, BookOpen, Lightbulb, Flame, ShieldAlert, Sparkles,
  Trophy, XCircle, Link2, AlertOctagon, Microscope, Award, Tag, CheckCircle2,
} from 'lucide-react';

interface DashboardProps {
  pairs: PairData[];
  trades: Trade[];
  isLive: boolean;
  onNavigate: (view: ViewName) => void;
  onExecuteTrade: (signal: TradingSignal) => void;
}

export function Dashboard({ pairs, trades, isLive, onNavigate, onExecuteTrade }: DashboardProps) {
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const openTrades = trades.filter((t) => t.status === 'open');

  const totalPips = closedTrades.reduce((s, t) => s + (t.pips_result || 0), 0);
  const wins = closedTrades.filter((t) => (t.pips_result || 0) > 0);
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

  const insights = useMemo(() => generateEdgeInsights(trades), [trades]);
  const cf = useMemo(() => counterfactualAnalysis(trades), [trades]);
  const sessionData = useMemo(() => bySession(trades), [trades]);
  const setupData = useMemo(() => bySetupType(trades), [trades]);
  const patterns = useMemo(() => detectBehavioralPatterns(trades), [trades]);
  const validation = useMemo(() => validateEdge(trades), [trades]);
  const accountability = useMemo(() => calculateAccountabilityStreak(trades), [trades]);
  const untaggedCount = useMemo(() => trades.filter((t) => t.status === 'closed' && !isTradeTagged(t)).length, [trades]);
  const preTradeWarnings = useMemo(() => getBehavioralWarnings(trades), [trades]);
  const stopWarnings = preTradeWarnings.filter((w) => w.level === 'stop');

  const quickScore = useMemo(() => {
    if (closedTrades.length < 5) return null;
    const now = new Date();
    return scorePreTrade(trades, {
      pair: 'EUR/USD',
      direction: 'BUY',
      session: getSessionFromTime(now),
      setupType: 'Other',
      confidence: 5,
      mentalState: 'neutral',
      confluences: [],
      dayOfWeek: getDayOfWeek(now),
    });
  }, [trades, closedTrades.length]);

  const equity = useMemo(() => {
    let running = 0;
    return [0, ...closedTrades.map((t) => (running += t.pips_result || 0))];
  }, [closedTrades]);

  const recentTrades = closedTrades.slice(0, 10).reverse();

  const signals = useMemo(() => scanAllPairs(pairs, DEFAULT_STRATEGY), [pairs]);
  const strongSignals = useMemo(() => signals.filter((s) => s.confidence >= DEFAULT_STRATEGY.minConfidence).slice(0, 3), [signals]);

  let currentStreak = 0;
  let streakType: 'win' | 'loss' | 'none' = 'none';
  for (const t of closedTrades) {
    const isWin = (t.pips_result || 0) > 0;
    if (streakType === 'none') {
      streakType = isWin ? 'win' : 'loss';
      currentStreak = 1;
    } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Onboarding state: 0 trades = full guide, 1-4 = progress, 5+ = full dashboard
  const isNewUser = trades.length === 0;
  const isBeginner = trades.length > 0 && closedTrades.length < 5;

  // --- ONBOARDING MODE: 0 trades ---
  if (isNewUser) {
    const steps = [
      { done: false, icon: Link2, title: 'Connect your broker', desc: 'Sync your MT5 account once and trades flow in automatically — no manual logging needed.', action: () => onNavigate('import'), actionLabel: 'Connect Broker' },
      { done: false, icon: BookOpen, title: 'Or log trades manually', desc: 'Prefer manual entry? Log a trade in 10 seconds — pair, direction, entry price.', action: () => onNavigate('journal'), actionLabel: 'Log a Trade' },
      { done: false, icon: Dna, title: 'Discover your edge', desc: 'After 5 closed trades, unlock your personal performance DNA — what actually makes you money.', action: () => onNavigate('edge'), actionLabel: 'Preview Edge DNA' },
    ];

    return (
      <div className="space-y-6">
        {!isLive && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400">Live market data unavailable — using simulated prices. Your edge analysis works on your trade history regardless.</span>
          </div>
        )}

        {/* Hero welcome */}
        <Card className="p-8 border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-slate-900/80 to-transparent">
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-blue-600/20 rounded-2xl mb-4">
              <Dna className="w-12 h-12 text-blue-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">Welcome to TraderDNA</h1>
            <p className="text-slate-400 max-w-lg text-sm leading-relaxed">
              This isn't just another journal. It's your personal trading edge discovery engine.
              Connect your broker and trades sync automatically — or log them manually in seconds.
              The app then finds what actually works for you: which sessions, setups, pairs, and mental states make you money.
            </p>
          </div>
        </Card>

        {/* 3-step guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <Card key={i} className="p-5 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">STEP {i + 1}</span>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed flex-1">{step.desc}</p>
              <Button size="sm" variant="secondary" className="w-full mt-4" onClick={step.action}>
                {step.actionLabel} <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Card>
          ))}
        </div>

        {/* Quick wins */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 border-blue-500/20">
            <div className="flex items-center gap-3 mb-3">
              <ClipboardCheck className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-200">Pre-Trade Scorer</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Before you enter any trade, run it through the scorer. It checks your setup against your history
              and tells you if similar trades have made or lost you money.
            </p>
            <Button size="sm" className="w-full" onClick={() => onNavigate('scorer')}>
              Try It Now <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Card>

          <Card className="p-5 border-blue-500/20">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-200">Market Scanner</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Scan all major pairs for trading setups based on Smart Money Concepts — order blocks,
              fair value gaps, and liquidity zones.
            </p>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => onNavigate('scanner')}>
              Scan Markets <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Card>
        </div>

        {/* Market signals preview */}
        {strongSignals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-400">Market Setups Right Now</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onNavigate('scanner')}>
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {strongSignals.map((sig) => (
                <Card key={sig.pair} className="p-4 cursor-pointer hover:border-slate-700" onClick={() => onNavigate('scanner')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-200">{sig.pair}</span>
                    <Badge variant={sig.direction === 'BUY' ? 'success' : 'danger'}>
                      {sig.direction}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Confidence: {sig.confidence.toFixed(0)}%</span>
                    <span className="text-slate-500">R:R 1:{sig.riskRewardRatio.toFixed(1)}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- BEGINNER MODE: 1-4 closed trades ---
  if (isBeginner) {
    const progressToEdge = closedTrades.length;
    const tradesNeeded = 5 - progressToEdge;

    return (
      <div className="space-y-6">
        <DailyRecap trades={trades} />
        {!isLive && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400">Live market data unavailable — using simulated prices. Your edge analysis works on your trade history regardless.</span>
          </div>
        )}

        {/* Progress card */}
        <Card className="p-6 border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-slate-900/80 to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/20 rounded-xl">
                <Trophy className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">You're building your edge</h2>
                <p className="text-xs text-slate-500 mt-0.5">{progressToEdge} of 5 trades logged</p>
              </div>
            </div>
            <span className="text-3xl font-bold text-blue-400 font-mono">{progressToEdge}/5</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${(progressToEdge / 5) * 100}%` }}
            />
          </div>

          <p className="text-sm text-slate-400 mb-4">
            {tradesNeeded > 0
              ? `Log ${tradesNeeded} more trade${tradesNeeded !== 1 ? 's' : ''} to unlock your personal Edge DNA — which setups, sessions, and mental states make you money.`
              : 'You have enough trades to unlock Edge DNA!'}
          </p>

          <div className="flex gap-3">
            <Button onClick={() => onNavigate('journal')}>
              <BookOpen className="w-4 h-4 mr-1" /> Log Another Trade
            </Button>
            {tradesNeeded === 0 && (
              <Button variant="secondary" onClick={() => onNavigate('edge')}>
                <Dna className="w-4 h-4 mr-1" /> View Edge DNA
              </Button>
            )}
          </div>
        </Card>

        {/* Basic stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Pips"
            value={totalPips > 0 ? `+${totalPips.toFixed(0)}` : totalPips.toFixed(0)}
            subtext={`${closedTrades.length} closed`}
            trend={totalPips >= 0 ? 'up' : 'down'}
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard
            label="Win Rate"
            value={`${winRate.toFixed(0)}%`}
            subtext={`${wins.length}W / ${closedTrades.length - wins.length}L`}
            trend={winRate >= 50 ? 'up' : 'down'}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Open Trades"
            value={openTrades.length}
            icon={<Activity className="w-5 h-5" />}
          />
          <StatCard
            label="Total Logged"
            value={trades.length}
            subtext="trades in journal"
            icon={<BookOpen className="w-5 h-5" />}
          />
        </div>

        {/* Recent trades */}
        {recentTrades.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-300">Recent Trades</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onNavigate('journal')}>
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {recentTrades.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/30 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Badge variant={t.direction === 'BUY' ? 'success' : 'danger'}>{t.direction}</Badge>
                    <span className="text-sm text-slate-200 font-medium truncate">{t.pair}</span>
                    {t.setup_type && <span className="text-xs text-slate-500 hidden sm:inline">{t.setup_type}</span>}
                  </div>
                  <span className={`text-sm font-mono font-bold flex-shrink-0 ${(t.pips_result || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(t.pips_result || 0) > 0 ? '+' : ''}{(t.pips_result || 0).toFixed(1)}p
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Open trades with quick close */}
        {openTrades.length > 0 && (
          <Card className="p-5 border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-300">Open Positions</h2>
            </div>
            <div className="space-y-2">
              {openTrades.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/30 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Badge variant={t.direction === 'BUY' ? 'success' : 'danger'}>{t.direction}</Badge>
                    <span className="text-sm text-slate-200 font-medium truncate">{t.pair}</span>
                    <span className="text-xs text-slate-500 hidden sm:inline">@ {t.entry_price > 50 ? t.entry_price.toFixed(2) : t.entry_price.toFixed(5)}</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => onNavigate('journal')} className="flex-shrink-0">
                    Close <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // --- FULL DASHBOARD: 5+ closed trades ---
  return (
    <div className="space-y-6">
      <DailyRecap trades={trades} />
      {!isLive && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-400">Live market data unavailable — using simulated prices. Your edge analysis works on your trade history regardless.</span>
        </div>
      )}

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Pips"
          value={totalPips > 0 ? `+${totalPips.toFixed(0)}` : totalPips.toFixed(0)}
          subtext={`${closedTrades.length} closed trades`}
          trend={totalPips >= 0 ? 'up' : 'down'}
          icon={<Target className="w-5 h-5" />}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          subtext={`${wins.length}W / ${closedTrades.length - wins.length}L`}
          trend={winRate >= 50 ? 'up' : 'down'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          label="Open Positions"
          value={openTrades.length}
          subtext={`${closedTrades.length} closed total`}
          icon={<Activity className="w-5 h-5" />}
        />
        <StatCard
          label="Current Streak"
          value={currentStreak > 0 ? `${currentStreak} ${streakType === 'win' ? 'Win' : 'Loss'}` : '—'}
          subtext={openTrades.length > 0 ? `${openTrades.length} open` : 'No open trades'}
          trend={streakType === 'win' ? 'up' : streakType === 'loss' ? 'down' : 'neutral'}
          icon={streakType === 'win' ? <Flame className="w-5 h-5" /> : streakType === 'loss' ? <ShieldAlert className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
        />
      </div>

      {/* Streak warning */}
      {streakType === 'loss' && currentStreak >= 3 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 sm:px-5 py-4">
          <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">You're on a {currentStreak}-loss streak</p>
            <p className="text-xs text-slate-400 mt-0.5">Consider stepping back and reviewing your recent trades before entering the next one. Use the Pre-Trade Scorer before your next entry.</p>
          </div>
          <Button size="sm" variant="danger" onClick={() => onNavigate('scorer')} className="flex-shrink-0">
            Score Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Pre-trade behavioral warnings */}
      {stopWarnings.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 sm:px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Before You Trade Today</h2>
          </div>
          {stopWarnings.map((w, i) => (
            <div key={i} className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
              <p className="text-sm font-semibold text-slate-200">{w.message}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{w.detail}</p>
            </div>
          ))}
          <Button size="sm" variant="danger" onClick={() => onNavigate('scorer')} className="flex-shrink-0">
            Check Pre-Trade Score <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Untagged trades prompt */}
      {untaggedCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <Tag className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-slate-200">
              {untaggedCount} synced trade{untaggedCount !== 1 ? 's' : ''} need tagging
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Tag them with your mental state to unlock behavioral analysis</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onNavigate('journal')} className="flex-shrink-0">
            Tag Now <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Accountability + Edge validation row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accountability.totalTagged >= 2 && (
          <Card className={`p-4 border ${
            accountability.level === 'excellent' ? 'border-green-500/30 bg-green-500/5'
            : accountability.level === 'good' ? 'border-blue-500/20 bg-blue-500/5'
            : accountability.level === 'building' ? 'border-slate-700 bg-slate-800/30'
            : 'border-red-500/20 bg-red-500/5'
          }`}>
            <div className="flex items-center gap-3">
              {accountability.level === 'excellent' ? (
                <Award className="w-5 h-5 text-green-400 flex-shrink-0" />
              ) : accountability.level === 'good' ? (
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              ) : accountability.level === 'broken' ? (
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              ) : (
                <Flame className="w-5 h-5 text-slate-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-200">Rule Streak: {accountability.current}</span>
                  <span className="text-xs text-slate-500">Best: {accountability.longest}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{accountability.message}</p>
              </div>
            </div>
          </Card>
        )}

        <Card className={`p-4 border ${
          validation.isStatisticallySignificant
            ? validation.winRate > 50 ? 'border-green-500/20 bg-green-500/5'
            : 'border-red-500/20 bg-red-500/5'
            : 'border-amber-500/20 bg-amber-500/5'
        }`}>
          <div className="flex items-center gap-3">
            <Microscope className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-200">
                  {validation.isStatisticallySignificant
                    ? validation.winRate > 50 ? 'Edge Confirmed' : 'Negative Edge'
                    : 'No Proven Edge'}
                </span>
                <span className="text-xs text-slate-500 font-mono">{validation.winRate.toFixed(0)}% WR / p={validation.pValue.toFixed(3)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {validation.totalTrades < 30
                  ? `${validation.totalTrades}/${validation.recommendedTradesForSignificance} trades for significance`
                  : `95% CI: ${validation.confidenceInterval.lower.toFixed(0)}%–${validation.confidenceInterval.upper.toFixed(0)}%`}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('edge')} className="flex-shrink-0">
              Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Behavioral patterns alert */}
      {patterns.length > 0 && patterns.some((p) => p.severity === 'critical' || p.severity === 'warning') && (
        <Card className="p-5 border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-red-400" />
              <h2 className="text-sm font-semibold text-slate-200">Behavioral Patterns Detected</h2>
              <Badge variant="danger">{patterns.length}</Badge>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('edge')}>
              Full Analysis <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-2">
            {patterns.filter((p) => p.severity === 'critical' || p.severity === 'warning').slice(0, 3).map((p) => (
              <div key={p.id} className={`rounded-lg p-3 border ${
                p.severity === 'critical'
                  ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {p.severity === 'critical'
                      ? <Flame className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    <span className="text-sm font-semibold text-slate-200">{p.title}</span>
                  </div>
                  <span className={`text-xs font-mono font-bold flex-shrink-0 ${p.estimatedCost < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {p.estimatedCost > 0 ? '+' : ''}{p.estimatedCost.toFixed(0)}p
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edge insights */}
      {insights.length > 0 && (
        <Card className="p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-100">Your Edge Insights</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('edge')}>
              Full Analysis <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.slice(0, 6).map((ins, i) => (
              <div
                key={i}
                className={`rounded-lg p-3.5 border ${
                  ins.isPositive ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">{ins.category}</span>
                  {ins.isPositive
                    ? <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    : <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                </div>
                <p className="text-sm font-semibold text-slate-200">{ins.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{ins.value}</p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{ins.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick pre-trade score + equity curve */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {quickScore && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-300">Quick Score for EUR/USD Now</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold font-mono text-blue-400">{quickScore.score}</p>
                <p className="text-xs text-slate-500 mt-0.5">out of 100</p>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                quickScore.recommendation === 'strong_take' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                quickScore.recommendation === 'take' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                quickScore.recommendation === 'caution' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {quickScore.recommendation.replace('_', ' ').toUpperCase()}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Based on your {quickScore.matchedHistory} similar trades ({quickScore.historicalWinRate.toFixed(0)}% historical win rate)</p>
            <Button size="sm" variant="secondary" className="w-full mt-3" onClick={() => onNavigate('scorer')}>
              Score a Specific Setup <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        )}

        <Card className={`p-5 ${quickScore ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Equity Curve (pips)</h2>
          {equity.length > 1 ? (
            <div style={{ height: 200 }}>
              <EquityCurve values={equity} height={200} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              Close some trades to see your equity curve
            </div>
          )}
        </Card>
      </div>

      {/* Exit quality warning */}
      {cf.insights.length > 0 && (
        <Card className="p-5 border-amber-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-300">Exit Quality Insights</h2>
          </div>
          <div className="space-y-2">
            {cf.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 bg-slate-800/40 rounded-lg p-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <p className="text-xs text-slate-300">{ins}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top performing dimensions */}
      {closedTrades.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessionData.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-300">Best & Worst Sessions</h2>
              </div>
              <div className="space-y-2">
                {[...sessionData].sort((a, b) => b.totalPips - a.totalPips).slice(0, 4).map((s) => (
                  <div key={s.label} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/40 gap-2">
                    <span className="text-sm text-slate-300 truncate">{s.label}</span>
                    <div className="flex gap-2 sm:gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-500 hidden sm:inline">{s.tradeCount} trades</span>
                      <span className={`text-sm font-mono font-bold text-right ${s.totalPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.totalPips > 0 ? '+' : ''}{s.totalPips.toFixed(0)}p
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {setupData.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-300">Setup Performance</h2>
              </div>
              <div className="space-y-2">
                {setupData.slice(0, 4).map((s) => (
                  <div key={s.label} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/40 gap-2">
                    <span className="text-sm text-slate-300 truncate">{s.label}</span>
                    <div className="flex gap-2 sm:gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-500 hidden sm:inline">{s.tradeCount} trades</span>
                      <span className={`text-sm font-mono font-bold text-right ${s.totalPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.totalPips > 0 ? '+' : ''}{s.totalPips.toFixed(0)}p
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Recent trades preview */}
      {recentTrades.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-300">Recent Trades</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('journal')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {recentTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/30 gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Badge variant={t.direction === 'BUY' ? 'success' : 'danger'}>{t.direction}</Badge>
                  <span className="text-sm text-slate-200 font-medium truncate">{t.pair}</span>
                  {t.setup_type && <span className="text-xs text-slate-500 hidden sm:inline">{t.setup_type}</span>}
                </div>
                <span className={`text-sm font-mono font-bold flex-shrink-0 ${(t.pips_result || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(t.pips_result || 0) > 0 ? '+' : ''}{(t.pips_result || 0).toFixed(1)}p
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Market signals — secondary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-400">Market Setups</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onNavigate('scanner')}>
            Scanner <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        {strongSignals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {strongSignals.map((sig) => (
              <Card key={sig.pair} className="p-4 cursor-pointer hover:border-slate-700" onClick={() => onNavigate('scanner')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-200">{sig.pair}</span>
                  <Badge variant={sig.direction === 'BUY' ? 'success' : 'danger'}>
                    {sig.direction}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Confidence: {sig.confidence.toFixed(0)}%</span>
                  <span className="text-slate-500">R:R 1:{sig.riskRewardRatio.toFixed(1)}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-500">No high-confidence market setups right now. Your edge analysis above works regardless of market conditions.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

