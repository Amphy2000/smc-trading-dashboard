import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Dna, Mail, Lock, Eye, EyeOff, TrendingUp, Shield, BarChart3, Sparkles } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        if (mode === 'signin') {
          await signIn(email, password);
        } else {
          const result = await signUp(email, password);
          if (result.user && !result.session) {
            setError('Check your email for a confirmation link to complete sign-up.');
            setMode('signin');
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        if (msg.includes('Invalid login credentials')) {
          setError('Incorrect email or password. Please try again.');
        } else if (msg.includes('User already registered')) {
          setError('An account with this email already exists. Try signing in instead.');
          setMode('signin');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, signIn, signUp]
  );

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100 flex items-center justify-center p-4 overflow-x-hidden font-sans relative">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent-600/[0.08] rounded-full blur-[140px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent-700/[0.06] rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-grid-faint bg-grid-40 opacity-30" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative p-3.5 bg-accent-600/15 rounded-2xl mb-3 ring-1 ring-accent-500/25 shadow-glow">
            <Dna className="w-10 h-10 text-accent-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient">TraderDNA</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Your Trading Edge</p>
        </div>

        {/* Auth card */}
        <div className="bg-ink-900/70 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-modal">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-ink-850/80 rounded-xl mb-6 border border-white/[0.04]">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'signin'
                  ? 'bg-accent-600 text-white shadow-glow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'signup'
                  ? 'bg-accent-600 text-white shadow-glow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-ink-850/80 border border-white/[0.06] rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/15 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  className="w-full pl-10 pr-11 py-3 bg-ink-850/80 border border-white/[0.06] rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/15 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm text-rose-400 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 shadow-glow-sm hover:shadow-glow active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : mode === 'signin' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Feature badges */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { icon: TrendingUp, label: 'Live Market Data', color: 'text-accent-400' },
            { icon: BarChart3, label: 'Trade Analytics', color: 'text-cyan-400' },
            { icon: Shield, label: 'Private & Secure', color: 'text-emerald-400' },
          ].map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-2 text-center">
              <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.04]">
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <span className="text-[11px] text-slate-500 leading-tight">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
