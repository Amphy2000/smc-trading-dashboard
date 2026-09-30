interface GaugeProps {
  value: number;
  max?: number;
  label?: string;
  size?: number;
}

export function Gauge({ value, max = 100, label, size = 120 }: GaugeProps) {
  const radius = size / 2 - 10;
  const circumference = Math.PI * radius;
  const pct = Math.min(Math.max(value / max, 0), 1);
  const dashOffset = circumference * (1 - pct);

  const color = pct >= 0.75 ? '#22c55e' : pct >= 0.5 ? '#3b82f6' : pct >= 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          fill={color}
          fontSize="22"
          fontWeight="700"
          fontFamily="monospace"
        >
          {value}%
        </text>
      </svg>
      {label && <span className="text-xs text-slate-400 mt-1">{label}</span>}
    </div>
  );
}
