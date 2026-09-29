import type { Candle } from '@/lib/types';

interface CandleChartProps {
  candles: Candle[];
  height?: number;
  showVolume?: boolean;
  symbol?: string;
}

export function CandleChart({ candles, height = 300, showVolume = false, symbol }: CandleChartProps) {
  const width = 800;
  const padding = { top: 20, right: 60, bottom: showVolume ? 50 : 25, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const volHeight = showVolume ? 40 : 0;

  const displayCandles = candles.slice(-80);
  const candleWidth = chartWidth / displayCandles.length;
  const bodyWidth = Math.max(candleWidth * 0.6, 2);

  const allHighs = displayCandles.map((c) => c.high);
  const allLows = displayCandles.map((c) => c.low);
  const maxPrice = Math.max(...allHighs);
  const minPrice = Math.min(...allLows);
  const priceRange = maxPrice - minPrice || 1;
  const padded = priceRange * 0.1;
  const yMax = maxPrice + padded;
  const yMin = minPrice - padded;
  const yRange = yMax - yMin;

  const maxVol = Math.max(...displayCandles.map((c) => c.volume));

  const yToPx = (price: number) => padding.top + ((yMax - price) / yRange) * chartHeight;
  const xToPx = (i: number) => padding.left + i * candleWidth + candleWidth / 2;

  const priceSteps = 5;
  const priceLines = Array.from({ length: priceSteps + 1 }, (_, i) => yMin + (yRange / priceSteps) * i);

  const formatPrice = (p: number) => {
    if (p > 50) return p.toFixed(2);
    return p.toFixed(5);
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      {/* Price grid lines */}
      {priceLines.map((p, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={yToPx(p)}
            x2={width - padding.right}
            y2={yToPx(p)}
            stroke="#1e293b"
            strokeWidth="0.5"
            strokeDasharray="2,4"
          />
          <text
            x={width - padding.right + 5}
            y={yToPx(p) + 4}
            fill="#64748b"
            fontSize="11"
            fontFamily="monospace"
          >
            {formatPrice(p)}
          </text>
        </g>
      ))}

      {/* Candles */}
      {displayCandles.map((c, i) => {
        const isBull = c.close >= c.open;
        const color = isBull ? '#22c55e' : '#ef4444';
        const x = xToPx(i);
        const wickTop = yToPx(c.high);
        const wickBottom = yToPx(c.low);
        const bodyTop = yToPx(Math.max(c.open, c.close));
        const bodyBottom = yToPx(Math.min(c.open, c.close));
        const bodyH = Math.max(bodyBottom - bodyTop, 1);

        return (
          <g key={i}>
            <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth="1" />
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={bodyH}
              fill={color}
              opacity={isBull ? 0.9 : 0.9}
            />
          </g>
        );
      })}

      {/* Volume bars */}
      {showVolume && displayCandles.map((c, i) => {
        const x = xToPx(i);
        const isBull = c.close >= c.open;
        const volH = (c.volume / maxVol) * volHeight;
        return (
          <rect
            key={`vol-${i}`}
            x={x - bodyWidth / 2}
            y={height - padding.bottom + 5}
            width={bodyWidth}
            height={volH}
            fill={isBull ? '#22c55e' : '#ef4444'}
            opacity="0.3"
          />
        );
      })}

      {/* Symbol label */}
      {symbol && (
        <text x={padding.left + 5} y={padding.top + 15} fill="#94a3b8" fontSize="13" fontWeight="600">
          {symbol}
        </text>
      )}
    </svg>
  );
}
