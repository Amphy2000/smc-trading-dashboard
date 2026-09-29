import { useState, useMemo } from 'react';
import { Card, Input, Select, Button, PairSelect } from '@/components/ui';
import { getPipSize, getPipValuePerLot, pipsBetween } from '@/lib/forex';
import { Calculator, Shield, Target, DollarSign, TrendingUp } from 'lucide-react';

interface RiskCalcProps {
  accountBalance: number;
  riskPerTrade: number;
  currency: string;
}

export function RiskCalculator({ accountBalance, riskPerTrade, currency }: RiskCalcProps) {
  const [pair, setPair] = useState('EUR/USD');
  const [entry, setEntry] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [customRisk, setCustomRisk] = useState(riskPerTrade.toString());
  const [customBalance, setCustomBalance] = useState(accountBalance.toString());

  const calc = useMemo(() => {
    const bal = parseFloat(customBalance) || accountBalance;
    const riskPct = parseFloat(customRisk) || riskPerTrade;
    const entryPrice = parseFloat(entry);
    const slPrice = parseFloat(stopLoss);
    const tpPrice = parseFloat(takeProfit);

    if (!entryPrice || !slPrice) return null;

    const pipSize = getPipSize(pair);
    const riskPips = pipsBetween(pair, entryPrice, slPrice);
    const rewardPips = tpPrice ? pipsBetween(pair, entryPrice, tpPrice) : 0;
    const riskAmount = bal * (riskPct / 100);
    const pipValue = getPipValuePerLot(pair);
    const requiredLots = riskPips > 0 ? riskAmount / (riskPips * pipValue) : 0;
    const rrRatio = riskPips > 0 ? rewardPips / riskPips : 0;
    const potentialProfit = rewardPips * requiredLots * pipValue;
    const potentialLoss = riskPips * requiredLots * pipValue;

    return {
      riskPips,
      rewardPips,
      riskAmount,
      pipValue,
      requiredLots,
      rrRatio,
      potentialProfit,
      potentialLoss,
    };
  }, [customBalance, customRisk, accountBalance, riskPerTrade, entry, stopLoss, takeProfit, pair]);

  const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : '$';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Risk Calculator</h1>
        <p className="text-sm text-slate-500 mt-1">Calculate position size, risk, and reward before entering any trade</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Calculator className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">Trade Setup</h2>
          </div>
          <div className="space-y-4">
            <PairSelect label="Instrument" value={pair} onChange={setPair} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Entry Price" type="number" step="any" value={entry} onChange={setEntry} placeholder="0.00000" />
              <Input label="Stop Loss" type="number" step="any" value={stopLoss} onChange={setStopLoss} placeholder="0.00000" />
              <Input label="Take Profit" type="number" step="any" value={takeProfit} onChange={setTakeProfit} placeholder="0.00000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Account Balance" type="number" value={customBalance} onChange={setCustomBalance} />
              <Input label="Risk % per Trade" type="number" step="0.1" value={customRisk} onChange={setCustomRisk} />
            </div>
          </div>
        </Card>

        {/* Results */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-5">Position Sizing</h2>
          {calc ? (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 uppercase mb-1">Recommended Position Size</p>
                <p className="text-3xl sm:text-4xl font-bold text-blue-400 font-mono">{calc.requiredLots.toFixed(2)}</p>
                <p className="text-sm text-slate-500 mt-1">lots</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="w-4 h-4 text-red-400" />
                    <p className="text-xs text-slate-400">Risk Amount</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-red-400 font-mono">{currencySymbol}{calc.riskAmount.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{calc.riskPips.toFixed(0)} pips</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-4 h-4 text-green-400" />
                    <p className="text-xs text-slate-400">Potential Profit</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-green-400 font-mono">{currencySymbol}{calc.potentialProfit.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{calc.rewardPips.toFixed(0)} pips</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-slate-400">R:R Ratio</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-blue-400 font-mono">1:{calc.rrRatio.toFixed(1)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <p className="text-xs text-slate-400">Pip Value</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-slate-200 font-mono">{currencySymbol}{calc.pipValue.toFixed(2)}</p>
                </div>
              </div>

              {calc.rrRatio < 1.5 && calc.rrRatio > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                  <div className="text-amber-400 text-sm">
                    <strong>Warning:</strong> Risk:Reward below 1:1.5. Consider a tighter stop or wider target.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              Enter entry price and stop loss to calculate
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
