import type { PairData, TradingSignal, SMCReading, SignalDirection, SignalStrength, StrategyConfig, Candle, TimeframeKey, TimeframeAnalysis, SMCAnalysis, OrderBlock, LiquidityLevel } from './types';
import { getPipSize, pipsBetween } from './forex';
import { analyzeSMC } from './smc';
import { atr } from './indicators';

export const DEFAULT_STRATEGY: StrategyConfig = {
  swingLength: 5,
  minOrderBlockStrength: 1.5,
  fvgMaxAge: 50,
  liquidityMinTouches: 2,
  riskRewardMin: 2,
  minConfidence: 55,
  atrMultiplierSL: 1.5,
  premiumDiscountOnly: true,
  htfTimeframe: '1D',
  mtfTimeframe: '4h',
  ltfTimeframe: '1h',
  entryTimeframe: '15m',
};

const TF_LABELS: Record<TimeframeKey, string> = {
  '1D': 'Daily',
  '4h': '4H',
  '1h': '1H',
  '15m': '15M',
};

const TF_ORDER: TimeframeKey[] = ['1D', '4h', '1h', '15m'];

function formatPrice(p: number, symbol: string): string {
  const pipSize = getPipSize(symbol);
  return p > 50 ? p.toFixed(2) : p.toFixed(5);
}

// Check if price is inside or near an order block
function isPriceAtOB(price: number, ob: OrderBlock, tolerance: number = 0.002): boolean {
  const range = ob.top - ob.bottom;
  const paddedTop = ob.top + range * tolerance;
  const paddedBottom = ob.bottom - range * tolerance;
  return price >= paddedBottom && price <= paddedTop;
}

// Find the most recent unmitigated OB near price, aligned with direction
function findNearbyOB(price: number, orderBlocks: OrderBlock[], direction: 'bullish' | 'bearish'): OrderBlock | null {
  const unmitigated = orderBlocks.filter(ob => !ob.mitigated && ob.direction === direction);
  for (const ob of unmitigated) {
    if (isPriceAtOB(price, ob)) return ob;
  }
  return null;
}

// Check if there's a Market Structure Shift (MSS) / CHoCH on this timeframe
// Returns the MSS info if found within the last `lookback` candles
function findMSS(
  smc: SMCAnalysis,
  candleCount: number,
  lookback: number,
  direction: 'bullish' | 'bearish'
): { index: number; direction: 'bullish' | 'bearish'; price: number } | null {
  const choch = smc.structure.lastCHoCH;
  const bos = smc.structure.lastBOS;

  // CHoCH is the primary MSS signal — it's the first break against the prior trend
  if (choch && choch.direction === direction && (candleCount - choch.index) <= lookback) {
    return choch;
  }
  // BOS after a CHoCH in the same direction also counts as MSS
  if (bos && bos.direction === direction && (candleCount - bos.index) <= lookback) {
    return bos;
  }
  return null;
}

// Find inducement: the first pullback after an MSS
// After a bullish MSS, inducement is the first swing low formed after the MSS index
// After a bearish MSS, inducement is the first swing high formed after the MSS index
function findInducement(
  smc: SMCAnalysis,
  mssIndex: number,
  candleCount: number,
  direction: 'bullish' | 'bearish'
): { price: number; index: number } | null {
  if (direction === 'bullish') {
    // After bullish MSS, look for the first swing low (pullback) after MSS
    const swingLows = smc.structure.swingLows.filter(l => l.index > mssIndex && l.index < candleCount);
    if (swingLows.length > 0) {
      const first = swingLows[0];
      return { price: first.price, index: first.index };
    }
  } else {
    // After bearish MSS, look for the first swing high (pullback) after MSS
    const swingHighs = smc.structure.swingHighs.filter(h => h.index > mssIndex && h.index < candleCount);
    if (swingHighs.length > 0) {
      const first = swingHighs[0];
      return { price: first.price, index: first.index };
    }
  }
  return null;
}

// Check if a liquidity level has been swept recently (within lookback candles)
function findRecentSweep(
  liquidity: LiquidityLevel[],
  candleCount: number,
  lookback: number,
  type: 'buy-side' | 'sell-side'
): LiquidityLevel | null {
  return liquidity.find(l =>
    l.type === type &&
    l.swept &&
    l.sweptIndex !== null &&
    (candleCount - l.sweptIndex) <= lookback
  ) || null;
}

// Analyze a single timeframe for SMC
function analyzeTimeframe(
  symbol: string,
  timeframe: TimeframeKey,
  candles: Candle[],
  strategy: StrategyConfig,
  htfBias: 'bullish' | 'bearish' | 'ranging' | null
): TimeframeAnalysis {
  const smc = analyzeSMC(candles, strategy);
  const price = candles[candles.length - 1].close;
  const fmt = (p: number) => formatPrice(p, symbol);

  // Determine bias from structure
  let bias: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (smc.structure.lastCHoCH) {
    bias = smc.structure.lastCHoCH.direction;
  } else if (smc.structure.lastBOS) {
    bias = smc.structure.lastBOS.direction;
  }

  // Check if price is at a POI (order block or FVG)
  let atPOI = false;
  let poiType: string | null = null;
  let poiDetail: string | null = null;

  const unmitigatedOBs = smc.orderBlocks.filter(ob => !ob.mitigated);
  const nearbyBullOB = unmitigatedOBs.find(ob => ob.direction === 'bullish' && isPriceAtOB(price, ob));
  const nearbyBearOB = unmitigatedOBs.find(ob => ob.direction === 'bearish' && isPriceAtOB(price, ob));

  const unfilledFVGs = smc.fairValueGaps.filter(f => !f.filled);
  const nearbyBullFVG = unfilledFVGs.find(f => f.direction === 'bullish' && price >= f.bottom && price <= f.top * 1.001);
  const nearbyBearFVG = unfilledFVGs.find(f => f.direction === 'bearish' && price <= f.top && price >= f.bottom * 0.999);

  if (nearbyBullOB) {
    atPOI = true;
    poiType = 'Bullish OB';
    poiDetail = `Price is testing a bullish order block at ${fmt(nearbyBullOB.bottom)} - ${fmt(nearbyBullOB.top)}`;
  } else if (nearbyBearOB) {
    atPOI = true;
    poiType = 'Bearish OB';
    poiDetail = `Price is testing a bearish order block at ${fmt(nearbyBearOB.bottom)} - ${fmt(nearbyBearOB.top)}`;
  } else if (nearbyBullFVG) {
    atPOI = true;
    poiType = 'Bullish FVG';
    poiDetail = `Price is filling a bullish FVG at ${fmt(nearbyBullFVG.bottom)} - ${fmt(nearbyBullFVG.top)}`;
  } else if (nearbyBearFVG) {
    atPOI = true;
    poiType = 'Bearish FVG';
    poiDetail = `Price is filling a bearish FVG at ${fmt(nearbyBearFVG.bottom)} - ${fmt(nearbyBearFVG.top)}`;
  }

  // For LTF: also check for liquidity sweep as entry trigger
  if (htfBias !== null && timeframe === strategy.entryTimeframe) {
    const sweptSellSide = findRecentSweep(smc.liquidity, candles.length, 10, 'sell-side');
    const sweptBuySide = findRecentSweep(smc.liquidity, candles.length, 10, 'buy-side');

    if (sweptSellSide && htfBias === 'bullish') {
      atPOI = true;
      poiType = 'Sell-side Liquidity Sweep';
      poiDetail = `Sell-side liquidity swept at ${fmt(sweptSellSide.price)} — LTF entry trigger for long`;
    } else if (sweptBuySide && htfBias === 'bearish') {
      atPOI = true;
      poiType = 'Buy-side Liquidity Sweep';
      poiDetail = `Buy-side liquidity swept at ${fmt(sweptBuySide.price)} — LTF entry trigger for short`;
    }
  }

  // Check for MSS on this timeframe
  const mss = htfBias && htfBias !== 'ranging' ? findMSS(smc, candles.length, 15, htfBias) : null;
  const hasMSS = mss !== null;

  // Check for inducement (first pullback after MSS)
  let hasInducement = false;
  if (mss) {
    const inducement = findInducement(smc, mss.index, candles.length, mss.direction);
    hasInducement = inducement !== null;
  }

  // Check for valid entry OB near the inducement liquidity
  let atEntryOB = false;
  if (hasMSS && htfBias && htfBias !== 'ranging') {
    const entryOB = findNearbyOB(price, smc.orderBlocks, htfBias);
    atEntryOB = entryOB !== null;
  }

  return {
    timeframe,
    label: TF_LABELS[timeframe],
    smc,
    bias,
    atPOI,
    poiType,
    poiDetail,
    hasMSS,
    hasInducement,
    atEntryOB,
  };
}

export function analyzePair(pair: PairData, strategy: StrategyConfig): TradingSignal {
  const pipSize = getPipSize(pair.symbol);
  const price = pair.price;
  const fmt = (p: number) => formatPrice(p, symbol);

  // Get candles for all 4 timeframes
  const htfCandles = pair.timeframes[strategy.htfTimeframe];   // Daily
  const mtfCandles = pair.timeframes[strategy.mtfTimeframe];   // 4H
  const ltfCandles = pair.timeframes[strategy.ltfTimeframe];   // 1H
  const entryCandles = pair.timeframes[strategy.entryTimeframe]; // 15M

  // If we don't have multi-timeframe data, fall back to single-timeframe analysis
  if (!htfCandles?.length || !mtfCandles?.length || !ltfCandles?.length || !entryCandles?.length) {
    return analyzeSingleTimeframe(pair, strategy);
  }

  const symbol = pair.symbol;

  // Step 1: HTF (Daily) — Determine directional bias from OB + structure
  const htfAnalysis = analyzeTimeframe(symbol, strategy.htfTimeframe, htfCandles, strategy, null);
  const htfBias = htfAnalysis.bias;

  // Step 2: MTF (4H) — Check if price is at a POI aligned with HTF bias
  const mtfAnalysis = analyzeTimeframe(symbol, strategy.mtfTimeframe, mtfCandles, strategy, htfBias);

  // Step 3: LTF (1H) — Look for MSS / Market Structure Shift
  const ltfAnalysis = analyzeTimeframe(symbol, strategy.ltfTimeframe, ltfCandles, strategy, htfBias);
  const ltfMSS = htfBias !== 'ranging' ? findMSS(ltfAnalysis.smc, ltfCandles.length, 15, htfBias) : null;

  // Step 4: Entry TF (15M) — Look for inducement + valid OB near liquidity
  const entryAnalysis = analyzeTimeframe(symbol, strategy.entryTimeframe, entryCandles, strategy, htfBias);

  // Find inducement on the entry timeframe (first pullback after the LTF MSS)
  let entryInducement: { price: number; index: number } | null = null;
  let entryOB: OrderBlock | null = null;
  let sweptLiquidity: LiquidityLevel | null = null;

  if (ltfMSS) {
    // Look for inducement on the entry timeframe
    entryInducement = findInducement(entryAnalysis.smc, 0, entryCandles.length, ltfMSS.direction);

    // Check for liquidity sweep near the inducement
    if (ltfMSS.direction === 'bullish') {
      sweptLiquidity = findRecentSweep(entryAnalysis.smc.liquidity, entryCandles.length, 10, 'sell-side');
    } else {
      sweptLiquidity = findRecentSweep(entryAnalysis.smc.liquidity, entryCandles.length, 10, 'buy-side');
    }

    // Find valid OB near the swept liquidity
    if (sweptLiquidity) {
      entryOB = findNearbyOB(price, entryAnalysis.smc.orderBlocks, ltfMSS.direction);
    }
  }

  const readings: SMCReading[] = [];
  let bullScore = 0;
  let bearScore = 0;
  let totalWeight = 0;

  // === Reading 1: HTF (Daily) Bias ===
  const htfWeight = 3;
  if (htfBias === 'bullish') {
    bullScore += htfWeight;
    readings.push({
      name: `${TF_LABELS[strategy.htfTimeframe]} Bias (HTF)`,
      value: htfAnalysis.smc.structure.lastCHoCH ? 'Bullish CHoCH' : htfAnalysis.smc.structure.lastBOS ? 'Bullish BOS' : 'Bullish',
      signal: 'BUY',
      detail: htfAnalysis.smc.structure.lastCHoCH
        ? `Daily timeframe shows a Change of Character to bullish — the prior downtrend is likely reversing. This is your directional bias.`
        : `Daily timeframe shows a bullish Break of Structure — continuation of the uptrend. This is your directional bias.`,
      timeframe: strategy.htfTimeframe,
    });
  } else if (htfBias === 'bearish') {
    bearScore += htfWeight;
    readings.push({
      name: `${TF_LABELS[strategy.htfTimeframe]} Bias (HTF)`,
      value: htfAnalysis.smc.structure.lastCHoCH ? 'Bearish CHoCH' : htfAnalysis.smc.structure.lastBOS ? 'Bearish BOS' : 'Bearish',
      signal: 'SELL',
      detail: htfAnalysis.smc.structure.lastCHoCH
        ? `Daily timeframe shows a Change of Character to bearish — the prior uptrend is likely reversing. This is your directional bias.`
        : `Daily timeframe shows a bearish Break of Structure — continuation of the downtrend. This is your directional bias.`,
      timeframe: strategy.htfTimeframe,
    });
  } else {
    readings.push({
      name: `${TF_LABELS[strategy.htfTimeframe]} Bias (HTF)`,
      value: 'Ranging',
      signal: 'NEUTRAL',
      detail: `Daily timeframe has no clear BOS or CHoCH. No directional bias — wait for HTF structure to establish before looking for entries.`,
      timeframe: strategy.htfTimeframe,
    });
  }
  totalWeight += htfWeight;

  // === Reading 2: HTF Premium/Discount ===
  const htfZone = htfAnalysis.smc.premiumDiscount.currentZone;
  const htfPdWeight = 2;
  if (htfBias === 'bullish' && htfZone === 'discount') {
    bullScore += htfPdWeight;
    readings.push({
      name: `${TF_LABELS[strategy.htfTimeframe]} Premium/Discount`,
      value: 'Discount (HTF)',
      signal: 'BUY',
      detail: `Price is in the Daily discount zone (below equilibrium at ${formatPrice(htfAnalysis.smc.premiumDiscount.equilibrium, symbol)}). This is where smart money accumulates longs in a bullish trend.`,
      timeframe: strategy.htfTimeframe,
    });
  } else if (htfBias === 'bearish' && htfZone === 'premium') {
    bearScore += htfPdWeight;
    readings.push({
      name: `${TF_LABELS[strategy.htfTimeframe]} Premium/Discount`,
      value: 'Premium (HTF)',
      signal: 'SELL',
      detail: `Price is in the Daily premium zone (above equilibrium at ${formatPrice(htfAnalysis.smc.premiumDiscount.equilibrium, symbol)}). This is where smart money distributes shorts in a bearish trend.`,
      timeframe: strategy.htfTimeframe,
    });
  } else {
    readings.push({
      name: `${TF_LABELS[strategy.htfTimeframe]} Premium/Discount`,
      value: htfZone === 'equilibrium' ? 'Equilibrium' : htfZone === 'premium' ? 'Premium' : 'Discount',
      signal: 'NEUTRAL',
      detail: `Price is in the ${htfZone} zone on Daily. ${htfBias === 'bullish' ? 'Waiting for price to return to discount for longs.' : htfBias === 'bearish' ? 'Waiting for price to return to premium for shorts.' : 'No clear bias yet.'}`,
      timeframe: strategy.htfTimeframe,
    });
  }
  totalWeight += htfPdWeight;

  // === Reading 3: MTF (4H) POI ===
  const mtfPoiWeight = 3;
  if (mtfAnalysis.atPOI) {
    const poiIsBullish = mtfAnalysis.poiType?.toLowerCase().includes('bull') || mtfAnalysis.poiType?.toLowerCase().includes('sell-side');
    const poiIsBearish = mtfAnalysis.poiType?.toLowerCase().includes('bear') || mtfAnalysis.poiType?.toLowerCase().includes('buy-side');

    if (htfBias === 'bullish' && poiIsBullish) {
      bullScore += mtfPoiWeight;
      readings.push({
        name: `${TF_LABELS[strategy.mtfTimeframe]} Point of Interest (MTF)`,
        value: mtfAnalysis.poiType ?? 'POI',
        signal: 'BUY',
        detail: `${mtfAnalysis.poiDetail ?? ''}. This POI aligns with the ${TF_LABELS[strategy.htfTimeframe]} bullish bias — this is your SLPOI. Now drop to ${TF_LABELS[strategy.ltfTimeframe]} to look for an MSS.`,
        timeframe: strategy.mtfTimeframe,
      });
    } else if (htfBias === 'bearish' && poiIsBearish) {
      bearScore += mtfPoiWeight;
      readings.push({
        name: `${TF_LABELS[strategy.mtfTimeframe]} Point of Interest (MTF)`,
        value: mtfAnalysis.poiType ?? 'POI',
        signal: 'SELL',
        detail: `${mtfAnalysis.poiDetail ?? ''}. This POI aligns with the ${TF_LABELS[strategy.htfTimeframe]} bearish bias — this is your SLPOI. Now drop to ${TF_LABELS[strategy.ltfTimeframe]} to look for an MSS.`,
        timeframe: strategy.mtfTimeframe,
      });
    } else {
      readings.push({
        name: `${TF_LABELS[strategy.mtfTimeframe]} Point of Interest (MTF)`,
        value: mtfAnalysis.poiType ?? 'POI',
        signal: 'NEUTRAL',
        detail: `${mtfAnalysis.poiDetail ?? ''}. However, this POI does NOT align with the ${TF_LABELS[strategy.htfTimeframe]} ${htfBias} bias. Skip this setup.`,
        timeframe: strategy.mtfTimeframe,
      });
    }
  } else {
    readings.push({
      name: `${TF_LABELS[strategy.mtfTimeframe]} Point of Interest (MTF)`,
      value: 'No POI',
      signal: 'NEUTRAL',
      detail: `Price is not at any order block or FVG on the ${TF_LABELS[strategy.mtfTimeframe]}. Wait for price to reach a POI that aligns with the HTF bias before looking for an MSS.`,
      timeframe: strategy.mtfTimeframe,
    });
  }
  totalWeight += mtfPoiWeight;

  // === Reading 4: LTF (1H) MSS / Market Structure Shift ===
  const ltfWeight = 2.5;
  let ltfTrigger = false;

  if (htfBias !== 'ranging' && mtfAnalysis.atPOI && ltfMSS) {
    ltfTrigger = true;
    if (ltfMSS.direction === 'bullish') {
      bullScore += ltfWeight;
      readings.push({
        name: `${TF_LABELS[strategy.ltfTimeframe]} MSS (LTF)`,
        value: 'Bullish MSS',
        signal: 'BUY',
        detail: `${TF_LABELS[strategy.ltfTimeframe]} shows a Market Structure Shift to bullish — price broke above a lower high, confirming the shift in momentum. Now drop to ${TF_LABELS[strategy.entryTimeframe]} to look for inducement and a valid OB entry.`,
        timeframe: strategy.ltfTimeframe,
      });
    } else {
      bearScore += ltfWeight;
      readings.push({
        name: `${TF_LABELS[strategy.ltfTimeframe]} MSS (LTF)`,
        value: 'Bearish MSS',
        signal: 'SELL',
        detail: `${TF_LABELS[strategy.ltfTimeframe]} shows a Market Structure Shift to bearish — price broke below a higher low, confirming the shift in momentum. Now drop to ${TF_LABELS[strategy.entryTimeframe]} to look for inducement and a valid OB entry.`,
        timeframe: strategy.ltfTimeframe,
      });
    }
  } else if (htfBias !== 'ranging' && mtfAnalysis.atPOI) {
    readings.push({
      name: `${TF_LABELS[strategy.ltfTimeframe]} MSS (LTF)`,
      value: 'Waiting for MSS',
      signal: 'NEUTRAL',
      detail: `No MSS on the ${TF_LABELS[strategy.ltfTimeframe]} yet. Watch for a CHoCH or BOS in the ${htfBias} direction to confirm the shift before looking for an entry.`,
      timeframe: strategy.ltfTimeframe,
    });
  } else {
    readings.push({
      name: `${TF_LABELS[strategy.ltfTimeframe]} MSS (LTF)`,
      value: 'Not ready',
      signal: 'NEUTRAL',
      detail: `LTF MSS requires: (1) HTF bias established, and (2) price at MTF POI. Both conditions must be met first.`,
      timeframe: strategy.ltfTimeframe,
    });
  }
  totalWeight += ltfWeight;

  // === Reading 5: Entry TF (15M) Inducement + Valid OB ===
  const entryWeight = 3;
  let entryTrigger = false;

  if (ltfTrigger && ltfMSS && entryInducement) {
    // We have inducement (first pullback after MSS)
    if (sweptLiquidity) {
      // Liquidity was swept — this is the inducement being taken
      if (entryOB) {
        // Valid OB near the swept liquidity — this is the entry!
        entryTrigger = true;
        if (ltfMSS.direction === 'bullish') {
          bullScore += entryWeight;
          readings.push({
            name: `${TF_LABELS[strategy.entryTimeframe]} Entry (Inducement + OB)`,
            value: 'Valid Entry',
            signal: 'BUY',
            detail: `After the ${TF_LABELS[strategy.ltfTimeframe]} bullish MSS, the first pullback (inducement) at ${formatPrice(entryInducement.price, symbol)} swept sell-side liquidity at ${formatPrice(sweptLiquidity.price, symbol)}. Price has now returned to a valid bullish OB at ${formatPrice(entryOB.bottom, symbol)} - ${formatPrice(entryOB.top, symbol)}. This is your entry point.`,
            timeframe: strategy.entryTimeframe,
          });
        } else {
          bearScore += entryWeight;
          readings.push({
            name: `${TF_LABELS[strategy.entryTimeframe]} Entry (Inducement + OB)`,
            value: 'Valid Entry',
            signal: 'SELL',
            detail: `After the ${TF_LABELS[strategy.ltfTimeframe]} bearish MSS, the first pullback (inducement) at ${formatPrice(entryInducement.price, symbol)} swept buy-side liquidity at ${formatPrice(sweptLiquidity.price, symbol)}. Price has now returned to a valid bearish OB at ${formatPrice(entryOB.bottom, symbol)} - ${formatPrice(entryOB.top, symbol)}. This is your entry point.`,
            timeframe: strategy.entryTimeframe,
          });
        }
      } else {
        readings.push({
          name: `${TF_LABELS[strategy.entryTimeframe]} Entry (Inducement + OB)`,
          value: 'Liquidity swept, no OB',
          signal: ltfMSS.direction === 'bullish' ? 'BUY' : 'SELL',
          detail: `Inducement at ${formatPrice(entryInducement.price, symbol)} swept ${sweptLiquidity.type} liquidity at ${formatPrice(sweptLiquidity.price, symbol)}. However, no valid ${ltfMSS.direction} OB found near price. Wait for price to reach an OB for the entry.`,
          timeframe: strategy.entryTimeframe,
        });
        if (ltfMSS.direction === 'bullish') bullScore += entryWeight * 0.5;
        else bearScore += entryWeight * 0.5;
      }
    } else {
      readings.push({
        name: `${TF_LABELS[strategy.entryTimeframe]} Entry (Inducement + OB)`,
        value: 'Inducement forming',
        signal: 'NEUTRAL',
        detail: `First pullback (inducement) detected at ${formatPrice(entryInducement.price, symbol)} after the MSS. Waiting for this inducement to sweep liquidity and for price to return to a valid OB for entry.`,
        timeframe: strategy.entryTimeframe,
      });
    }
  } else if (ltfTrigger && ltfMSS) {
    readings.push({
      name: `${TF_LABELS[strategy.entryTimeframe]} Entry (Inducement + OB)`,
      value: 'Waiting for inducement',
      signal: 'NEUTRAL',
      detail: `MSS confirmed on ${TF_LABELS[strategy.ltfTimeframe]}. Now watching ${TF_LABELS[strategy.entryTimeframe]} for the first pullback (inducement) after the MSS, followed by a liquidity sweep and return to a valid OB.`,
      timeframe: strategy.entryTimeframe,
    });
  } else {
    readings.push({
      name: `${TF_LABELS[strategy.entryTimeframe]} Entry (Inducement + OB)`,
      value: 'Not ready',
      signal: 'NEUTRAL',
      detail: `Entry requires: (1) HTF bias, (2) MTF POI, (3) LTF MSS, (4) inducement + liquidity sweep + valid OB on ${TF_LABELS[strategy.entryTimeframe]}.`,
      timeframe: strategy.entryTimeframe,
    });
  }
  totalWeight += entryWeight;

  // Determine direction and confidence
  let direction: SignalDirection = 'NEUTRAL';
  let confidence = 0;

  if (bullScore > bearScore && bullScore > 0) {
    direction = 'BUY';
    confidence = Math.round((bullScore / totalWeight) * 100);
  } else if (bearScore > bullScore && bearScore > 0) {
    direction = 'SELL';
    confidence = Math.round((bearScore / totalWeight) * 100);
  }

  // Boost confidence when all 4 tiers align
  if (direction === 'BUY' && htfBias === 'bullish' && mtfAnalysis.atPOI && ltfTrigger && entryTrigger) {
    confidence = Math.min(95, confidence + 15);
  } else if (direction === 'SELL' && htfBias === 'bearish' && mtfAnalysis.atPOI && ltfTrigger && entryTrigger) {
    confidence = Math.min(95, confidence + 15);
  }

  // Reduce confidence if MTF POI doesn't align
  if (direction !== 'NEUTRAL' && !mtfAnalysis.atPOI) {
    confidence = Math.round(confidence * 0.4);
  }

  let strength: SignalStrength = 'WEAK';
  if (confidence >= 75) strength = 'STRONG';
  else if (confidence >= 60) strength = 'MODERATE';

  // Calculate entry, SL, TP using entry TF structure
  const entryAtr = atr(entryCandles, 14);
  const entryAtrVal = entryAtr[entryAtr.length - 1] || pipSize * 20;

  let entry = price;
  let stopLoss = price;
  let takeProfit = price;

  if (direction === 'BUY') {
    entry = entryOB ? entryOB.bottom : price;
    stopLoss = entry - entryAtrVal * strategy.atrMultiplierSL;
    takeProfit = entry + Math.abs(entry - stopLoss) * strategy.riskRewardMin;
  } else if (direction === 'SELL') {
    entry = entryOB ? entryOB.top : price;
    stopLoss = entry + entryAtrVal * strategy.atrMultiplierSL;
    takeProfit = entry - Math.abs(entry - stopLoss) * strategy.riskRewardMin;
  }

  const pipsRisk = direction !== 'NEUTRAL' ? pipsBetween(pair.symbol, entry, stopLoss) : 0;
  const pipsReward = direction !== 'NEUTRAL' ? pipsBetween(pair.symbol, entry, takeProfit) : 0;
  const riskRewardRatio = pipsRisk > 0 ? pipsReward / pipsRisk : 0;

  // Collect all 4 timeframe analyses in order
  const allTFAnalysis: TimeframeAnalysis[] = [
    htfAnalysis,
    mtfAnalysis,
    ltfAnalysis,
    entryAnalysis,
  ];

  return {
    pair: pair.symbol,
    direction,
    strength,
    confidence,
    price,
    entry,
    stopLoss,
    takeProfit,
    riskRewardRatio,
    pipsRisk,
    pipsReward,
    readings,
    timestamp: Date.now(),
    strategy: `SMC 4-TF: ${TF_LABELS[strategy.htfTimeframe]}→${TF_LABELS[strategy.mtfTimeframe]}→${TF_LABELS[strategy.ltfTimeframe]}→${TF_LABELS[strategy.entryTimeframe]}`,
    smc: mtfAnalysis.smc,
    timeframeAnalysis: allTFAnalysis,
    htfBias,
    mtfAtPOI: mtfAnalysis.atPOI,
    ltfTrigger: ltfTrigger && entryTrigger,
  };
}

// Fallback: single-timeframe analysis (when multi-TF data not available)
function analyzeSingleTimeframe(pair: PairData, strategy: StrategyConfig): TradingSignal {
  const { candles } = pair;
  const pipSize = getPipSize(pair.symbol);
  const price = candles[candles.length - 1].close;
  const smc = analyzeSMC(candles, strategy);

  const readings: SMCReading[] = [];
  let bullScore = 0;
  let bearScore = 0;
  let totalWeight = 0;

  // Structure
  const structWeight = 3;
  if (smc.structure.lastCHoCH) {
    if (smc.structure.lastCHoCH.direction === 'bullish') {
      bullScore += structWeight;
      readings.push({ name: 'Market Structure', value: 'Bullish CHoCH', signal: 'BUY', detail: 'Change of character to bullish — prior downtrend likely reversing.' });
    } else {
      bearScore += structWeight;
      readings.push({ name: 'Market Structure', value: 'Bearish CHoCH', signal: 'SELL', detail: 'Change of character to bearish — prior uptrend likely reversing.' });
    }
  } else if (smc.structure.lastBOS) {
    if (smc.structure.lastBOS.direction === 'bullish') {
      bullScore += structWeight;
      readings.push({ name: 'Market Structure', value: 'Bullish BOS', signal: 'BUY', detail: 'Break of structure confirms bullish continuation.' });
    } else {
      bearScore += structWeight;
      readings.push({ name: 'Market Structure', value: 'Bearish BOS', signal: 'SELL', detail: 'Break of structure confirms bearish continuation.' });
    }
  } else {
    readings.push({ name: 'Market Structure', value: 'Ranging', signal: 'NEUTRAL', detail: 'No clear BOS or CHoCH detected.' });
  }
  totalWeight += structWeight;

  // Premium/Discount
  const pdWeight = 2;
  const zone = smc.premiumDiscount.currentZone;
  if (zone === 'discount') {
    bullScore += smc.structure.trend === 'bullish' ? pdWeight : pdWeight * 0.5;
    readings.push({ name: 'Premium/Discount', value: 'Discount Zone', signal: 'BUY', detail: `Price is in the discount zone. Favourable for longs.` });
  } else if (zone === 'premium') {
    bearScore += smc.structure.trend === 'bearish' ? pdWeight : pdWeight * 0.5;
    readings.push({ name: 'Premium/Discount', value: 'Premium Zone', signal: 'SELL', detail: `Price is in the premium zone. Favourable for shorts.` });
  } else {
    readings.push({ name: 'Premium/Discount', value: 'Equilibrium', signal: 'NEUTRAL', detail: 'Price is at equilibrium.' });
  }
  totalWeight += pdWeight;

  // Order Block
  const obWeight = 2.5;
  const unmitigatedOBs = smc.orderBlocks.filter(ob => !ob.mitigated);
  const nearbyBullOB = unmitigatedOBs.find(ob => ob.direction === 'bullish' && isPriceAtOB(price, ob));
  const nearbyBearOB = unmitigatedOBs.find(ob => ob.direction === 'bearish' && isPriceAtOB(price, ob));
  if (nearbyBullOB) {
    bullScore += obWeight;
    readings.push({ name: 'Order Block', value: 'Bullish OB nearby', signal: 'BUY', detail: `Unmitigated bullish OB at ${formatPrice(nearbyBullOB.bottom, pair.symbol)} - ${formatPrice(nearbyBullOB.top, pair.symbol)}.` });
  } else if (nearbyBearOB) {
    bearScore += obWeight;
    readings.push({ name: 'Order Block', value: 'Bearish OB nearby', signal: 'SELL', detail: `Unmitigated bearish OB at ${formatPrice(nearbyBearOB.bottom, pair.symbol)} - ${formatPrice(nearbyBearOB.top, pair.symbol)}.` });
  } else {
    readings.push({ name: 'Order Block', value: 'No nearby OB', signal: 'NEUTRAL', detail: 'Price is not near any unmitigated order block.' });
  }
  totalWeight += obWeight;

  // Liquidity
  const liqWeight = 2;
  const sweptSellSide = smc.liquidity.find(l => l.type === 'sell-side' && l.swept);
  const sweptBuySide = smc.liquidity.find(l => l.type === 'buy-side' && l.swept);
  if (sweptSellSide) {
    bullScore += liqWeight;
    readings.push({ name: 'Liquidity Sweep', value: 'Sell-side swept', signal: 'BUY', detail: `Sell-side liquidity swept at ${formatPrice(sweptSellSide.price, pair.symbol)}. Potential bullish reversal.` });
  } else if (sweptBuySide) {
    bearScore += liqWeight;
    readings.push({ name: 'Liquidity Sweep', value: 'Buy-side swept', signal: 'SELL', detail: `Buy-side liquidity swept at ${formatPrice(sweptBuySide.price, pair.symbol)}. Potential bearish reversal.` });
  } else {
    readings.push({ name: 'Liquidity', value: 'No sweeps', signal: 'NEUTRAL', detail: 'No recent liquidity sweeps detected.' });
  }
  totalWeight += liqWeight;

  // Direction
  let direction: SignalDirection = 'NEUTRAL';
  let confidence = 0;
  if (bullScore > bearScore && bullScore > 0) {
    direction = 'BUY';
    confidence = Math.round((bullScore / totalWeight) * 100);
  } else if (bearScore > bullScore && bearScore > 0) {
    direction = 'SELL';
    confidence = Math.round((bearScore / totalWeight) * 100);
  }

  let strength: SignalStrength = 'WEAK';
  if (confidence >= 75) strength = 'STRONG';
  else if (confidence >= 60) strength = 'MODERATE';

  const atrArr = atr(candles, 14);
  const atrVal = atrArr[atrArr.length - 1] || pipSize * 20;
  let entry = price, stopLoss = price, takeProfit = price;
  if (direction === 'BUY') {
    entry = nearbyBullOB ? nearbyBullOB.bottom : price;
    stopLoss = entry - atrVal * strategy.atrMultiplierSL;
    takeProfit = entry + Math.abs(entry - stopLoss) * strategy.riskRewardMin;
  } else if (direction === 'SELL') {
    entry = nearbyBearOB ? nearbyBearOB.top : price;
    stopLoss = entry + atrVal * strategy.atrMultiplierSL;
    takeProfit = entry - Math.abs(entry - stopLoss) * strategy.riskRewardMin;
  }

  const pipsRisk = direction !== 'NEUTRAL' ? pipsBetween(pair.symbol, entry, stopLoss) : 0;
  const pipsReward = direction !== 'NEUTRAL' ? pipsBetween(pair.symbol, entry, takeProfit) : 0;

  return {
    pair: pair.symbol,
    direction,
    strength,
    confidence,
    price,
    entry,
    stopLoss,
    takeProfit,
    riskRewardRatio: pipsRisk > 0 ? pipsReward / pipsRisk : 0,
    pipsRisk,
    pipsReward,
    readings,
    timestamp: Date.now(),
    strategy: 'SMC: Single Timeframe',
    smc,
    timeframeAnalysis: [],
    htfBias: 'ranging',
    mtfAtPOI: false,
    ltfTrigger: false,
  };
}

export function scanAllPairs(pairs: PairData[], strategy: StrategyConfig): TradingSignal[] {
  return pairs.map((p) => analyzePair(p, strategy));
}

export function filterStrongSignals(signals: TradingSignal[], minConfidence: number): TradingSignal[] {
  return signals
    .filter((s) => s.direction !== 'NEUTRAL' && s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

export { analyzeSMC } from './smc';
export { detectSwingPoints } from './smc';
