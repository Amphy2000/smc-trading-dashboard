import type { ReactNode } from 'react';
import { FOREX_PAIRS, PAIR_CATEGORIES } from '@/lib/forex';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-ink-900/60 border border-white/[0.06] rounded-2xl backdrop-blur-xl shadow-card transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-white/[0.12] hover:shadow-card-hover hover:-translate-y-0.5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ label, value, subtext, icon, trend }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-300';
  const trendGlow = trend === 'up' ? 'from-emerald-500/10' : trend === 'down' ? 'from-rose-500/10' : 'from-white/[0.03]';

  return (
    <Card className={`p-4 sm:p-5 bg-gradient-to-br ${trendGlow} via-ink-900/60 to-transparent`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest font-medium">{label}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1.5 font-mono tracking-tight ${trendColor}`}>{value}</p>
          {subtext && <p className="text-[11px] text-slate-500 mt-1">{subtext}</p>}
        </div>
        {icon && <div className="text-slate-600 mt-0.5">{icon}</div>}
      </div>
    </Card>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const variants = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
    neutral: 'bg-white/[0.04] text-slate-400 border-white/[0.08]',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, className = '', type = 'button' }: ButtonProps) {
  const variants = {
    primary: 'bg-accent-600 hover:bg-accent-500 text-white shadow-glow-sm hover:shadow-glow hover:bg-accent-500',
    secondary: 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] hover:border-white/[0.14]',
    danger: 'bg-rose-500/90 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20',
    ghost: 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-sm',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-medium transition-all duration-200 active:scale-[0.97] ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-40 cursor-not-allowed active:scale-100' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

interface InputProps {
  label?: string;
  value: string | number;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  className?: string;
}

export function Input({ label, value, onChange, type = 'text', placeholder, step, min, max, className = '' }: InputProps) {
  return (
    <div className={className}>
      {label && <label className="block text-xs text-slate-400 mb-1.5 font-medium tracking-wide">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className="w-full bg-ink-850/80 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/15 transition-all duration-200"
      />
    </div>
  );
}

interface SelectProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function Select({ label, value, onChange, options, className = '' }: SelectProps) {
  return (
    <div className={className}>
      {label && <label className="block text-xs text-slate-400 mb-1.5 font-medium tracking-wide">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-ink-850/80 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/15 transition-all duration-200"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface PairSelectProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function PairSelect({ label, value, onChange, className = '' }: PairSelectProps) {
  return (
    <div className={className}>
      {label && <label className="block text-xs text-slate-400 mb-1.5 font-medium tracking-wide">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-ink-850/80 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/15 transition-all duration-200"
      >
        {PAIR_CATEGORIES.map((cat) => {
          const pairs = FOREX_PAIRS.filter((p) => p.category === cat.key);
          if (pairs.length === 0) return null;
          return (
            <optgroup key={cat.key} label={cat.label}>
              {pairs.map((p) => (
                <option key={p.symbol} value={p.symbol}>{p.symbol} — {p.label}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className={`w-full ${width} bg-ink-900 border border-white/[0.08] rounded-2xl shadow-modal max-h-[90vh] overflow-y-auto animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-slate-100 tracking-tight">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] transition-all text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
