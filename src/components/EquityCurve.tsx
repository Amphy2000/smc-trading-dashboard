interface EquityCurveProps {
  values: number[];
  height?: number;
}

export function EquityCurve({ values, height = 200 }: EquityCurveProps) {
  const width = 800;
  const padding = { top: 20, right: 60, bottom: 25, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (values.length < 2) {
    return (
      <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>
        Not enough data
      </div>
    );
  }

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padded = range * 0.1;
  const yMax = max + padded;
  const yMin = min - padded;
  const yRange = yMax - yMin;

  const yToPx = (v: number) => padding.top + ((yMax - v) / yRange) * chartHeight;
  const xToPx = (i: number) => padding.left + (i / (values.length - 1)) * chartWidth;

  const points = values.map((v, i) => `${xToPx(i)},${yToPx(v)}`);
  const linePath = `M ${points.join(' L ')}`;
  const fillPath = `${linePath} L ${xToPx(values.length - 1)},${padding.top + chartHeight} L ${xToPx(0)},${padding.top + chartHeight} Z`;

  const isProfit = values[values.length - 1] >= 0;
  const color = isProfit ? '#22c55e' : '#ef4444';

  const priceSteps = 5;
  const gridLines = Array.from({ length: priceSteps + 1 }, (_, i) => yMin + (yRange / priceSteps) * i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      {gridLines.map((v, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={yToPx(v)}
            x2={width - padding.right}
            y2={yToPx(v)}
            stroke="#1e293b"
            strokeWidth="0.5"
            strokeDasharray="2,4"
          />
          <text x={width - padding.right + 5} y={yToPx(v) + 4} fill="#64748b" fontSize="11" fontFamily="monospace">
            {v >= 0 ? '+' : ''}{v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Zero line */}
      <line
        x1={padding.left}
        y1={yToPx(0)}
        x2={width - padding.right}
        y2={yToPx(0)}
        stroke="#475569"
        strokeWidth="1"
      />

      <path d={fillPath} fill={color} opacity="0.15" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
