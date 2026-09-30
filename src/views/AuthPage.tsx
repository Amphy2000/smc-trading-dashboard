import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Dna, Mail, Lock, Eye, EyeOff, TrendingUp, Shield, BarChart3 } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 overflow-x-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-blue-600/20 rounded-2xl mb-3 ring-1 ring-blue-500/20">
            <Dna className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TraderDNA</h1>
          <p className="text-sm text-slate-400 mt-1">Your Trading Edge</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  className="w-full pl-10 pr-11 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/20"
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

        <div className="grid grid-cols-3 gap-3 mt-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-2 bg-slate-800/50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[11px] text-slate-500 leading-tight">Live Market Data</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-2 bg-slate-800/50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-[11px] text-slate-500 leading-tight">Trade Analytics</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-2 bg-slate-800/50 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[11px] text-slate-500 leading-tight">Private & Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
