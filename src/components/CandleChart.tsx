import type { Candle } from '@/lib/types';

interface CandleChartProps {
  candles: Candle[];
  height?: number;
  showVolume?: boolean;
  symbol?: string;
}

export function CandleChart({ candles, height = 300, showVolume = false, symbol }: CandleChartProps) {
  const width = 800;
  const padding = { top: 16, right: 64, bottom: showVolume ? 56 : 28, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const volHeight = showVolume ? 36 : 0;

  const displayCandles = candles.slice(-80);
  const candleWidth = chartWidth / displayCandles.length;
  const bodyWidth = Math.max(candleWidth * 0.65, 2);

  const allHighs = displayCandles.map((c) => c.high);
  const allLows = displayCandles.map((c) => c.low);
  const maxPrice = Math.max(...allHighs);
  const minPrice = Math.min(...allLows);
  const priceRange = maxPrice - minPrice || 1;
  const padded = priceRange * 0.08;
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

  const formatTime = (t: number) => {
    const d = new Date(t);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const timeStep = Math.max(1, Math.floor(displayCandles.length / 5));
  const timeLabels = displayCandles
    .map((c, i) => ({ time: c.time, index: i }))
    .filter((_, i) => i % timeStep === 0);

  const lastCandle = displayCandles[displayCandles.length - 1];
  const lastPrice = lastCandle?.close ?? 0;
  const lastY = yToPx(lastPrice);
  const lastX = xToPx(displayCandles.length - 1);
  const lastColor = lastCandle && lastCandle.close >= lastCandle.open ? '#22c55e' : '#ef4444';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0a0f1c" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="url(#chartBg)" />

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
            x={width - padding.right + 6}
            y={yToPx(p) + 4}
            fill="#64748b"
            fontSize="10"
            fontFamily="monospace"
          >
            {formatPrice(p)}
          </text>
        </g>
      ))}

      {/* Time axis labels */}
      {timeLabels.map(({ time, index }) => (
        <text
          key={index}
          x={xToPx(index)}
          y={height - padding.bottom + 16}
          fill="#64748b"
          fontSize="9"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {formatTime(time)}
        </text>
      ))}

      {/* Candles */}
      {displayCandles.map((c, i) => {
        const isBull = c.close >= c.open;
        const color = isBull ? '#26a69a' : '#ef5350';
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
              opacity={isBull ? 0.85 : 0.9}
            />
          </g>
        );
      })}

      {/* Volume bars */}
      {showVolume && displayCandles.map((c, i) => {
        const x = xToPx(i);
        const isBull = c.close >= c.open;
        const volH = maxVol > 0 ? (c.volume / maxVol) * volHeight : 0;
        return (
          <rect
            key={`vol-${i}`}
            x={x - bodyWidth / 2}
            y={height - padding.bottom + 6}
            width={bodyWidth}
            height={volH}
            fill={isBull ? '#26a69a' : '#ef5350'}
            opacity="0.25"
          />
        );
      })}

      {/* Current price line + label */}
      {lastCandle && (
        <g>
          <line
            x1={padding.left}
            y1={lastY}
            x2={lastX}
            y2={lastY}
            stroke={lastColor}
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.5"
          />
          <rect
            x={width - padding.right}
            y={lastY - 8}
            width={56}
            height={16}
            fill={lastColor}
            rx="3"
          />
          <text
            x={width - padding.right + 28}
            y={lastY + 4}
            fill="#ffffff"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="700"
            textAnchor="middle"
          >
            {formatPrice(lastPrice)}
          </text>
        </g>
      )}

      {/* Symbol label */}
      {symbol && (
        <text x={padding.left + 6} y={padding.top + 14} fill="#94a3b8" fontSize="12" fontWeight="600">
          {symbol}
        </text>
      )}
    </svg>
  );
}
