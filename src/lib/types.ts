export interface Trade {
  id: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  status: 'open' | 'closed';
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number;
  pips_result: number | null;
  profit_loss: number | null;
  strategy: string | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  // Edge Analyzer metadata
  session?: TradingSession | null;
  setup_type?: string | null;
  confidence_level?: number | null;
  mental_state?: MentalState | null;
  confluences?: string[] | null;
  exit_reason?: ExitReason | null;
  max_favorable_pips?: number | null;
  max_adverse_pips?: number | null;
  planned_rr?: number | null;
  day_of_week?: number | null;
}

export type TradingSession = 'asia' | 'london' | 'new_york' | 'overlap' | 'off_hours';
export type MentalState = 'focused' | 'calm' | 'neutral' | 'tired' | 'stressed' | 'fomo' | 'revenge' | 'confident';
export type ExitReason = 'target' | 'stop' | 'manual' | 'trailing' | 'time_exit' | 'breakeven' | 'fear' | 'greed' | 'revenge_close';
export type TradingStyle = 'smc' | 'price_action' | 'ict' | 'indicator' | 'custom';

export interface AppSettings {
  id: string;
  account_balance: number;
  risk_per_trade: number;
  currency: string;
  updated_at: string;
  custom_setup_types?: string[] | null;
  custom_confluences?: string[] | null;
  trading_style?: TradingStyle | null;
}

export interface TradeConfig {
  setupTypes: string[];
  confluences: string[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TimeframeKey = '1D' | '4h' | '1h' | '15m';

export interface PairData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  candles: Candle[];
  spread: number;
  isLive: boolean;
  timeframes: Record<TimeframeKey, Candle[]>;
}

// SMC Types

export interface SwingPoint {
  index: number;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
  isHigh: boolean;
  time: number;
  swept: boolean;
}

export interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'ranging';
  lastBOS: { index: number; direction: 'bullish' | 'bearish'; price: number } | null;
  lastCHoCH: { index: number; direction: 'bullish' | 'bearish'; price: number } | null;
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
}

export interface OrderBlock {
  index: number;
  top: number;
  bottom: number;
  direction: 'bullish' | 'bearish';
  mitigated: boolean;
  time: number;
  strength: number;
}

export interface FairValueGap {
  index: number;
  top: number;
  bottom: number;
  direction: 'bullish' | 'bearish';
  filled: boolean;
  time: number;
}

export interface LiquidityLevel {
  price: number;
  type: 'buy-side' | 'sell-side';
  swept: boolean;
  sweptIndex: number | null;
  strength: number;
  formedAtIndex: number;
}

export interface SMCAnalysis {
  structure: MarketStructure;
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquidity: LiquidityLevel[];
  premiumDiscount: {
    premium: { top: number; bottom: number };
    discount: { top: number; bottom: number };
    equilibrium: number;
    currentZone: 'premium' | 'discount' | 'equilibrium';
  };
}

export interface TimeframeAnalysis {
  timeframe: TimeframeKey;
  label: string;
  smc: SMCAnalysis;
  bias: 'bullish' | 'bearish' | 'ranging';
  atPOI: boolean;
  poiType: string | null;
  poiDetail: string | null;
  hasMSS: boolean;
  hasInducement: boolean;
  atEntryOB: boolean;
}

export type SignalDirection = 'BUY' | 'SELL' | 'NEUTRAL';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export interface SMCReading {
  name: string;
  value: string;
  signal: SignalDirection;
  detail: string;
  timeframe?: TimeframeKey;
}

export interface TradingSignal {
  pair: string;
  direction: SignalDirection;
  strength: SignalStrength;
  confidence: number;
  price: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  pipsRisk: number;
  pipsReward: number;
  readings: SMCReading[];
  timestamp: number;
  strategy: string;
  smc: SMCAnalysis;
  timeframeAnalysis: TimeframeAnalysis[];
  htfBias: 'bullish' | 'bearish' | 'ranging';
  mtfAtPOI: boolean;
  ltfTrigger: boolean;
}

export interface StrategyConfig {
  swingLength: number;
  minOrderBlockStrength: number;
  fvgMaxAge: number;
  liquidityMinTouches: number;
  riskRewardMin: number;
  minConfidence: number;
  atrMultiplierSL: number;
  premiumDiscountOnly: boolean;
  htfTimeframe: TimeframeKey;
  mtfTimeframe: TimeframeKey;
  ltfTimeframe: TimeframeKey;
  entryTimeframe: TimeframeKey;
}

export interface BacktestResult {
  pair: string;
  strategy: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPips: number;
  avgWinPips: number;
  avgLossPips: number;
  profitFactor: number;
  maxDrawdownPips: number;
  longestWinStreak: number;
  longestLossStreak: number;
  equity: number;
  trades: BacktestTrade[];
}

export interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  pips: number;
  result: 'win' | 'loss';
  entryTime: number;
  exitTime: number;
  reason: string;
}

// Edge Analyzer types

export interface EdgeInsight {
  category: string;
  label: string;
  value: string;
  detail: string;
  isPositive: boolean;
  sampleSize: number;
}

export interface HeatmapCell {
  label: string;
  winRate: number;
  totalPips: number;
  tradeCount: number;
  avgPips: number;
}

export interface ConfluenceStats {
  confluence: string;
  trades: number;
  wins: number;
  winRate: number;
  avgPips: number;
  totalPips: number;
}

export interface PreTradeScore {
  score: number; // 0-100
  recommendation: 'strong_take' | 'take' | 'caution' | 'avoid';
  matchedHistory: number;
  historicalWinRate: number;
  historicalAvgPips: number;
  insights: string[];
}

export type ViewName = 'dashboard' | 'scanner' | 'backtest' | 'journal' | 'analytics' | 'edge' | 'scorer' | 'risk' | 'settings' | 'import';
