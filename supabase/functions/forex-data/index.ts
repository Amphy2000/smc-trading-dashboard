const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const YAHOO_SYMBOLS: Record<string, string> = {
  // Forex
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'USD/JPY': 'USDJPY=X',
  'USD/CHF': 'USDCHF=X',
  'AUD/USD': 'AUDUSD=X',
  'USD/CAD': 'USDCAD=X',
  'NZD/USD': 'NZDUSD=X',
  'EUR/GBP': 'EURGBP=X',
  'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X',
  'AUD/JPY': 'AUDJPY=X',
  'EUR/AUD': 'EURAUD=X',
  // Metals
  'XAU/USD': 'GC=F',
  'XAG/USD': 'SI=F',
  // Crypto
  'BTC/USD': 'BTC-USD',
  'ETH/USD': 'ETH-USD',
  // Indices
  'US30': '^DJI',
  'US100': '^NDX',
  'US500': '^GSPC',
  'GER40': '^GDAXI',
  'UK100': '^FTSE',
  'JP225': '^N225',
  // Energy
  'USOIL': 'CL=F',
  'UKOIL': 'BZ=F',
};

// 4-tier top-down Yahoo interval + range mapping
// Daily: 1d candles, 6mo range
// 4H: aggregated from 1h candles (Yahoo has no native 4h), 30d range
// 1H: 60m candles, 5d range
// 15M: 15m candles, 5d range
const TIMEFRAMES: Record<string, { interval: string; range: string }> = {
  '1D': { interval: '1d', range: '6mo' },
  '4h': { interval: '60m', range: '30d' },
  '1h': { interval: '60m', range: '5d' },
  '15m': { interval: '15m', range: '5d' },
};

async function fetchYahooCandles(yahooSymbol: string, interval: string, range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status} for ${yahooSymbol}`);
  }

  const data = await response.json();

  if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
    throw new Error(`No data returned for ${yahooSymbol}`);
  }

  const result = data.chart.result[0];
  const timestamps: number[] = result.timestamp || [];
  const quoteData = result.indicators.quote[0];

  if (!timestamps.length || !quoteData) {
    throw new Error(`Empty data for ${yahooSymbol}`);
  }

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quoteData.open?.[i];
    const h = quoteData.high?.[i];
    const l = quoteData.low?.[i];
    const c = quoteData.close?.[i];
    const v = quoteData.volume?.[i] || 0;

    if (o == null || h == null || l == null || c == null) continue;

    candles.push({
      time: timestamps[i] * 1000,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v,
    });
  }

  return candles;
}

// Aggregate 1h candles into 4h candles (6 x 4h = 24h, so 4 candles per 4h block)
function aggregateTo4h(candles: Candle[]): Candle[] {
  if (candles.length === 0) return [];
  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += 4) {
    const chunk = candles.slice(i, i + 4);
    if (chunk.length === 0) continue;
    result.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    });
  }
  return result;
}

async function fetchTimeframe(yahooSymbol: string, tfKey: string): Promise<Candle[] | null> {
  const tf = TIMEFRAMES[tfKey];
  if (!tf) return null;
  try {
    let candles = await fetchYahooCandles(yahooSymbol, tf.interval, tf.range);
    if (tfKey === '4h') {
      candles = aggregateTo4h(candles);
    }
    return candles;
  } catch (e) {
    console.error(`Failed ${tfKey} for ${yahooSymbol}: ${e.message}`);
    return null;
  }
}

interface PairMultiTFResult {
  symbol: string;
  timeframes: {
    '1D': Candle[] | null;
    '4h': Candle[] | null;
    '1h': Candle[] | null;
    '15m': Candle[] | null;
  };
  currentPrice: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
}

async function fetchPairMultiTF(pairSymbol: string): Promise<PairMultiTFResult | null> {
  const yahooSymbol = YAHOO_SYMBOLS[pairSymbol];
  if (!yahooSymbol) return null;

  const [candles1D, candles4h, candles1h, candles15m] = await Promise.all([
    fetchTimeframe(yahooSymbol, '1D'),
    fetchTimeframe(yahooSymbol, '4h'),
    fetchTimeframe(yahooSymbol, '1h'),
    fetchTimeframe(yahooSymbol, '15m'),
  ]);

  const primary = candles1h || candles4h || candles1D || candles15m;
  if (!primary || primary.length === 0) return null;

  const lastCandle = primary[primary.length - 1];
  const firstCandle = primary[0];
  const currentPrice = lastCandle.close;
  const change = currentPrice - firstCandle.open;
  const changePercent = firstCandle.open !== 0 ? (change / firstCandle.open) * 100 : 0;

  const dayCandles = primary.slice(-24);
  const dayHigh = Math.max(...dayCandles.map(c => c.high));
  const dayLow = Math.min(...dayCandles.map(c => c.low));

  return {
    symbol: pairSymbol,
    timeframes: {
      '1D': candles1D,
      '4h': candles4h,
      '1h': candles1h,
      '15m': candles15m,
    },
    currentPrice,
    change,
    changePercent,
    dayHigh,
    dayLow,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pairsParam = url.searchParams.get('pairs')?.split(',').filter(Boolean) || Object.keys(YAHOO_SYMBOLS);
    const multi = url.searchParams.get('multi') !== 'false';

    if (!multi) {
      // Legacy single-timeframe mode
      const interval = url.searchParams.get('interval') || '1h';
      const range = url.searchParams.get('range') || '5d';
      const yahooInterval = interval === '15m' ? '15m' : interval === '1d' ? '1d' : '60m';

      const results = await Promise.all(
        pairsParam.map(async (p) => {
          const ys = YAHOO_SYMBOLS[p];
          if (!ys) return null;
          try {
            const candles = await fetchYahooCandles(ys, yahooInterval, range);
            const last = candles[candles.length - 1];
            const first = candles[0];
            const dayC = candles.slice(-24);
            return {
              symbol: p,
              candles,
              currentPrice: last.close,
              previousClose: first.open,
              change: last.close - first.open,
              changePercent: first.open !== 0 ? ((last.close - first.open) / first.open) * 100 : 0,
              dayHigh: Math.max(...dayC.map(c => c.high)),
              dayLow: Math.min(...dayC.map(c => c.low)),
              dayOpen: first.open,
            };
          } catch { return null; }
        })
      );

      const valid = results.filter((r): r is NonNullable<typeof r> => r !== null);
      return new Response(JSON.stringify({ pairs: valid, failed: [], interval, range, timestamp: Date.now() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Multi-timeframe mode (default)
    const results = await Promise.all(pairsParam.map((p) => fetchPairMultiTF(p)));
    const valid = results.filter((r): r is PairMultiTFResult => r !== null);
    const failed = pairsParam.filter((p) => !valid.find((r) => r.symbol === p));

    return new Response(JSON.stringify({ pairs: valid, failed, timestamp: Date.now() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
