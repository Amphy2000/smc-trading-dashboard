import type { Candle, PairData, TimeframeKey } from './types';

export type PairCategory = 'forex' | 'metals' | 'crypto' | 'indices' | 'energy';

export interface PairDef {
  symbol: string;
  label: string;
  pipSize: number;
  category: PairCategory;
  pipValuePerLot: number;
}

export const FOREX_PAIRS: PairDef[] = [
  // Forex majors
  { symbol: 'EUR/USD', label: 'Euro / US Dollar', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  { symbol: 'GBP/USD', label: 'Pound / US Dollar', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  { symbol: 'USD/JPY', label: 'US Dollar / Yen', pipSize: 0.01, category: 'forex', pipValuePerLot: 9.13 },
  { symbol: 'USD/CHF', label: 'US Dollar / Franc', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  { symbol: 'AUD/USD', label: 'Aussie / US Dollar', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  { symbol: 'USD/CAD', label: 'US Dollar / Loonie', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  { symbol: 'NZD/USD', label: 'Kiwi / US Dollar', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  // Forex crosses
  { symbol: 'EUR/GBP', label: 'Euro / Pound', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  { symbol: 'EUR/JPY', label: 'Euro / Yen', pipSize: 0.01, category: 'forex', pipValuePerLot: 9.13 },
  { symbol: 'GBP/JPY', label: 'Pound / Yen', pipSize: 0.01, category: 'forex', pipValuePerLot: 9.13 },
  { symbol: 'AUD/JPY', label: 'Aussie / Yen', pipSize: 0.01, category: 'forex', pipValuePerLot: 9.13 },
  { symbol: 'EUR/AUD', label: 'Euro / Aussie', pipSize: 0.0001, category: 'forex', pipValuePerLot: 10 },
  // Metals
  { symbol: 'XAU/USD', label: 'Gold / US Dollar', pipSize: 0.1, category: 'metals', pipValuePerLot: 10 },
  { symbol: 'XAG/USD', label: 'Silver / US Dollar', pipSize: 0.001, category: 'metals', pipValuePerLot: 50 },
  // Crypto
  { symbol: 'BTC/USD', label: 'Bitcoin / US Dollar', pipSize: 1, category: 'crypto', pipValuePerLot: 1 },
  { symbol: 'ETH/USD', label: 'Ethereum / US Dollar', pipSize: 0.1, category: 'crypto', pipValuePerLot: 1 },
  // Indices
  { symbol: 'US30', label: 'Dow Jones 30', pipSize: 1, category: 'indices', pipValuePerLot: 1 },
  { symbol: 'US100', label: 'Nasdaq 100', pipSize: 0.25, category: 'indices', pipValuePerLot: 1 },
  { symbol: 'US500', label: 'S&P 500', pipSize: 0.05, category: 'indices', pipValuePerLot: 50 },
  { symbol: 'GER40', label: 'DAX 40', pipSize: 0.1, category: 'indices', pipValuePerLot: 25 },
  { symbol: 'UK100', label: 'FTSE 100', pipSize: 0.1, category: 'indices', pipValuePerLot: 10 },
  { symbol: 'JP225', label: 'Nikkei 225', pipSize: 1, category: 'indices', pipValuePerLot: 0.67 },
  // Energy
  { symbol: 'USOIL', label: 'WTI Crude Oil', pipSize: 0.01, category: 'energy', pipValuePerLot: 10 },
  { symbol: 'UKOIL', label: 'Brent Crude Oil', pipSize: 0.01, category: 'energy', pipValuePerLot: 10 },
];

export const PAIR_CATEGORIES: { key: PairCategory; label: string }[] = [
  { key: 'forex', label: 'Forex' },
  { key: 'metals', label: 'Metals' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'indices', label: 'Indices' },
  { key: 'energy', label: 'Energy' },
];

export function getPairDef(symbol: string): PairDef | undefined {
  return FOREX_PAIRS.find((p) => p.symbol === symbol);
}

export function getPipSize(symbol: string): number {
  const pair = getPairDef(symbol);
  return pair ? pair.pipSize : 0.0001;
}

export function getPipValuePerLot(symbol: string): number {
  const pair = getPairDef(symbol);
  return pair ? pair.pipValuePerLot : 10;
}

export function getPairCategory(symbol: string): PairCategory {
  const pair = getPairDef(symbol);
  return pair ? pair.category : 'forex';
}

export function pipsBetween(symbol: string, priceA: number, priceB: number): number {
  return Math.abs(priceA - priceB) / getPipSize(symbol);
}

const SUPABASE_URL = 'https://crvmktuwdamkavssrysv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm1rdHV3ZGFta2F2c3NyeXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NDU0MTUsImV4cCI6MjEwNjAyMTQxNX0.yAWaQENxqy_rFIDzqQ3IoRiGcos_vVikxAY0qSqtd68';

interface MultiTFResponse {
  pairs: {
    symbol: string;
    timeframes: Record<TimeframeKey, Candle[] | null>;
    currentPrice: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
  }[];
  failed: string[];
  timestamp: number;
}

export async function fetchLivePairs(_interval: string = '1h', _range: string = '5d'): Promise<{ pairs: PairData[]; failed: string[] }> {
  const apiUrl = `${SUPABASE_URL}/functions/v1/forex-data?multi=true`;
  const headers = {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    throw new Error(`Live data fetch failed (${response.status})`);
  }

  const data: MultiTFResponse = await response.json();

  if (!data.pairs || data.pairs.length === 0) {
    throw new Error('No live data returned');
  }

  const pairs: PairData[] = data.pairs.map((p) => {
    const pipSize = getPipSize(p.symbol);
    const primaryCandles = p.timeframes['1h'] || p.timeframes['4h'] || p.timeframes['15m'] || p.timeframes['1D'] || [];
    return {
      symbol: p.symbol,
      price: p.currentPrice,
      change: p.change,
      changePercent: p.changePercent,
      high: p.dayHigh,
      low: p.dayLow,
      candles: primaryCandles,
      spread: pipSize * 2,
      isLive: true,
      timeframes: {
        '1D': p.timeframes['1D'] || [],
        '4h': p.timeframes['4h'] || [],
        '1h': p.timeframes['1h'] || [],
        '15m': p.timeframes['15m'] || [],
      },
    };
  });

  return { pairs, failed: data.failed || [] };
}

// --- Fallback simulation ---

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const BASE_PRICES: Record<string, number> = {
  'EUR/USD': 1.0850, 'GBP/USD': 1.2650, 'USD/JPY': 151.50, 'USD/CHF': 0.9020,
  'AUD/USD': 0.6580, 'USD/CAD': 1.3620, 'NZD/USD': 0.6050, 'EUR/GBP': 0.8570,
  'EUR/JPY': 164.30, 'GBP/JPY': 191.50, 'AUD/JPY': 99.60, 'EUR/AUD': 1.6490,
  'XAU/USD': 2350.0, 'XAG/USD': 28.50,
  'BTC/USD': 67000.0, 'ETH/USD': 3400.0,
  'US30': 39000.0, 'US100': 18500.0, 'US500': 5300.0, 'GER40': 18200.0,
  'UK100': 8200.0, 'JP225': 39000.0,
  'USOIL': 78.50, 'UKOIL': 82.30,
};

const VOLATILITY: Record<string, number> = {
  'EUR/USD': 0.0008, 'GBP/USD': 0.0012, 'USD/JPY': 0.15, 'USD/CHF': 0.0010,
  'AUD/USD': 0.0009, 'USD/CAD': 0.0010, 'NZD/USD': 0.0009, 'EUR/GBP': 0.0007,
  'EUR/JPY': 0.18, 'GBP/JPY': 0.25, 'AUD/JPY': 0.12, 'EUR/AUD': 0.0015,
  'XAU/USD': 2.5, 'XAG/USD': 0.08,
  'BTC/USD': 800.0, 'ETH/USD': 40.0,
  'US30': 80.0, 'US100': 50.0, 'US500': 15.0, 'GER40': 60.0,
  'UK100': 30.0, 'JP225': 120.0,
  'USOIL': 0.30, 'UKOIL': 0.28,
};

function generateCandles(symbol: string, count: number, intervalMinutes: number): Candle[] {
  const rng = mulberry32(hashString(symbol) + Math.floor(Date.now() / (intervalMinutes * 60 * 1000)));
  const base = BASE_PRICES[symbol] || 1.0;
  const vol = VOLATILITY[symbol] || 0.001;
  const candles: Candle[] = [];
  let prevClose = base + (rng() - 0.5) * vol * 20;
  const now = Date.now();
  const intervalMs = intervalMinutes * 60 * 1000;

  let trend = 0;
  let trendDuration = 0;

  for (let i = count - 1; i >= 0; i--) {
    if (trendDuration <= 0) {
      trend = (rng() - 0.5) * vol * 0.3;
      trendDuration = Math.floor(rng() * 30) + 10;
    }
    trendDuration--;

    const noise = (rng() - 0.5) * vol * 2;
    const open = prevClose;
    const close = open + trend + noise;
    const highOffset = Math.abs(rng() - 0.5) * vol * 1.5;
    const lowOffset = Math.abs(rng() - 0.5) * vol * 1.5;
    const high = Math.max(open, close) + highOffset;
    const low = Math.min(open, close) - lowOffset;
    const volume = Math.floor(rng() * 5000) + 1000;

    candles.push({ time: now - i * intervalMs, open, high, low, close, volume });
    prevClose = close;
  }

  return candles;
}

export function generateSimulatedPairs(): PairData[] {
  return FOREX_PAIRS.map((p) => {
    const candles1D = generateCandles(p.symbol, 120, 1440);
    const candles4h = generateCandles(p.symbol, 100, 240);
    const candles1h = generateCandles(p.symbol, 200, 60);
    const candles15m = generateCandles(p.symbol, 200, 15);
    const latest = candles1h[candles1h.length - 1];
    const first = candles1h[0];
    return {
      symbol: p.symbol,
      price: latest.close,
      change: latest.close - first.open,
      changePercent: ((latest.close - first.open) / first.open) * 100,
      high: Math.max(...candles1h.map((c) => c.high)),
      low: Math.min(...candles1h.map((c) => c.low)),
      candles: candles1h,
      spread: p.pipSize * 2,
      isLive: false,
      timeframes: {
        '1D': candles1D,
        '4h': candles4h,
        '1h': candles1h,
        '15m': candles15m,
      },
    };
  });
}
