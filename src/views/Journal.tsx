import { useState, useMemo } from 'react';
import type { Trade, TradingSignal, MentalState, ExitReason, TradeConfig, PairData } from '@/lib/types';
import { isTradeTagged } from '@/lib/types';
import { Card, Badge, Button, Input, Select, Modal, PairSelect } from '@/components/ui';
import { useTrades } from '@/hooks/useTrades';
import { getPipSize } from '@/lib/forex';
import { supabase } from '@/lib/supabase';
import { TradeReplay } from '@/components/TradeReplay';
import {
  getSessionFromTime, getDayOfWeek, SESSION_LABELS,
  MENTAL_LABELS, EXIT_LABELS,
} from '@/lib/edgeAnalyzer';
import { calculateAccountabilityStreak, getLastViolation } from '@/lib/accountability';
import {
  Plus, XCircle, Trash2, BookOpen, Brain, Clock, Smile, Zap,
  ClipboardCheck, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  CheckCircle2, Flame, Tag, AlertCircle, Award, Eye, Download,
} from 'lucide-react';

interface JournalProps {
  trades: Trade[];
  addTrade: ReturnType<typeof useTrades>['addTrade'];
  closeTrade: ReturnType<typeof useTrades>['closeTrade'];
  deleteTrade: ReturnType<typeof useTrades>['deleteTrade'];
  pendingSignal: TradingSignal | null;
  onClearPendingSignal: () => void;
  refetchTrades: () => Promise<void>;
  config: TradeConfig;
  pairs: PairData[];
}

const MENTAL_OPTIONS = Object.entries(MENTAL_LABELS).map(([value, label]) => ({ value, label }));
const EXIT_OPTIONS = Object.entries(EXIT_LABELS).map(([value, label]) => ({ value, label }));

export function Journal({ trades, addTrade, closeTrade, deleteTrade, pendingSignal, onClearPendingSignal, refetchTrades, config, pairs }: JournalProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [showClose, setShowClose] = useState<string | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'untagged'>('all');
  const [showDetails, setShowDetails] = useState(false);
  const [taggingTradeId, setTaggingTradeId] = useState<string | null>(null);
  const [replayTradeId, setReplayTradeId] = useState<string | null>(null);

  // Simplified form — only pair, direction, result required
  const [form, setForm] = useState({
    pair: 'EUR/USD',
    direction: 'BUY' as 'BUY' | 'SELL',
    entry_price: '',
    stop_loss: '',
    take_profit: '',
    lot_size: '0.10',
    strategy: '',
    notes: '',
    setup_type: config.setupTypes[0] || 'Other',
    confidence_level: '5',
    mental_state: 'neutral' as MentalState,
    confluences: [] as string[],
  });

  // Quick close form — just pips result
  const [closeForm, setCloseForm] = useState({
    exit_reason: 'manual' as ExitReason,
    max_favorable: '',
    max_adverse: '',
  });
  const [showCloseDetails, setShowCloseDetails] = useState(false);

  // Tagging form for MT5-synced trades
  const [tagForm, setTagForm] = useState({
    setup_type: '',
    confidence_level: '5',
    mental_state: 'neutral' as MentalState,
    confluences: [] as string[],
    notes: '',
  });

  const accountability = useMemo(() => calculateAccountabilityStreak(trades), [trades]);
  const lastViolation = useMemo(() => getLastViolation(trades), [trades]);
  const untaggedCount = useMemo(() => trades.filter((t) => t.status === 'closed' && !isTradeTagged(t)).length, [trades]);

  const toggleTagConfluence = (c: string) => {
    setTagForm((f) => ({
      ...f,
      confluences: f.confluences.includes(c)
        ? f.confluences.filter((x) => x !== c)
        : [...f.confluences, c],
    }));
  };

  const handleTagSubmit = async () => {
    if (!taggingTradeId) return;
    await supabase.from('trades').update({
      setup_type: tagForm.setup_type || null,
      confidence_level: parseInt(tagForm.confidence_level) || 5,
      mental_state: tagForm.mental_state,
      confluences: tagForm.confluences.length > 0 ? tagForm.confluences : null,
      notes: tagForm.notes || null,
      tagged: true,
    }).eq('id', taggingTradeId);
    await refetchTrades();
    setTaggingTradeId(null);
    setTagForm({ setup_type: '', confidence_level: '5', mental_state: 'neutral', confluences: [], notes: '' });
  };

  const openTagModal = (tradeId: string) => {
    const trade = trades.find((t) => t.id === tradeId);
    setTagForm({
      setup_type: trade?.setup_type || config.setupTypes[0] || 'Other',
      confidence_level: String(trade?.confidence_level || 5),
      mental_state: trade?.mental_state || 'neutral',
      confluences: trade?.confluences || [],
      notes: trade?.notes || '',
    });
    setTaggingTradeId(tradeId);
  };

  const toggleConfluence = (c: string) => {
    setForm((f) => ({
      ...f,
      confluences: f.confluences.includes(c)
        ? f.confluences.filter((x) => x !== c)
        : [...f.confluences, c],
    }));
  };

  const handleAdd = async () => {
    const entry = parseFloat(form.entry_price);
    if (!entry) return;

    const now = new Date();
    const session = getSessionFromTime(now);
    const dayOfWeek = getDayOfWeek(now);
    const sl = form.stop_loss ? parseFloat(form.stop_loss) : null;
    const tp = form.take_profit ? parseFloat(form.take_profit) : null;
    const pipSize = getPipSize(form.pair);
    const riskPips = sl ? Math.abs(entry - sl) / pipSize : 0;
    const rewardPips = tp ? Math.abs(tp - entry) / pipSize : 0;
    const plannedRR = riskPips > 0 ? rewardPips / riskPips : 0;

    await addTrade({
      pair: form.pair,
      direction: form.direction,
      status: 'open',
      entry_price: entry,
      exit_price: null,
      stop_loss: sl,
      take_profit: tp,
      lot_size: parseFloat(form.lot_size) || 0.01,
      pips_result: null,
      profit_loss: null,
      strategy: form.strategy || null,
      notes: form.notes || null,
      opened_at: now.toISOString(),
      closed_at: null,
      session,
      setup_type: form.setup_type,
      confidence_level: parseInt(form.confidence_level) || 5,
      mental_state: form.mental_state,
      confluences: form.confluences,
      planned_rr: plannedRR || null,
      day_of_week: dayOfWeek,
    });

    setShowAdd(false);
    setShowDetails(false);
    setForm({ ...form, entry_price: '', stop_loss: '', take_profit: '', strategy: '', notes: '', confluences: [] });
  };

  const handleClose = async () => {
    if (!showClose || !closePrice) return;
    const trade = trades.find((t) => t.id === showClose);
    if (!trade) return;

    const exit = parseFloat(closePrice);
    const pipSize = getPipSize(trade.pair);
    const pips = trade.direction === 'BUY'
      ? (exit - trade.entry_price) / pipSize
      : (trade.entry_price - exit) / pipSize;
    const pnl = pips * (trade.lot_size / 0.01) * 1;

    await closeTrade(showClose, exit, pips, pnl);

    if (closeForm.exit_reason !== 'manual' || closeForm.max_favorable || closeForm.max_adverse) {
      await supabase
        .from('trades')
        .update({
          exit_reason: closeForm.exit_reason,
          max_favorable_pips: closeForm.max_favorable ? parseFloat(closeForm.max_favorable) : null,
          max_adverse_pips: closeForm.max_adverse ? parseFloat(closeForm.max_adverse) : null,
        })
        .eq('id', showClose);
      await refetchTrades();
    }

    setShowClose(null);
    setClosePrice('');
    setShowCloseDetails(false);
    setCloseForm({ exit_reason: 'manual', max_favorable: '', max_adverse: '' });
  };

  const useSignalForm = () => {
    if (!pendingSignal) return;
    const pipSize = getPipSize(pendingSignal.pair);
    setForm({
      pair: pendingSignal.pair,
      direction: pendingSignal.direction as 'BUY' | 'SELL',
      entry_price: pendingSignal.entry.toFixed(pipSize === 0.01 ? 2 : 5),
      stop_loss: pendingSignal.stopLoss.toFixed(pipSize === 0.01 ? 2 : 5),
      take_profit: pendingSignal.takeProfit.toFixed(pipSize === 0.01 ? 2 : 5),
      lot_size: '0.10',
      strategy: pendingSignal.strategy,
      notes: '',
      setup_type: config.setupTypes[0] || 'Other',
      confidence_level: '5',
      mental_state: 'neutral',
      confluences: [],
    });
    setShowAdd(true);
    onClearPendingSignal();
  };

  const filteredTrades = filter === 'all' ? trades : filter === 'untagged' ? trades.filter((t) => t.status === 'closed' && !isTradeTagged(t)) : trades.filter((t) => t.status === filter);

  const formatPrice = (p: number | null) => {
    if (p === null) return '-';
    return p > 50 ? p.toFixed(2) : p.toFixed(5);
  };

  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const totalPips = closedTrades.reduce((s, t) => s + (t.pips_result || 0), 0);

  const exportCSV = () => {
    const headers = [
      'Pair', 'Direction', 'Status', 'Entry Price', 'Exit Price', 'Stop Loss',
      'Take Profit', 'Lot Size', 'Pips Result', 'P/L', 'Session', 'Setup Type',
      'Confidence', 'Mental State', 'Confluences', 'Opened At', 'Closed At',
      'Exit Reason', 'Notes',
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = trades.map((t) => [
      t.pair, t.direction, t.status, t.entry_price, t.exit_price ?? '',
      t.stop_loss ?? '', t.take_profit ?? '', t.lot_size,
      t.pips_result ?? '', t.profit_loss ?? '',
      t.session ?? '', t.setup_type ?? '', t.confidence_level ?? '',
      t.mental_state ?? '', (t.confluences || []).join('; '),
      t.opened_at, t.closed_at ?? '', t.exit_reason ?? '', t.notes ?? '',
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Trade Journal</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {openTrades.length} open / {closedTrades.length} closed / {totalPips > 0 ? '+' : ''}{totalPips.toFixed(0)} pips
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={exportCSV} disabled={trades.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button onClick={() => setShowAdd(true)} size="md">
            <Plus className="w-5 h-5 mr-1" /> Log Trade
          </Button>
        </div>
      </div>

      {pendingSignal && (
        <Card className="p-4 border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={pendingSignal.direction === 'BUY' ? 'success' : 'danger'}>
                {pendingSignal.direction}
              </Badge>
              <span className="text-sm text-slate-300">
                Pre-filling from signal: <strong>{pendingSignal.pair}</strong> at {formatPrice(pendingSignal.entry)}
              </span>
            </div>
            <Button size="sm" onClick={useSignalForm}>Use Signal</Button>
          </div>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['all', 'open', 'closed', 'untagged'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {f === 'untagged' ? `Untagged${untaggedCount > 0 ? ` (${untaggedCount})` : ''}` : f} {f === 'open' ? `(${openTrades.length})` : f === 'closed' ? `(${closedTrades.length})` : f === 'all' ? `(${trades.length})` : ''}
          </button>
        ))}
      </div>

      {/* Accountability streak */}
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
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            ) : (
              <Flame className="w-5 h-5 text-slate-400 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-200">
                  Rule Streak: {accountability.current}
                </span>
                <span className="text-xs text-slate-500">/ Best: {accountability.longest}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{accountability.message}</p>
            </div>
            {lastViolation && accountability.current === 0 && (
              <div className="hidden sm:block text-right flex-shrink-0">
                <p className="text-xs text-red-400 font-medium">Last violation:</p>
                <p className="text-xs text-slate-500">{lastViolation.rule}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Untagged trades prompt */}
      {untaggedCount > 0 && (
        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-slate-200">
                {untaggedCount} trade{untaggedCount !== 1 ? 's' : ''} need{untaggedCount === 1 ? 's' : ''} tagging
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                These were auto-synced from your broker. Tag them with your mental state and setup type to unlock behavioral analysis.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setFilter('untagged')}>
              Review
            </Button>
          </div>
        </Card>
      )}

      {filteredTrades.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No trades yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">Tap "Log Trade" above. It takes 10 seconds — just pick a pair, direction, and entry price.</p>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Log Your First Trade
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTrades.map((trade) => (
            <Card key={trade.id} className="p-3 sm:p-4">
              {/* Row 1: identity + action */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${trade.direction === 'BUY' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {trade.direction === 'BUY'
                      ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                      : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm sm:text-base font-bold text-slate-100">{trade.pair}</span>
                    <span className="text-xs text-slate-500 ml-1.5">{trade.lot_size} lots</span>
                  </div>
                  <Badge variant={trade.status === 'open' ? 'info' : 'neutral'}>
                    {trade.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {trade.pips_result !== null && (
                    <p className={`text-base sm:text-lg font-mono font-bold ${trade.pips_result >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pips_result > 0 ? '+' : ''}{trade.pips_result.toFixed(1)}p
                    </p>
                  )}
                  {trade.status === 'open' ? (
                    <Button size="sm" variant="secondary" onClick={() => { setShowClose(trade.id); setClosePrice(''); }}>
                      <XCircle className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Close</span>
                    </Button>
                  ) : !isTradeTagged(trade) ? (
                    <Button size="sm" variant="secondary" onClick={() => openTagModal(trade.id)}>
                      <Tag className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Tag</span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setReplayTradeId(trade.id)} className="text-slate-500 hover:text-blue-400 transition-colors p-2" title="View trade replay">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTrade(trade.id)} className="text-slate-500 hover:text-red-400 transition-colors p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: price details — scrollable on mobile */}
              <div className="flex items-center gap-4 mt-3 overflow-x-auto no-scrollbar">
                <div className="flex-shrink-0">
                  <p className="text-[10px] text-slate-500">Entry</p>
                  <p className="text-xs font-mono text-slate-300">{formatPrice(trade.entry_price)}</p>
                </div>
                {trade.stop_loss && (
                  <div className="flex-shrink-0">
                    <p className="text-[10px] text-slate-500">SL</p>
                    <p className="text-xs font-mono text-red-400">{formatPrice(trade.stop_loss)}</p>
                  </div>
                )}
                {trade.take_profit && (
                  <div className="flex-shrink-0">
                    <p className="text-[10px] text-slate-500">TP</p>
                    <p className="text-xs font-mono text-green-400">{formatPrice(trade.take_profit)}</p>
                  </div>
                )}
                {trade.exit_price && (
                  <div className="flex-shrink-0">
                    <p className="text-[10px] text-slate-500">Exit</p>
                    <p className="text-xs font-mono text-slate-300">{formatPrice(trade.exit_price)}</p>
                  </div>
                )}
              </div>

              {/* Row 3: metadata tags */}
              {(trade.setup_type || trade.session || trade.mental_state) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {trade.setup_type && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {trade.setup_type}
                    </span>
                  )}
                  {trade.session && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {SESSION_LABELS[trade.session]}
                    </span>
                  )}
                  {trade.mental_state && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Smile className="w-3 h-3" /> {MENTAL_LABELS[trade.mental_state]}
                    </span>
                  )}
                </div>
              )}

              {trade.confluences && trade.confluences.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-800/50">
                  {trade.confluences.map((c) => (
                    <span key={c} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {trade.notes && <p className="text-sm text-slate-400 mt-2 pt-2 border-t border-slate-800/50">{trade.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      {/* Add trade modal — progressive disclosure */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setShowDetails(false); }} title="Log Trade" width="max-w-lg">
        <div className="space-y-5">
          {/* Step 1: The bare minimum — pair, direction, entry */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">The Basics</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3">
              <Input label="Entry Price" type="number" step="any" value={form.entry_price} onChange={(v) => setForm({ ...form, entry_price: v })} placeholder="Required" />
              <Input label="Stop Loss" type="number" step="any" value={form.stop_loss} onChange={(v) => setForm({ ...form, stop_loss: v })} placeholder="Optional" />
              <Input label="Take Profit" type="number" step="any" value={form.take_profit} onChange={(v) => setForm({ ...form, take_profit: v })} placeholder="Optional" />
            </div>
            <Input label="Lot Size" type="number" step="0.01" value={form.lot_size} onChange={(v) => setForm({ ...form, lot_size: v })} />
          </div>

          {/* Optional details — collapsed by default */}
          <div className="border-t border-slate-800 pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors w-full"
            >
              <Brain className="w-4 h-4" />
              <span>Edge Metadata {showDetails ? '' : '(optional — improves your edge analysis)'}</span>
              {showDetails ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </button>

            {showDetails && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Setup Type" value={form.setup_type} onChange={(v) => setForm({ ...form, setup_type: v })}
                    options={config.setupTypes.map((s) => ({ value: s, label: s }))} />
                  <Select label="Mental State" value={form.mental_state} onChange={(v) => setForm({ ...form, mental_state: v as MentalState })}
                    options={MENTAL_OPTIONS} />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-2 font-medium">
                    Confidence: <span className="text-blue-400 font-bold">{form.confidence_level}/10</span>
                  </label>
                  <input
                    type="range" min="1" max="10" step="1"
                    value={form.confidence_level}
                    onChange={(e) => setForm({ ...form, confidence_level: e.target.value })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>Low</span><span>Medium</span><span>High</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-2 font-medium flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Confluences Present
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {config.confluences.map((c) => (
                      <button
                        key={c}
                        onClick={() => toggleConfluence(c)}
                        className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                          form.confluences.includes(c)
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                            : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="What did you see? Why did you take this trade?"
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setShowAdd(false); setShowDetails(false); }}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.entry_price}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Add Trade
            </Button>
          </div>
        </div>
      </Modal>

      {/* Close trade modal — simplified */}
      <Modal open={!!showClose} onClose={() => { setShowClose(null); setShowCloseDetails(false); }} title="Close Position" width="max-w-md">
        <div className="space-y-4">
          {showClose && (() => {
            const trade = trades.find((t) => t.id === showClose);
            if (!trade) return null;
            return (
              <div className="bg-slate-800/40 rounded-lg p-3 space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">Pair</span><span className="text-slate-200 font-semibold">{trade.pair}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Direction</span><span className="text-slate-200">{trade.direction}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Entry</span><span className="text-slate-200 font-mono">{formatPrice(trade.entry_price)}</span></div>
              </div>
            );
          })()}
          <Input label="Exit Price" type="number" step="any" value={closePrice} onChange={setClosePrice} placeholder="Current market price" />

          {/* Optional close details */}
          <button
            onClick={() => setShowCloseDetails(!showCloseDetails)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors w-full"
          >
            {showCloseDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Optional: exit details {showCloseDetails ? '' : '(improves exit analysis)'}</span>
          </button>

          {showCloseDetails && (
            <div className="space-y-4">
              <Select label="Exit Reason" value={closeForm.exit_reason} onChange={(v) => setCloseForm({ ...closeForm, exit_reason: v as ExitReason })}
                options={EXIT_OPTIONS} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Max Favorable (pips)" type="number" step="0.1" value={closeForm.max_favorable}
                  onChange={(v) => setCloseForm({ ...closeForm, max_favorable: v })} placeholder="Best pip movement" />
                <Input label="Max Adverse (pips)" type="number" step="0.1" value={closeForm.max_adverse}
                  onChange={(v) => setCloseForm({ ...closeForm, max_adverse: v })} placeholder="Worst drawdown" />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setShowClose(null); setShowCloseDetails(false); }}>Cancel</Button>
            <Button variant="danger" onClick={handleClose} disabled={!closePrice}>
              <XCircle className="w-4 h-4 mr-1" /> Close Trade
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tag trade modal — for MT5-synced trades */}
      <Modal open={!!taggingTradeId} onClose={() => setTaggingTradeId(null)} title="Tag This Trade" width="max-w-lg">
        <div className="space-y-5">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs text-amber-400 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" />
              This trade was auto-synced from your broker. Add your metadata to unlock behavioral analysis.
            </p>
          </div>

          {taggingTradeId && (() => {
            const trade = trades.find((t) => t.id === taggingTradeId);
            if (!trade) return null;
            return (
              <div className="bg-slate-800/40 rounded-lg p-3 space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">Pair</span><span className="text-slate-200 font-semibold">{trade.pair}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Direction</span><span className="text-slate-200">{trade.direction}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Result</span><span className={`font-mono font-bold ${(trade.pips_result ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(trade.pips_result ?? 0) > 0 ? '+' : ''}{(trade.pips_result ?? 0).toFixed(1)}p</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Opened</span><span className="text-slate-300 text-xs">{new Date(trade.opened_at).toLocaleString()}</span></div>
              </div>
            );
          })()}

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">What was your mindset?</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Setup Type" value={tagForm.setup_type} onChange={(v) => setTagForm({ ...tagForm, setup_type: v })}
                options={config.setupTypes.map((s) => ({ value: s, label: s }))} />
              <Select label="Mental State" value={tagForm.mental_state} onChange={(v) => setTagForm({ ...tagForm, mental_state: v as MentalState })}
                options={MENTAL_OPTIONS} />
            </div>

            <div className="mt-4">
              <label className="block text-xs text-slate-400 mb-2 font-medium">
                Confidence: <span className="text-blue-400 font-bold">{tagForm.confidence_level}/10</span>
              </label>
              <input
                type="range" min="1" max="10" step="1"
                value={tagForm.confidence_level}
                onChange={(e) => setTagForm({ ...tagForm, confidence_level: e.target.value })}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>Low</span><span>Medium</span><span>High</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-slate-400 mb-2 font-medium flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5" /> Confluences Present
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {config.confluences.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleTagConfluence(c)}
                    className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                      tagForm.confluences.includes(c)
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Notes</label>
              <textarea
                value={tagForm.notes}
                onChange={(e) => setTagForm({ ...tagForm, notes: e.target.value })}
                placeholder="What were you thinking when you took this trade?"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setTaggingTradeId(null)}>Cancel</Button>
            <Button onClick={handleTagSubmit}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Save Tags
            </Button>
          </div>
        </div>
      </Modal>

      {/* Trade replay modal */}
      <Modal open={!!replayTradeId} onClose={() => setReplayTradeId(null)} title="Trade Replay" width="max-w-2xl">
        {replayTradeId && (() => {
          const trade = trades.find((t) => t.id === replayTradeId);
          if (!trade) return null;
          const pairData = pairs.find((p) => p.symbol === trade.pair);
          const candles = pairData?.candles || pairData?.timeframes?.['1h'] || [];
          return <TradeReplay trade={trade} candles={candles} />;
        })()}
      </Modal>
    </div>
  );
}
