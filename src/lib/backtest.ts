import type { Candle, BacktestResult, BacktestTrade, StrategyConfig } from './types';
import { getPipSize } from './forex';
import { detectSwingPoints, detectMarketStructure, detectOrderBlocks, detectLiquidity, calculatePremiumDiscount } from './smc';
import { atr } from './indicators';

export function runBacktest(
  symbol: string,
  candles: Candle[],
  strategy: StrategyConfig
): BacktestResult {
  const pipSize = getPipSize(symbol);

  const { highs, lows } = detectSwingPoints(candles, strategy.swingLength);
  const structure = detectMarketStructure(candles, highs, lows);
  const orderBlocks = detectOrderBlocks(candles, strategy.minOrderBlockStrength);
  const liquidity = detectLiquidity(candles, highs, lows, strategy.liquidityMinTouches);
  const pd = calculatePremiumDiscount(candles, structure);

  const atrArr = atr(candles, 14);

  const trades: BacktestTrade[] = [];
  let position: {
    direction: 'BUY' | 'SELL';
    entryIndex: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
  } | null = null;

  const startIndex = strategy.swingLength * 2 + 5;

  // Build a map of order blocks by index for quick lookup
  const obByIndex = new Map(orderBlocks.map(ob => [ob.index, ob]));

  for (let i = startIndex; i < candles.length; i++) {
    const price = candles[i].close;

    // Check exit conditions for open position
    if (position) {
      const pos = position;
      let exitPrice = -1;
      let result: 'win' | 'loss' = 'loss';
      let reason = '';

      if (pos.direction === 'BUY') {
        if (candles[i].low <= pos.stopLoss) {
          exitPrice = pos.stopLoss;
          result = 'loss';
          reason = 'Stop loss hit';
        } else if (candles[i].high >= pos.takeProfit) {
          exitPrice = pos.takeProfit;
          result = 'win';
          reason = 'Take profit hit';
        } else {
          // Check for CHoCH against position
          const recentHighs = highs.filter(h => h.index > pos.entryIndex && h.index <= i);
          if (recentHighs.length > 0) {
            const lastHigh = recentHighs[recentHighs.length - 1];
            // If a lower high forms after entry and price breaks below it
            if (lastHigh.type === 'LH' && candles[i].close < lastHigh.price && structure.trend === 'bearish') {
              exitPrice = price;
              result = price >= pos.entryPrice ? 'win' : 'loss';
              reason = 'Structure shift (CHoCH)';
            }
          }
        }
      } else {
        if (candles[i].high >= pos.stopLoss) {
          exitPrice = pos.stopLoss;
          result = 'loss';
          reason = 'Stop loss hit';
        } else if (candles[i].low <= pos.takeProfit) {
          exitPrice = pos.takeProfit;
          result = 'win';
          reason = 'Take profit hit';
        } else {
          const recentLows = lows.filter(l => l.index > pos.entryIndex && l.index <= i);
          if (recentLows.length > 0) {
            const lastLow = recentLows[recentLows.length - 1];
            if (lastLow.type === 'HL' && candles[i].close > lastLow.price && structure.trend === 'bullish') {
              exitPrice = price;
              result = price <= pos.entryPrice ? 'win' : 'loss';
              reason = 'Structure shift (CHoCH)';
            }
          }
        }
      }

      if (exitPrice >= 0) {
        const pips = position.direction === 'BUY'
          ? (exitPrice - position.entryPrice) / pipSize
          : (position.entryPrice - exitPrice) / pipSize;

        trades.push({
          entryIndex: position.entryIndex,
          exitIndex: i,
          direction: position.direction,
          entryPrice: position.entryPrice,
          exitPrice,
          pips,
          result,
          entryTime: candles[position.entryIndex].time,
          exitTime: candles[i].time,
          reason,
        });
        position = null;
      }
    }

    // Check for entry: price at unmitigated OB in premium/discount zone
    if (!position) {
      const atrVal = atrArr[i] || pipSize * 20;
      const currentZone = price > pd.equilibrium ? 'premium' : 'discount';

      // Find nearby unmitigated OB
      const nearbyBullOB = orderBlocks.find(ob =>
        !ob.mitigated && ob.direction === 'bullish' &&
        ob.index < i && ob.index > i - 30 &&
        price >= ob.bottom && price <= ob.top * 1.002
      );

      const nearbyBearOB = orderBlocks.find(ob =>
        !ob.mitigated && ob.direction === 'bearish' &&
        ob.index < i && ob.index > i - 30 &&
        price <= ob.top && price >= ob.bottom * 0.998
      );

      // Check for liquidity sweep
      const sweptSellSide = liquidity.find(l =>
        l.type === 'sell-side' && l.swept && l.sweptIndex !== null &&
        Math.abs(l.sweptIndex - i) < 3
      );
      const sweptBuySide = liquidity.find(l =>
        l.type === 'buy-side' && l.swept && l.sweptIndex !== null &&
        Math.abs(l.sweptIndex - i) < 3
      );

      const slDistance = atrVal * strategy.atrMultiplierSL;
      const tpDistance = slDistance * strategy.riskRewardMin;

      // Bullish entry: OB in discount + bullish structure, or sell-side liquidity sweep
      if (nearbyBullOB && currentZone === 'discount' && structure.trend !== 'bearish') {
        const entry = nearbyBullOB.bottom;
        position = {
          direction: 'BUY',
          entryIndex: i,
          entryPrice: entry,
          stopLoss: entry - slDistance,
          takeProfit: entry + tpDistance,
        };
      } else if (sweptSellSide && structure.trend !== 'bearish') {
        position = {
          direction: 'BUY',
          entryIndex: i,
          entryPrice: price,
          stopLoss: price - slDistance,
          takeProfit: price + tpDistance,
        };
      }

      // Bearish entry: OB in premium + bearish structure, or buy-side liquidity sweep
      if (!position && nearbyBearOB && currentZone === 'premium' && structure.trend !== 'bullish') {
        const entry = nearbyBearOB.top;
        position = {
          direction: 'SELL',
          entryIndex: i,
          entryPrice: entry,
          stopLoss: entry + slDistance,
          takeProfit: entry - tpDistance,
        };
      } else if (!position && sweptBuySide && structure.trend !== 'bullish') {
        position = {
          direction: 'SELL',
          entryIndex: i,
          entryPrice: price,
          stopLoss: price + slDistance,
          takeProfit: price - tpDistance,
        };
      }
    }
  }

  // Close remaining position
  if (position) {
    const lastPrice = candles[candles.length - 1].close;
    const pips = position.direction === 'BUY'
      ? (lastPrice - position.entryPrice) / pipSize
      : (position.entryPrice - lastPrice) / pipSize;
    trades.push({
      entryIndex: position.entryIndex,
      exitIndex: candles.length - 1,
      direction: position.direction,
      entryPrice: position.entryPrice,
      exitPrice: lastPrice,
      pips,
      result: pips >= 0 ? 'win' : 'loss',
      entryTime: candles[position.entryIndex].time,
      exitTime: candles[candles.length - 1].time,
      reason: 'End of data',
    });
  }

  return computeStats(symbol, trades);
}

function computeStats(symbol: string, trades: BacktestTrade[]): BacktestResult {
  const wins = trades.filter((t) => t.result === 'win');
  const losses = trades.filter((t) => t.result === 'loss');
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const totalPips = trades.reduce((sum, t) => sum + t.pips, 0);
  const avgWinPips = wins.length > 0 ? wins.reduce((s, t) => s + t.pips, 0) / wins.length : 0;
  const avgLossPips = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pips, 0) / losses.length) : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pips, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pips, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  let peak = 0;
  let running = 0;
  let maxDD = 0;
  for (const t of trades) {
    running += t.pips;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  let longestWin = 0;
  let longestLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of trades) {
    if (t.result === 'win') {
      curWin++;
      curLoss = 0;
      if (curWin > longestWin) longestWin = curWin;
    } else {
      curLoss++;
      curWin = 0;
      if (curLoss > longestLoss) longestLoss = curLoss;
    }
  }

  const equity = trades.reduce((sum, t) => sum + t.pips, 0);

  return {
    pair: symbol,
    strategy: 'SMC: OB + Liquidity + Structure',
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPips,
    avgWinPips,
    avgLossPips,
    profitFactor,
    maxDrawdownPips: maxDD,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    equity,
    trades,
  };
}
