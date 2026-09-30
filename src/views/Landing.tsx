import { useState, useEffect, useCallback } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Button } from '@/components/ui';
import {
  Dna, TrendingUp, Brain, Radar, ShieldCheck, BarChart3,
  ArrowRight, Check, Star, Zap, Clock, Target, Activity,
  LineChart, AlertTriangle, Sparkles, Lock, Smartphone,
  ChevronDown, Quote, PlayCircle, Wifi, ClipboardCheck,
} from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

// ─── Animated counter ───────────────────────────────────────
function AnimatedCounter({ value, suffix = '', duration = 2000 }: { value: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useScrollAnimation<HTMLSpanElement>({ threshold: 0.3 });

  useEffect(() => {
    if (!isVisible) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (startTime === null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(value);
    };
    requestAnimationFrame(step);
  }, [isVisible, value, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Reveal wrapper ─────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Navbar ─────────────────────────────────────────────────
function Navbar({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-ink-950/80 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-accent-600/15 rounded-lg ring-1 ring-accent-500/20">
            <Dna className="w-5 h-5 text-accent-400" />
          </div>
          <span className="text-base font-bold tracking-tight">TraderDNA</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          {['Features', 'How It Works', 'Pricing', 'Testimonials'].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-')}`} className="text-sm text-slate-400 hover:text-slate-100 transition-colors">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" onClick={onSignIn}>Sign In</Button>
          <Button size="sm" onClick={onGetStarted} className="hidden sm:flex">Get Started <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ───────────────────────────────────────────────────
function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="https://images.pexels.com/photos/38375326/pexels-photo-38375326.jpeg?auto=compress&cs=tinysrgb&w=1920"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/80 to-ink-950" />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent-600/[0.08] rounded-full blur-[160px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-700/[0.06] rounded-full blur-[140px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-grid-faint bg-grid-40 opacity-20" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent-400" />
            <span className="text-xs font-medium text-accent-300">AI-powered trading edge discovery</span>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            <span className="text-gradient">Discover the edge</span>
            <br />
            <span className="text-slate-100">that makes you money</span>
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
            TraderDNA connects to your broker, analyzes your real trades, and reveals exactly which
            sessions, setups, and mental states drive your profits. Stop guessing — start trading with evidence.
          </p>
        </Reveal>

        <Reveal delay={300}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Button size="lg" onClick={onGetStarted} className="w-full sm:w-auto">
              Start Free <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              <PlayCircle className="w-4 h-4 mr-1.5" /> Watch Demo
            </Button>
          </div>
        </Reveal>

        <Reveal delay={400}>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            {['No credit card required', 'MT5 auto-sync', 'Cancel anytime'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" /> {t}
              </span>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-5 h-5 text-slate-600" />
      </div>
    </section>
  );
}

// ─── Stats bar ──────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: 12000, suffix: '+', label: 'Traders analyzing' },
    { value: 2, suffix: 'M+', label: 'Trades synced' },
    { value: 47, suffix: '%', label: 'Avg. win rate lift' },
    { value: 99, suffix: '.9%', label: 'Uptime' },
  ];

  return (
    <section className="py-16 sm:py-20 border-y border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold font-mono text-gradient tracking-tight">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Feature card ───────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, delay }: { icon: typeof TrendingUp; title: string; desc: string; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="group relative p-6 rounded-2xl bg-ink-900/60 border border-white/[0.06] backdrop-blur-xl transition-all duration-300 hover:border-white/[0.12] hover:-translate-y-1 hover:shadow-card-hover">
        <div className="w-11 h-11 rounded-xl bg-accent-600/10 flex items-center justify-center ring-1 ring-accent-500/15 mb-4 transition-transform duration-300 group-hover:scale-110">
          <Icon className="w-5 h-5 text-accent-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-100 mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </Reveal>
  );
}

// ─── Features section ───────────────────────────────────────
function Features() {
  const features = [
    { icon: Brain, title: 'Edge DNA Analysis', desc: 'Discover which sessions, setups, pairs, and mental states actually make you money — backed by statistical significance testing.' },
    { icon: Radar, title: 'Smart Money Scanner', desc: 'Scan 24+ instruments for order blocks, fair value gaps, and liquidity zones across multiple timeframes in real-time.' },
    { icon: ClipboardCheck, title: 'Pre-Trade Scorer', desc: 'Before you enter, score your setup against your own history. Know if similar trades have made or lost you money.' },
    { icon: BarChart3, title: 'Behavioral Pattern Detection', desc: 'Automatic detection of revenge trading, overtrading, and tilt — with estimated pip cost of each bad habit.' },
    { icon: TrendingUp, title: 'MT5 Auto-Sync', desc: 'Connect your broker once. Every trade flows in automatically with correct P/L, commission, and swap data.' },
    { icon: ShieldCheck, title: 'Risk Calculator', desc: 'Calculate position size, R:R, and risk exposure in seconds. Never over-leverage again.' },
  ];

  return (
    <section id="features" className="py-20 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold text-accent-400 uppercase tracking-widest">Features</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-3 mb-4 text-slate-100">
              Everything you need to<br /><span className="text-gradient">trade with an edge</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
              Not just another journal. TraderDNA is a complete edge-discovery engine that learns from your real trades.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 60} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ───────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: Wifi, title: 'Connect your broker', desc: 'Securely link your MT5 account. Trades sync automatically — no manual logging.', image: 'https://images.pexels.com/photos/5831260/pexels-photo-5831260.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { icon: Brain, title: 'AI analyzes your trades', desc: 'We find patterns: which sessions, setups, and mental states drive your profits.', image: 'https://images.pexels.com/photos/38808473/pexels-photo-38808473.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { icon: Target, title: 'Trade with your edge', desc: 'Use the pre-trade scorer and edge insights to only take high-probability setups.', image: 'https://images.pexels.com/photos/5831347/pexels-photo-5831347.jpeg?auto=compress&cs=tinysrgb&w=800' },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-32 bg-gradient-to-b from-transparent via-accent-900/[0.03] to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold text-accent-400 uppercase tracking-widest">How It Works</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-3 mb-4 text-slate-100">
              Three steps to your edge
            </h2>
          </div>
        </Reveal>

        <div className="space-y-12 sm:space-y-20">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div className={`flex flex-col ${i % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-8 lg:gap-14`}>
                <div className="flex-1 w-full">
                  <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] group">
                    <img src={step.image} alt={step.title} className="w-full h-[280px] sm:h-[360px] object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 to-transparent" />
                    <div className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-accent-600/20 backdrop-blur-md flex items-center justify-center ring-1 ring-accent-500/30">
                      <step.icon className="w-5 h-5 text-accent-400" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full">
                  <span className="text-5xl font-bold font-mono text-accent-600/30">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-2xl font-bold text-slate-100 mt-2 mb-3 tracking-tight">{step.title}</h3>
                  <p className="text-slate-400 text-sm sm:text-base leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ────────────────────────────────────────────────
function Pricing({ onGetStarted }: { onGetStarted: () => void }) {
  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: 'Starter',
      monthly: 0,
      annual: 0,
      desc: 'Perfect for getting started',
      features: ['Manual trade journal', 'Basic analytics', 'Risk calculator', '5-instrument scanner', '1 MT5 connection'],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      monthly: 29,
      annual: 24,
      desc: 'For serious traders who want their edge',
      features: ['Everything in Starter', 'Edge DNA analysis', 'Behavioral pattern detection', 'Pre-trade scorer', 'Unlimited scanner', 'Trade replay', 'Priority sync'],
      cta: 'Start Pro Trial',
      highlighted: true,
    },
    {
      name: 'Elite',
      monthly: 79,
      annual: 65,
      desc: 'For funded & professional traders',
      features: ['Everything in Pro', 'Advanced backtesting', 'Counterfactual exit analysis', 'Accountability streaks', 'Custom setup types', 'API access', '1-on-1 onboarding'],
      cta: 'Go Elite',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold text-accent-400 uppercase tracking-widest">Pricing</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-3 mb-4 text-slate-100">
              Invest in your edge
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
              One profitable trade pays for a year. Cancel anytime.
            </p>
          </div>
        </Reveal>

        {/* Billing toggle */}
        <Reveal delay={100}>
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={`text-sm font-medium transition-colors ${!annual ? 'text-slate-100' : 'text-slate-500'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${annual ? 'bg-accent-600' : 'bg-ink-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors ${annual ? 'text-slate-100' : 'text-slate-500'}`}>
              Annual <span className="text-emerald-400 text-xs">Save 20%</span>
            </span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 80}>
              <div className={`relative p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                plan.highlighted
                  ? 'bg-gradient-to-br from-accent-500/[0.08] via-ink-900/60 to-transparent border-accent-500/25 shadow-glow'
                  : 'bg-ink-900/60 border-white/[0.06] hover:border-white/[0.12]'
              }`}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent-600 text-white text-xs font-bold shadow-glow-sm">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-100 tracking-tight">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-bold font-mono text-slate-100">${annual ? plan.annual : plan.monthly}</span>
                  <span className="text-sm text-slate-500">/mo</span>
                </div>
                <Button
                  onClick={onGetStarted}
                  variant={plan.highlighted ? 'primary' : 'secondary'}
                  className="w-full mb-5"
                >
                  {plan.cta}
                </Button>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ───────────────────────────────────────────
function Testimonials() {
  const testimonials = [
    {
      quote: "TraderDNA found that I lose 73% of London session trades but win 68% in New York. I stopped trading London and my P/L flipped green in a week.",
      name: 'Marcus T.',
      role: 'Funded Trader, FTMO',
      avatar: 'https://images.pexels.com/photos/38740728/pexels-photo-38740728.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop',
      rating: 5,
    },
    {
      quote: "The pre-trade scorer has saved me from at least 10 bad entries this month alone. It told me my win rate on low-confidence trades is 23%. Hard data.",
      name: 'Sarah K.',
      role: 'Prop Firm Trader',
      avatar: 'https://images.pexels.com/photos/34761515/pexels-photo-34761515.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop',
      rating: 5,
    },
    {
      quote: "Connected my MT5, trades sync automatically. The behavioral pattern detector caught me revenge trading twice. Worth every penny just for that.",
      name: 'David R.',
      role: 'Day Trader, 6 years',
      avatar: 'https://images.pexels.com/photos/30269649/pexels-photo-30269649.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop',
      rating: 5,
    },
  ];

  return (
    <section id="testimonials" className="py-20 sm:py-32 bg-gradient-to-b from-transparent via-accent-900/[0.03] to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold text-accent-400 uppercase tracking-widest">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-3 mb-4 text-slate-100">
              Traders are finding their edge
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <div className="p-6 rounded-2xl bg-ink-900/60 border border-white/[0.06] backdrop-blur-xl h-full flex flex-col">
                <Quote className="w-8 h-8 text-accent-600/30 mb-3 flex-shrink-0" />
                <p className="text-sm text-slate-300 leading-relaxed flex-1 mb-5">{t.quote}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{t.name}</p>
                    <p className="text-xs text-slate-500 truncate">{t.role}</p>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA section ────────────────────────────────────────────
function CTASection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="py-20 sm:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden p-10 sm:p-16 text-center border border-accent-500/15">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-600/[0.1] via-ink-900/40 to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-accent-600/10 rounded-full blur-[100px]" />
            <div className="relative">
              <div className="inline-flex p-3 bg-accent-600/15 rounded-2xl ring-1 ring-accent-500/20 mb-5 shadow-glow">
                <Dna className="w-8 h-8 text-accent-400" />
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100 mb-4">
                Stop guessing.<br /><span className="text-gradient">Start trading with evidence.</span>
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base mb-8">
                Join thousands of traders who discovered their edge with TraderDNA. Free to start — no credit card required.
              </p>
              <Button size="lg" onClick={onGetStarted}>
                Get Started Free <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────
function Footer() {
  const cols = [
    { title: 'Product', links: ['Features', 'Pricing', 'Scanner', 'Edge DNA', 'Backtest'] },
    { title: 'Resources', links: ['Documentation', 'Trading Guide', 'API Reference', 'Blog'] },
    { title: 'Company', links: ['About', 'Contact', 'Privacy', 'Terms'] },
  ];

  return (
    <footer className="border-t border-white/[0.05] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1.5 bg-accent-600/15 rounded-lg ring-1 ring-accent-500/20">
                <Dna className="w-5 h-5 text-accent-400" />
              </div>
              <span className="text-base font-bold tracking-tight">TraderDNA</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              The trading journal that discovers your edge from real data. Stop guessing — start trading with evidence.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-slate-500 hover:text-slate-200 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 border-t border-white/[0.04]">
          <p className="text-xs text-slate-600">© 2026 TraderDNA. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Bank-level encryption</span>
            <span className="flex items-center gap-1.5"><Smartphone className="w-3 h-3" /> iOS & Android ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Landing component ─────────────────────────────────
export function Landing({ onGetStarted, onSignIn }: LandingProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-100 font-sans overflow-x-hidden">
      <Navbar onGetStarted={onGetStarted} onSignIn={onSignIn} />
      <Hero onGetStarted={onGetStarted} />
      <StatsBar />
      <Features />
      <HowItWorks />
      <Pricing onGetStarted={onGetStarted} />
      <Testimonials />
      <CTASection onGetStarted={onGetStarted} />
      <Footer />
    </div>
  );
}
