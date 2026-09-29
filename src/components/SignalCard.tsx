import type { TradingSignal } from '@/lib/types';
import { Card, Badge, Button } from './ui';
import { getPairCategory } from '@/lib/forex';
import { TrendingUp, TrendingDown, Minus, Target, Shield, Zap, CheckCircle2, Circle, ChevronRight } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  forex: 'FX',
  metals: 'Metal',
  crypto: 'Crypto',
  indices: 'Index',
  energy: 'Energy',
};

interface SignalCardProps {
  signal: TradingSignal;
  onTrade?: (signal: TradingSignal) => void;
  onSelect?: (signal: TradingSignal) => void;
}

export function SignalCard({ signal, onTrade, onSelect }: SignalCardProps) {
  const dirConfig = {
    BUY: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'BUY' },
    SELL: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'SELL' },
    NEUTRAL: { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', label: 'NEUTRAL' },
  };

  const config = dirConfig[signal.direction];
  const Icon = config.icon;
  const strengthVariant = signal.strength === 'STRONG' ? 'success' : signal.strength === 'MODERATE' ? 'info' : 'neutral';

  const formatPrice = (p: number) => (p > 50 ? p.toFixed(2) : p.toFixed(5));
  const confluences = signal.readings.filter(r => r.signal !== 'NEUTRAL').length;

  const hasMTF = signal.timeframeAnalysis.length >= 4;

  return (
    <Card className={`p-4 border ${config.border} ${onSelect ? 'cursor-pointer hover:border-slate-600 active:scale-[0.99]' : ''} transition-all`} onClick={onSelect ? () => onSelect(signal) : undefined}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${config.bg}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-bold text-slate-100">{signal.pair}</h3>
              <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{CATEGORY_LABELS[getPairCategory(signal.pair)] || 'FX'}</span>
            </div>
            <p className="text-xs text-slate-500">{confluences} confluence{confluences !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-base sm:text-lg font-bold ${config.color} font-mono`}>{config.label}</div>
          <Badge variant={strengthVariant as 'success' | 'info' | 'neutral'}>{signal.strength}</Badge>
        </div>
      </div>

      {/* Multi-timeframe alignment bar (4 timeframes) */}
      {hasMTF && (
        <div className="flex items-center gap-0.5 sm:gap-1 mb-3 bg-slate-800/30 rounded-lg p-1.5">
          {signal.timeframeAnalysis.map((tf, i) => {
            const biasColor = tf.bias === 'bullish' ? 'text-green-400' : tf.bias === 'bearish' ? 'text-red-400' : 'text-slate-500';
            const statusIcon = tf.atPOI ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" /> : <Circle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600" />;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 text-[10px] sm:text-xs">
                {statusIcon}
                <span className="text-slate-500 font-medium">{tf.label}</span>
                <span className={biasColor}>{tf.bias === 'bullish' ? 'Bull' : tf.bias === 'bearish' ? 'Bear' : 'Range'}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <p className="text-xs text-slate-500">Entry</p>
          <p className="text-sm font-mono text-slate-200">{formatPrice(signal.entry)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-red-400" />
            <p className="text-xs text-slate-500">Stop</p>
          </div>
          <p className="text-sm font-mono text-red-400">{formatPrice(signal.stopLoss)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3 text-green-400" />
            <p className="text-xs text-slate-500">Target</p>
          </div>
          <p className="text-sm font-mono text-green-400">{formatPrice(signal.takeProfit)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-mono text-slate-300">{signal.confidence}%</span>
          </div>
          <div className="text-xs text-slate-500">
            R:R 1:{signal.riskRewardRatio.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500">
            {signal.pipsRisk.toFixed(0)}p risk
          </div>
        </div>
        {onTrade && signal.direction !== 'NEUTRAL' && (
          <Button size="sm" variant={signal.direction === 'BUY' ? 'primary' : 'danger'} onClick={() => onTrade(signal)}>
            Execute
          </Button>
        )}
      </div>

      {onSelect && (
        <div className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-slate-800/50 text-slate-600">
          <span className="text-[11px]">Tap for full analysis</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </Card>
  );
}
