import { useState, useMemo } from 'react';
import type { PairData, TradingSignal, StrategyConfig, TimeframeKey } from '@/lib/types';
import { Card, Badge, Button, Input, Select } from '@/components/ui';
import { SignalCard } from '@/components/SignalCard';
import { CandleChart } from '@/components/CandleChart';
import { Gauge } from '@/components/Gauge';
import { scanAllPairs, filterStrongSignals, DEFAULT_STRATEGY } from '@/lib/signalEngine';
import { PAIR_CATEGORIES, getPairCategory } from '@/lib/forex';
import type { PairCategory } from '@/lib/forex';
import { Activity, Filter, RefreshCw, X, Layers, Droplets, Anchor, CheckCircle2, Circle, ArrowDown } from 'lucide-react';

interface ScannerProps {
  pairs: PairData[];
  strategy: StrategyConfig;
  onStrategyChange: (s: StrategyConfig) => void;
  onExecuteTrade: (signal: TradingSignal) => void;
  lastUpdate: number;
  onRefresh: () => void;
  isLive: boolean;
  refreshing?: boolean;
}

export function Scanner({ pairs, strategy, onStrategyChange, onExecuteTrade, lastUpdate, onRefresh, isLive, refreshing }: ScannerProps) {
  const [filterDir, setFilterDir] = useState<string>('ALL');
  const [filterStrength, setFilterStrength] = useState<string>('ALL');
  const [filterAligned, setFilterAligned] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const signals = useMemo(() => scanAllPairs(pairs, strategy), [pairs, strategy]);
  const filteredSignals = useMemo(() => {
    let result = filterStrongSignals(signals, 0);
    if (filterDir !== 'ALL') result = result.filter((s) => s.direction === filterDir);
    if (filterStrength !== 'ALL') {
      if (filterStrength === 'STRONG') result = result.filter((s) => s.strength === 'STRONG');
      else if (filterStrength === 'MODERATE') result = result.filter((s) => s.strength === 'STRONG' || s.strength === 'MODERATE');
    }
    if (filterAligned) result = result.filter((s) => s.timeframeAnalysis.length >= 4 && s.htfBias !== 'ranging' && s.mtfAtPOI);
    if (filterCategory !== 'ALL') result = result.filter((s) => getPairCategory(s.pair) === filterCategory);
    return result.sort((a, b) => b.confidence - a.confidence);
  }, [signals, filterDir, filterStrength, filterAligned, filterCategory]);

  const selectedSignal = selectedPair ? signals.find((s) => s.pair === selectedPair) : null;
  const selectedPairData = selectedPair ? pairs.find((p) => p.symbol === selectedPair) : null;

  const formatPrice = (p: number) => (p > 50 ? p.toFixed(2) : p.toFixed(5));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">SMC Scanner</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {strategy.htfTimeframe === '1D' ? 'Daily' : strategy.htfTimeframe.toUpperCase()} → {strategy.mtfTimeframe.toUpperCase()} → {strategy.ltfTimeframe.toUpperCase()} → {strategy.entryTimeframe.toUpperCase()}
              {!isLive && <span className="text-amber-400 ml-1">(simulated)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={onRefresh}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowSettings(!showSettings)}>
              <Filter className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Strategy</span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-600">Updated {new Date(lastUpdate).toLocaleTimeString()}</p>
      </div>

      {/* Strategy settings panel */}
      {showSettings && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">SMC Parameters</h2>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input label="Swing Length" type="number" value={strategy.swingLength} onChange={(v) => onStrategyChange({ ...strategy, swingLength: +v })} />
            <Input label="Min OB Strength" type="number" step="0.1" value={strategy.minOrderBlockStrength} onChange={(v) => onStrategyChange({ ...strategy, minOrderBlockStrength: +v })} />
            <Input label="FVG Max Age" type="number" value={strategy.fvgMaxAge} onChange={(v) => onStrategyChange({ ...strategy, fvgMaxAge: +v })} />
            <Input label="Min Liq Touches" type="number" value={strategy.liquidityMinTouches} onChange={(v) => onStrategyChange({ ...strategy, liquidityMinTouches: +v })} />
            <Input label="Min R:R" type="number" step="0.1" value={strategy.riskRewardMin} onChange={(v) => onStrategyChange({ ...strategy, riskRewardMin: +v })} />
            <Input label="Min Confidence" type="number" value={strategy.minConfidence} onChange={(v) => onStrategyChange({ ...strategy, minConfidence: +v })} />
            <Input label="ATR SL Mult" type="number" step="0.1" value={strategy.atrMultiplierSL} onChange={(v) => onStrategyChange({ ...strategy, atrMultiplierSL: +v })} />
            <div className="flex flex-col">
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">P/D Filter</label>
              <button
                onClick={() => onStrategyChange({ ...strategy, premiumDiscountOnly: !strategy.premiumDiscountOnly })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${strategy.premiumDiscountOnly ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                {strategy.premiumDiscountOnly ? 'On' : 'Off'}
              </button>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Timeframe Selection (Top-Down 4-Tier)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Select
                label="HTF (Bias)"
                value={strategy.htfTimeframe}
                onChange={(v) => onStrategyChange({ ...strategy, htfTimeframe: v as TimeframeKey })}
                options={[
                  { value: '1D', label: 'Daily' },
                  { value: '4h', label: '4 Hour' },
                  { value: '1h', label: '1 Hour' },
                ]}
              />
              <Select
                label="MTF (POI)"
                value={strategy.mtfTimeframe}
                onChange={(v) => onStrategyChange({ ...strategy, mtfTimeframe: v as TimeframeKey })}
                options={[
                  { value: '1D', label: 'Daily' },
                  { value: '4h', label: '4 Hour' },
                  { value: '1h', label: '1 Hour' },
                ]}
              />
              <Select
                label="LTF (MSS)"
                value={strategy.ltfTimeframe}
                onChange={(v) => onStrategyChange({ ...strategy, ltfTimeframe: v as TimeframeKey })}
                options={[
                  { value: '4h', label: '4 Hour' },
                  { value: '1h', label: '1 Hour' },
                  { value: '15m', label: '15 Min' },
                ]}
              />
              <Select
                label="Entry TF"
                value={strategy.entryTimeframe}
                onChange={(v) => onStrategyChange({ ...strategy, entryTimeframe: v as TimeframeKey })}
                options={[
                  { value: '1h', label: '1 Hour' },
                  { value: '15m', label: '15 Min' },
                ]}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Select
          value={filterCategory}
          onChange={setFilterCategory}
          options={[
            { value: 'ALL', label: 'All Assets' },
            ...PAIR_CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
          ]}
          className="w-32 sm:w-40"
        />
        <Select
          value={filterDir}
          onChange={setFilterDir}
          options={[
            { value: 'ALL', label: 'All Directions' },
            { value: 'BUY', label: 'Buy Only' },
            { value: 'SELL', label: 'Sell Only' },
          ]}
          className="w-32 sm:w-40"
        />
        <Select
          value={filterStrength}
          onChange={setFilterStrength}
          options={[
            { value: 'ALL', label: 'All Strengths' },
            { value: 'STRONG', label: 'Strong Only' },
            { value: 'MODERATE', label: 'Moderate+' },
          ]}
          className="w-32 sm:w-40"
        />
        <button
          onClick={() => setFilterAligned(!filterAligned)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${filterAligned ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          Aligned
        </button>
        <span className="text-xs sm:text-sm text-slate-500 ml-auto">
          {filteredSignals.length} signal{filteredSignals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* All pairs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSignals.map((sig) => (
          <SignalCard key={sig.pair} signal={sig} onTrade={onExecuteTrade} onSelect={() => setSelectedPair(sig.pair)} />
        ))}
      </div>

      {filteredSignals.length === 0 && (
        <Card className="p-12 text-center">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No signals match your filters</p>
          <p className="text-sm text-slate-500 mt-1">The scanner is monitoring all pairs. Signals appear when HTF bias, MTF POI, LTF MSS, and entry TF inducement+OB all align.</p>
        </Card>
      )}

      {/* Detail modal */}
      {selectedSignal && selectedPairData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPair(null)}>
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-100">{selectedSignal.pair}</h2>
                <Badge variant={selectedSignal.direction === 'BUY' ? 'success' : selectedSignal.direction === 'SELL' ? 'danger' : 'neutral'}>
                  {selectedSignal.direction} - {selectedSignal.strength}
                </Badge>
              </div>
              <button onClick={() => setSelectedPair(null)} className="text-slate-400 hover:text-slate-200 text-2xl leading-none">
                &times;
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* 4-timeframe top-down flow */}
              {selectedSignal.timeframeAnalysis.length >= 4 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-slate-400 mb-4">Top-Down Multi-Timeframe Flow</h3>
                  {/* Timeframe flow — vertical on mobile, horizontal on desktop */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    {selectedSignal.timeframeAnalysis.map((tf, i) => {
                      const biasColor = tf.bias === 'bullish' ? 'text-green-400' : tf.bias === 'bearish' ? 'text-red-400' : 'text-slate-500';
                      const biasBg = tf.bias === 'bullish' ? 'bg-green-500/10 border-green-500/20' : tf.bias === 'bearish' ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-500/10 border-slate-500/20';
                      return (
                        <div key={i} className="flex items-center gap-2 md:gap-1 md:flex-1">
                          <div className={`flex-1 rounded-lg border p-2.5 ${biasBg}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-slate-300">{tf.label}</span>
                              {tf.atPOI ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Circle className="w-3.5 h-3.5 text-slate-600" />}
                            </div>
                            <p className={`text-xs font-bold ${biasColor}`}>
                              {tf.bias === 'bullish' ? 'Bullish' : tf.bias === 'bearish' ? 'Bearish' : 'Ranging'}
                            </p>
                            {tf.poiType && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {tf.atPOI ? tf.poiType : 'No POI'}
                              </p>
                            )}
                          </div>
                          {i < 3 && <ArrowDown className="w-3 h-3 text-slate-600 md:rotate-[-90deg] flex-shrink-0 mx-auto" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${selectedSignal.htfBias === 'bullish' ? 'bg-green-500/10 text-green-400' : selectedSignal.htfBias === 'bearish' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      HTF Bias: {selectedSignal.htfBias}
                    </span>
                    <span className={`px-2 py-1 rounded ${selectedSignal.mtfAtPOI ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      MTF at POI: {selectedSignal.mtfAtPOI ? 'Yes' : 'No'}
                    </span>
                    <span className={`px-2 py-1 rounded ${selectedSignal.ltfTrigger ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      LTF + Entry: {selectedSignal.ltfTrigger ? 'Confirmed' : 'Waiting'}
                    </span>
                  </div>
                </Card>
              )}

              {/* Chart */}
              <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
                <div style={{ height: 280 }}>
                  <CandleChart candles={selectedPairData.candles} symbol={selectedSignal.pair} height={280} showVolume />
                </div>
              </div>

              {/* Confidence + trade levels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 flex flex-col items-center justify-center">
                  <Gauge value={selectedSignal.confidence} label="Signal Confidence" size={140} />
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-slate-400 mb-3">Trade Setup</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-400">Entry</span>
                      <span className="text-sm font-mono text-slate-200">{formatPrice(selectedSignal.entry)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-400">Stop Loss</span>
                      <span className="text-sm font-mono text-red-400">{formatPrice(selectedSignal.stopLoss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-400">Take Profit</span>
                      <span className="text-sm font-mono text-green-400">{formatPrice(selectedSignal.takeProfit)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 mt-2">
                      <span className="text-sm text-slate-400">Risk</span>
                      <span className="text-sm font-mono text-amber-400">{selectedSignal.pipsRisk.toFixed(0)} pips</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-400">Reward</span>
                      <span className="text-sm font-mono text-green-400">{selectedSignal.pipsReward.toFixed(0)} pips</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-400">R:R Ratio</span>
                      <span className="text-sm font-mono text-blue-400">1:{selectedSignal.riskRewardRatio.toFixed(1)}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* SMC readings breakdown */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">SMC Analysis Breakdown</h3>
                <div className="space-y-3">
                  {selectedSignal.readings.map((reading, i) => (
                    <div key={i} className="border-b border-slate-800 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-300 font-medium">{reading.name}</span>
                          {reading.timeframe && (
                            <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{reading.timeframe === '1D' ? 'Daily' : reading.timeframe.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{reading.value}</span>
                          <Badge variant={reading.signal === 'BUY' ? 'success' : reading.signal === 'SELL' ? 'danger' : 'neutral'}>
                            {reading.signal}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{reading.detail}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* SMC zones visualization */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">Key Levels (MTF)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Order Blocks */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400 font-medium">Order Blocks</span>
                    </div>
                    {selectedSignal.smc.orderBlocks.filter(ob => !ob.mitigated).slice(0, 3).map((ob, i) => (
                      <div key={i} className="text-xs mb-1">
                        <span className={ob.direction === 'bullish' ? 'text-green-400' : 'text-red-400'}>
                          {ob.direction === 'bullish' ? 'Bull' : 'Bear'} OB
                        </span>
                        <span className="text-slate-500 ml-1">{formatPrice(ob.bottom)} - {formatPrice(ob.top)}</span>
                      </div>
                    ))}
                    {selectedSignal.smc.orderBlocks.filter(ob => !ob.mitigated).length === 0 && (
                      <span className="text-xs text-slate-600">None nearby</span>
                    )}
                  </div>

                  {/* FVGs */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Droplets className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-slate-400 font-medium">Fair Value Gaps</span>
                    </div>
                    {selectedSignal.smc.fairValueGaps.filter(f => !f.filled).slice(0, 3).map((fvg, i) => (
                      <div key={i} className="text-xs mb-1">
                        <span className={fvg.direction === 'bullish' ? 'text-green-400' : 'text-red-400'}>
                          {fvg.direction === 'bullish' ? 'Bull' : 'Bear'} FVG
                        </span>
                        <span className="text-slate-500 ml-1">{formatPrice(fvg.bottom)} - {formatPrice(fvg.top)}</span>
                      </div>
                    ))}
                    {selectedSignal.smc.fairValueGaps.filter(f => !f.filled).length === 0 && (
                      <span className="text-xs text-slate-600">None nearby</span>
                    )}
                  </div>

                  {/* Liquidity */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Anchor className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-slate-400 font-medium">Liquidity</span>
                    </div>
                    {selectedSignal.smc.liquidity.slice(0, 3).map((liq, i) => (
                      <div key={i} className="text-xs mb-1">
                        <span className={liq.type === 'buy-side' ? 'text-amber-400' : 'text-blue-400'}>
                          {liq.type === 'buy-side' ? 'Buy-side' : 'Sell-side'}
                        </span>
                        <span className="text-slate-500 ml-1">{formatPrice(liq.price)}</span>
                        {liq.swept && <span className="text-red-400 ml-1">(swept)</span>}
                      </div>
                    ))}
                    {selectedSignal.smc.liquidity.length === 0 && (
                      <span className="text-xs text-slate-600">None detected</span>
                    )}
                  </div>
                </div>
              </Card>

              {selectedSignal.direction !== 'NEUTRAL' && (
                <Button
                  variant={selectedSignal.direction === 'BUY' ? 'primary' : 'danger'}
                  size="lg"
                  className="w-full"
                  onClick={() => { onExecuteTrade(selectedSignal); setSelectedPair(null); }}
                >
                  Execute {selectedSignal.direction} on {selectedSignal.pair}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
