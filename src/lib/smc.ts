import type { Candle, SwingPoint, MarketStructure, OrderBlock, FairValueGap, LiquidityLevel, SMCAnalysis, StrategyConfig } from './types';

// Detect swing highs and lows using fractal-based approach
export function detectSwingPoints(candles: Candle[], swingLength: number = 5): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];

  for (let i = swingLength; i < candles.length - swingLength; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= swingLength; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isSwingHigh = false;
      }
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      highs.push({ index: i, price: candles[i].high, type: 'HH', isHigh: true, time: candles[i].time, swept: false });
    }
    if (isSwingLow) {
      lows.push({ index: i, price: candles[i].low, type: 'LL', isHigh: false, time: candles[i].time, swept: false });
    }
  }

  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) highs[i].type = 'HH';
    else highs[i].type = 'LH';
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price > lows[i - 1].price) lows[i].type = 'HL';
    else lows[i].type = 'LL';
  }

  return { highs, lows };
}

export function detectMarketStructure(candles: Candle[], highs: SwingPoint[], lows: SwingPoint[]): MarketStructure {
  let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  let lastBOS: MarketStructure['lastBOS'] = null;
  let lastCHoCH: MarketStructure['lastCHoCH'] = null;

  const allSwings = [...highs.map(h => ({ ...h, isHigh: true })), ...lows.map(l => ({ ...l, isHigh: false }))]
    .sort((a, b) => a.index - b.index);

  let prevTrend: 'bullish' | 'bearish' | 'ranging' = 'ranging';

  for (let i = 0; i < allSwings.length; i++) {
    const swing = allSwings[i];
    for (let j = swing.index + 1; j < candles.length; j++) {
      if (swing.isHigh && candles[j].close > swing.price) {
        const direction = 'bullish' as const;
        if (prevTrend === 'bearish') { lastCHoCH = { index: j, direction, price: swing.price }; }
        else { lastBOS = { index: j, direction, price: swing.price }; }
        prevTrend = trend;
        trend = direction;
        break;
      }
      if (!swing.isHigh && candles[j].close < swing.price) {
        const direction = 'bearish' as const;
        if (prevTrend === 'bullish') { lastCHoCH = { index: j, direction, price: swing.price }; }
        else { lastBOS = { index: j, direction, price: swing.price }; }
        prevTrend = trend;
        trend = direction;
        break;
      }
    }
  }

  const sweptHighs = highs.map(h => {
    for (let j = h.index + 1; j < candles.length; j++) { if (candles[j].high > h.price) return { ...h, swept: true }; }
    return h;
  });
  const sweptLows = lows.map(l => {
    for (let j = l.index + 1; j < candles.length; j++) { if (candles[j].low < l.price) return { ...l, swept: true }; }
    return l;
  });

  return { trend, lastBOS, lastCHoCH, swingHighs: sweptHighs, swingLows: sweptLows };
}

export function detectOrderBlocks(candles: Candle[], minStrength: number = 2): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  for (let i = 2; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const current = candles[i];
    const next = candles[i + 1];
    const avgBody = candles.slice(Math.max(0, i - 20), i).reduce((s, c) => s + Math.abs(c.close - c.open), 0) / Math.min(20, i);

    // Bullish OB
    const downMove = prev.close < prev.open;
    const upMove = current.close > current.open && next.close > next.open;
    const moveStrength = Math.abs(current.close - current.open) + Math.abs(next.close - next.open);
    if (downMove && upMove && moveStrength > avgBody * minStrength) {
      const obTop = Math.max(prev.open, prev.close);
      const obBottom = Math.min(prev.open, prev.close);
      let mitigated = false;
      for (let j = i + 2; j < candles.length; j++) { if (candles[j].low <= obTop && candles[j].low >= obBottom) { mitigated = true; break; } }
      blocks.push({ index: i - 1, top: obTop, bottom: obBottom, direction: 'bullish', mitigated, time: prev.time, strength: moveStrength / avgBody });
    }

    // Bearish OB
    const upCandle = prev.close > prev.open;
    const downCandle = current.close < current.open && next.close < next.open;
    const downStrength = Math.abs(current.close - current.open) + Math.abs(next.close - next.open);
    if (upCandle && downCandle && downStrength > avgBody * minStrength) {
      const obTop = Math.max(prev.open, prev.close);
      const obBottom = Math.min(prev.open, prev.close);
      let mitigated = false;
      for (let j = i + 2; j < candles.length; j++) { if (candles[j].high >= obBottom && candles[j].high <= obTop) { mitigated = true; break; } }
      blocks.push({ index: i - 1, top: obTop, bottom: obBottom, direction: 'bearish', mitigated, time: prev.time, strength: downStrength / avgBody });
    }
  }
  return blocks.reverse().slice(0, 10);
}

export function detectFVGs(candles: Candle[], maxAge: number = 50): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const third = candles[i];
    if (third.low > first.high) {
      let filled = false;
      for (let j = i + 1; j < candles.length; j++) { if (candles[j].low <= third.low) { filled = true; break; } }
      if ((candles.length - i) <= maxAge) {
        fvgs.push({ index: i, top: third.low, bottom: first.high, direction: 'bullish', filled, time: candles[i].time });
      }
    }
    if (third.high < first.low) {
      let filled = false;
      for (let j = i + 1; j < candles.length; j++) { if (candles[j].high >= third.high) { filled = true; break; } }
      if ((candles.length - i) <= maxAge) {
        fvgs.push({ index: i, top: first.low, bottom: third.high, direction: 'bearish', filled, time: candles[i].time });
      }
    }
  }
  return fvgs.reverse().filter(f => !f.filled).slice(0, 8);
}

export function detectLiquidity(candles: Candle[], swingHighs: SwingPoint[], swingLows: SwingPoint[], minTouches: number = 2): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];
  const tolerance = (Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low))) * 0.001;

  const highGroups: { price: number; indices: number[] }[] = [];
  for (const h of swingHighs) {
    let added = false;
    for (const group of highGroups) { if (Math.abs(h.price - group.price) <= tolerance) { group.indices.push(h.index); added = true; break; } }
    if (!added) highGroups.push({ price: h.price, indices: [h.index] });
  }
  for (const group of highGroups) {
    if (group.indices.length >= minTouches) {
      let swept = false; let sweptIndex = null;
      const lastIdx = Math.max(...group.indices);
      for (let j = lastIdx + 1; j < candles.length; j++) { if (candles[j].high > group.price + tolerance) { swept = true; sweptIndex = j; break; } }
      levels.push({ price: group.price, type: 'buy-side', swept, sweptIndex, strength: group.indices.length, formedAtIndex: lastIdx });
    }
  }

  const lowGroups: { price: number; indices: number[] }[] = [];
  for (const l of swingLows) {
    let added = false;
    for (const group of lowGroups) { if (Math.abs(l.price - group.price) <= tolerance) { group.indices.push(l.index); added = true; break; } }
    if (!added) lowGroups.push({ price: l.price, indices: [l.index] });
  }
  for (const group of lowGroups) {
    if (group.indices.length >= minTouches) {
      let swept = false; let sweptIndex = null;
      const lastIdx = Math.max(...group.indices);
      for (let j = lastIdx + 1; j < candles.length; j++) { if (candles[j].low < group.price - tolerance) { swept = true; sweptIndex = j; break; } }
      levels.push({ price: group.price, type: 'sell-side', swept, sweptIndex, strength: group.indices.length, formedAtIndex: lastIdx });
    }
  }

  return levels.sort((a, b) => b.strength - a.strength);
}

export function calculatePremiumDiscount(candles: Candle[], structure: MarketStructure): SMCAnalysis['premiumDiscount'] {
  const recentHighs = structure.swingHighs.slice(-5);
  const recentLows = structure.swingLows.slice(-5);
  const highest = recentHighs.length > 0 ? Math.max(...recentHighs.map(h => h.price)) : Math.max(...candles.slice(-50).map(c => c.high));
  const lowest = recentLows.length > 0 ? Math.min(...recentLows.map(l => l.price)) : Math.min(...candles.slice(-50).map(c => c.low));
  const equilibrium = (highest + lowest) / 2;
  const currentPrice = candles[candles.length - 1].close;
  return {
    premium: { top: highest, bottom: equilibrium },
    discount: { top: equilibrium, bottom: lowest },
    equilibrium,
    currentZone: currentPrice > equilibrium ? 'premium' : currentPrice < equilibrium ? 'discount' : 'equilibrium',
  };
}

export function analyzeSMC(candles: Candle[], strategy: StrategyConfig): SMCAnalysis {
  const { highs, lows } = detectSwingPoints(candles, strategy.swingLength);
  const structure = detectMarketStructure(candles, highs, lows);
  const orderBlocks = detectOrderBlocks(candles, strategy.minOrderBlockStrength);
  const fairValueGaps = detectFVGs(candles, strategy.fvgMaxAge);
  const liquidity = detectLiquidity(candles, highs, lows, strategy.liquidityMinTouches);
  const premiumDiscount = calculatePremiumDiscount(candles, structure);
  return { structure, orderBlocks, fairValueGaps, liquidity, premiumDiscount };
}
