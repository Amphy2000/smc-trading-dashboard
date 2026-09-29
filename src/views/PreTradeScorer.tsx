import { useState, useMemo } from 'react';
import type { Trade, PreTradeScore, MentalState, TradeConfig } from '@/lib/types';
import { Card, Button, PairSelect, Select } from '@/components/ui';
import {
  scorePreTrade, getSessionFromTime, getDayOfWeek,
  SESSION_LABELS, MENTAL_LABELS,
} from '@/lib/edgeAnalyzer';
import { getBehavioralWarnings } from '@/lib/behavioralPatterns';
import {
  ClipboardCheck, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, XCircle, Brain, Zap, Lightbulb,
  ChevronDown, ChevronUp, Sparkles, ShieldAlert, AlertOctagon,
} from 'lucide-react';

interface ScorerProps {
  trades: Trade[];
  config: TradeConfig;
}

const MENTAL_OPTIONS = Object.entries(MENTAL_LABELS).map(([value, label]) => ({ value, label }));

function ScoreGauge({ score, recommendation }: { score: number; recommendation: PreTradeScore['recommendation'] }) {
  const color = recommendation === 'strong_take' ? '#22c55e'
    : recommendation === 'take' ? '#3b82f6'
    : recommendation === 'caution' ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-[135deg]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8"
            strokeDasharray="188.5 251.3" strokeLinecap="round" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${(score / 100) * 188.5} 251.3`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-xs text-slate-500 mt-1">/ 100</span>
        </div>
      </div>
    </div>
  );
}

function RecommendationBadge({ rec }: { rec: PreTradeScore['recommendation'] }) {
  const config = {
    strong_take: { label: 'STRONG TAKE', icon: <CheckCircle2 className="w-4 h-4" /> },
    take: { label: 'TAKE', icon: <TrendingUp className="w-4 h-4" /> },
    caution: { label: 'CAUTION', icon: <AlertTriangle className="w-4 h-4" /> },
    avoid: { label: 'AVOID', icon: <XCircle className="w-4 h-4" /> },
  };
  const c = config[rec];
  const colors = {
    strong_take: 'bg-green-500/10 text-green-400 border-green-500/30',
    take: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    caution: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    avoid: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm ${colors[rec]}`}>
      {c.icon}
      {c.label}
    </div>
  );
}

export function PreTradeScorer({ trades, config }: ScorerProps) {
  const now = new Date();
  const [form, setForm] = useState({
    pair: 'EUR/USD',
    direction: 'BUY' as 'BUY' | 'SELL',
    setup_type: config.setupTypes[0] || 'Other',
    confidence: 5,
    mental_state: 'neutral' as MentalState,
    confluences: [] as string[],
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const session = getSessionFromTime(now);
  const dayOfWeek = getDayOfWeek(now);

  const toggleConfluence = (c: string) => {
    setForm((f) => ({
      ...f,
      confluences: f.confluences.includes(c)
        ? f.confluences.filter((x) => x !== c)
        : [...f.confluences, c],
    }));
  };

  const score = useMemo(() => scorePreTrade(trades, {
    pair: form.pair,
    direction: form.direction,
    session,
    setupType: form.setup_type,
    confidence: form.confidence,
    mentalState: form.mental_state,
    confluences: form.confluences,
    dayOfWeek,
  }), [trades, form, session, dayOfWeek]);

  const behavioralWarnings = useMemo(
    () => getBehavioralWarnings(trades, form.mental_state),
    [trades, form.mental_state]
  );

  const hasStopWarning = behavioralWarnings.some((w) => w.level === 'stop');
  const hasFrictionWarning = behavioralWarnings.some((w) => w.level === 'friction');

  const closedCount = trades.filter((t) => t.status === 'closed').length;
  const hasHistory = closedCount >= 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" /> Pre-Trade Scorer
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {hasHistory
            ? 'Score your setup against your own trading history'
            : 'Score your setup — will become more accurate as you log more trades'}
        </p>
      </div>

      {!hasHistory && (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
          <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm text-blue-400">
            You have {closedCount} closed trade{closedCount !== 1 ? 's' : ''}. The scorer works now with sensible defaults, and gets smarter as you log more trades. Log at least 20 for best accuracy.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form — simplified */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-5">Setup Details</h2>

          <div className="space-y-5">
            {/* Required: pair + direction */}
            <div className="grid grid-cols-2 gap-4">
              <PairSelect label="Pair" value={form.pair} onChange={(v) => setForm({ ...form, pair: v })} />
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setForm({ ...form, direction: 'BUY' })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      form.direction === 'BUY' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" /> Buy
                  </button>
                  <button
                    onClick={() => setForm({ ...form, direction: 'SELL' })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      form.direction === 'SELL' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" /> Sell
                  </button>
                </div>
              </div>
            </div>

            {/* Required: setup type */}
            <Select label="Setup Type" value={form.setup_type} onChange={(v) => setForm({ ...form, setup_type: v })}
              options={config.setupTypes.map((s) => ({ value: s, label: s }))} />

            {/* Auto-detected session */}
            <div className="bg-slate-800/40 rounded-lg p-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Auto-detected session</span>
              <span className="text-sm text-slate-200 font-medium">{SESSION_LABELS[session]}</span>
            </div>

            {/* Confidence slider */}
            <div>
              <label className="block text-xs text-slate-400 mb-2 font-medium">
                Confidence: <span className="text-blue-400 font-bold">{form.confidence}/10</span>
              </label>
              <input
                type="range" min="1" max="10" step="1"
                value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>Low</span><span>Medium</span><span>High</span>
              </div>
            </div>

            {/* Advanced — collapsed by default */}
            <div className="border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors w-full"
              >
                <Brain className="w-4 h-4" />
                <span>Advanced {showAdvanced ? '' : '(mental state + confluences)'}</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <Select label="Mental State" value={form.mental_state} onChange={(v) => setForm({ ...form, mental_state: v as MentalState })}
                    options={MENTAL_OPTIONS} />

                  <div>
                    <label className="block text-xs text-slate-400 mb-2 font-medium flex items-center gap-1.5">
                      <ClipboardCheck className="w-3.5 h-3.5" /> Confluences Present
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {config.confluences.map((c) => (
                        <button
                          key={c}
                          onClick={() => toggleConfluence(c)}
                          className={`text-left text-xs px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                            form.confluences.includes(c)
                              ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                              : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                            form.confluences.includes(c) ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
                          }`}>
                            {form.confluences.includes(c) && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Score output */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Your Score</h2>
            <div className="flex flex-col items-center gap-4">
              <ScoreGauge score={score.score} recommendation={score.recommendation} />
              <RecommendationBadge rec={score.recommendation} />
              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Matched History</p>
                  <p className="text-base sm:text-lg font-bold text-slate-200 font-mono">{score.matchedHistory}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Historical Win Rate</p>
                  <p className={`text-base sm:text-lg font-bold font-mono ${score.historicalWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                    {score.historicalWinRate.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Behavioral intervention gate */}
          {behavioralWarnings.length > 0 && (
            <Card className={`p-5 border ${
              hasStopWarning
                ? 'border-red-500/30 bg-red-500/5'
                : hasFrictionWarning
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-blue-500/20 bg-blue-500/5'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {hasStopWarning ? (
                  <AlertOctagon className="w-5 h-5 text-red-400" />
                ) : hasFrictionWarning ? (
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                ) : (
                  <Brain className="w-5 h-5 text-blue-400" />
                )}
                <h2 className="text-sm font-semibold text-slate-200">
                  {hasStopWarning ? 'Stop — Read This First' : hasFrictionWarning ? 'Slow Down' : 'Heads Up'}
                </h2>
              </div>
              <div className="space-y-3">
                {behavioralWarnings.map((w, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 border ${
                      w.level === 'stop'
                        ? 'bg-red-500/10 border-red-500/30'
                        : w.level === 'friction'
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-blue-500/10 border-blue-500/20'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-200">{w.message}</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{w.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Insights */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-300">Why This Score?</h2>
            </div>
            <div className="space-y-2">
              {score.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2 bg-slate-800/40 rounded-lg p-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-slate-300 leading-relaxed">{ins}</p>
                </div>
              ))}
            </div>
          </Card>

          {score.matchedHistory > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Avg pips on similar trades</span>
                <span className={`font-mono font-bold ${score.historicalAvgPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {score.historicalAvgPips > 0 ? '+' : ''}{score.historicalAvgPips.toFixed(1)}p
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
