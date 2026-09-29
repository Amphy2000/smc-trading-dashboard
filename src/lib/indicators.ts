import type { Candle } from './types';

export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let emaPrev = values[0];

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      emaPrev = values[0];
    } else {
      emaPrev = values[i] * k + emaPrev * (1 - k);
    }
    result.push(emaPrev);
  }
  return result;
}

export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j];
    }
    result.push(sum / period);
  }
  return result;
}

export function rsi(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(50);
      continue;
    }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      } else {
        result.push(50);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

export function atr(candles: Candle[], period: number = 14): number[] {
  const result: number[] = [];
  const trs: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
    } else {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      trs.push(tr);
    }
  }

  let prevAtr = 0;
  for (let i = 0; i < trs.length; i++) {
    if (i < period) {
      prevAtr += trs[i];
      if (i === period - 1) {
        prevAtr /= period;
        result.push(prevAtr);
      } else {
        result.push(NaN);
      }
    } else {
      prevAtr = (prevAtr * (period - 1) + trs[i]) / period;
      result.push(prevAtr);
    }
  }
  return result;
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(closes: number[], fast: number = 12, slow: number = 26, signalPeriod: number = 9): MACDResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);

  return { macd: macdLine, signal: signalLine, histogram };
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollingerBands(closes: number[], period: number = 20, stdDev: number = 2): BollingerResult {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += Math.pow(closes[j] - middle[i], 2);
    }
    const sd = Math.sqrt(sum / period);
    upper.push(middle[i] + stdDev * sd);
    lower.push(middle[i] - stdDev * sd);
  }

  return { upper, middle, lower };
}

export function stochastic(candles: Candle[], period: number = 14, smoothK: number = 3, smoothD: number = 3): { k: number[]; d: number[] } {
  const k: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      k.push(NaN);
      continue;
    }
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > highestHigh) highestHigh = candles[j].high;
      if (candles[j].low < lowestLow) lowestLow = candles[j].low;
    }
    const range = highestHigh - lowestLow;
    k.push(range === 0 ? 50 : ((candles[i].close - lowestLow) / range) * 100);
  }

  const kSmoothed = sma(k.filter((v) => !isNaN(v)), smoothK);
  const dLine = sma(kSmoothed, smoothD);

  const padCount = candles.length - kSmoothed.length;
  const kResult = [...Array(padCount).fill(NaN), ...kSmoothed];
  const dResult = [...Array(candles.length - dLine.length).fill(NaN), ...dLine];

  return { k: kResult, d: dResult };
}

export function adx(candles: Candle[], period: number = 14): number[] {
  const result: number[] = [];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const trs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }

  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      result.push(NaN);
      continue;
    }
    let sumTR = 0;
    let sumPlusDM = 0;
    let sumMinusDM = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumTR += trs[j] || 0;
      sumPlusDM += plusDM[j] || 0;
      sumMinusDM += minusDM[j] || 0;
    }
    const plusDI = sumTR === 0 ? 0 : (sumPlusDM / sumTR) * 100;
    const minusDI = sumTR === 0 ? 0 : (sumMinusDM / sumTR) * 100;
    const dx = plusDI + minusDI === 0 ? 0 : (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    result.push(dx);
  }

  return result;
}
