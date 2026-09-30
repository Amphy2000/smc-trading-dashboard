import { useState, useEffect, useMemo } from 'react';
import type { ViewName, TradingSignal, StrategyConfig, TradeConfig } from '@/lib/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useForexData } from '@/hooks/useForexData';
import { useTrades } from '@/hooks/useTrades';
import { useSettings } from '@/hooks/useSettings';
import { DEFAULT_STRATEGY } from '@/lib/signalEngine';
import { getConfigFromSettings } from '@/lib/edgeAnalyzer';
import { Dashboard } from '@/views/Dashboard';
import { Scanner } from '@/views/Scanner';
import { Backtest } from '@/views/Backtest';
import { Journal } from '@/views/Journal';
import { Analytics } from '@/views/Analytics';
import { EdgeDNA } from '@/views/EdgeDNA';
import { PreTradeScorer } from '@/views/PreTradeScorer';
import { RiskCalculator } from '@/views/RiskCalculator';
import { SettingsView } from '@/views/Settings';
import { AuthPage } from '@/views/AuthPage';
import { Landing } from '@/views/Landing';
import { Import } from '@/views/Import';
import { TradeCalendar } from '@/views/TradeCalendar';
import {
  LayoutDashboard, Radar, FlaskConical, BookOpen, BarChart3,
  Calculator, Settings as SettingsIcon, Dna, ClipboardCheck,
  MoreHorizontal, X, LogOut, Upload, Calendar,
} from 'lucide-react';

interface NavItem {
  view: ViewName;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
  primary: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Home', shortLabel: 'Home', icon: LayoutDashboard, primary: true },
  { view: 'journal', label: 'Journal', shortLabel: 'Journal', icon: BookOpen, primary: true },
  { view: 'scorer', label: 'Pre-Trade Scorer', shortLabel: 'Score', icon: ClipboardCheck, primary: true },
  { view: 'edge', label: 'Edge DNA', shortLabel: 'Edge', icon: Dna, primary: true },
  { view: 'scanner', label: 'Scanner', shortLabel: 'Scan', icon: Radar, primary: true },
  { view: 'analytics', label: 'Analytics', shortLabel: 'Stats', icon: BarChart3, primary: false },
  { view: 'calendar', label: 'Trade Calendar', shortLabel: 'Calendar', icon: Calendar, primary: false },
  { view: 'backtest', label: 'Backtest', shortLabel: 'Test', icon: FlaskConical, primary: false },
  { view: 'risk', label: 'Risk Calc', shortLabel: 'Risk', icon: Calculator, primary: false },
  { view: 'import', label: 'Import MT5', shortLabel: 'Import', icon: Upload, primary: false },
  { view: 'settings', label: 'Settings', shortLabel: 'Config', icon: SettingsIcon, primary: false },
];

function App() {
  const { session, loading: authLoading, signOut } = useAuth();
  const [view, setView] = useState<ViewName>(() => {
    const saved = localStorage.getItem('active_view');
    return (saved as ViewName) || 'dashboard';
  });
  const [strategy, setStrategy] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [pendingSignal, setPendingSignal] = useState<TradingSignal | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  const { pairs, loading, refreshing, lastUpdate, refresh, isLive } = useForexData(30000);
  const { trades, addTrade, closeTrade, deleteTrade, refetch } = useTrades();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const saved = localStorage.getItem('strategy_config');
    if (saved) {
      try {
        setStrategy(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('strategy_config', JSON.stringify(strategy));
  }, [strategy]);

  const accountBalance = settings?.account_balance ?? 10000;
  const riskPerTrade = settings?.risk_per_trade ?? 2;
  const currency = settings?.currency ?? 'USD';

  const tradeConfig: TradeConfig = useMemo(() => getConfigFromSettings(settings || {}), [settings]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-5">
            <div className="absolute inset-0 border-2 border-accent-500/20 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-accent-500 rounded-full animate-spin" />
          </div>
          <p className="text-slate-500 text-sm font-medium tracking-wide">Loading TraderDNA</p>
        </div>
      </div>
    );
  }

  if (!session) {
    if (showAuth) {
      return <AuthPage />;
    }
    if (showLanding) {
      return (
        <Landing
          onGetStarted={() => setShowAuth(true)}
          onSignIn={() => setShowAuth(true)}
        />
      );
    }
    return <AuthPage />;
  }

  const handleExecuteTrade = (signal: TradingSignal) => {
    setPendingSignal(signal);
    setView('journal');
  };

  const navigate = (v: ViewName) => {
    setView(v);
    localStorage.setItem('active_view', v);
    setMoreMenuOpen(false);
  };

  const primaryItems = NAV_ITEMS.filter((i) => i.primary);
  const secondaryItems = NAV_ITEMS.filter((i) => !i.primary);
  const currentNav = NAV_ITEMS.find((i) => i.view === view);

  const desktopNavItems = NAV_ITEMS.map((item) => {
    const isActive = view === item.view;
    return (
      <button
        key={item.view}
        onClick={() => navigate(item.view)}
        className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full relative ${
          isActive
            ? 'bg-accent-500/10 text-accent-400'
            : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]'
        }`}
      >
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent-500 rounded-full" />}
        <item.icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
        <span>{item.label}</span>
      </button>
    );
  });

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100 overflow-x-hidden font-sans">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-accent-600/[0.07] rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-accent-700/[0.05] rounded-full blur-[120px]" />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-ink-900/80 border-r border-white/[0.05] flex-col p-4 z-40 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-5">
          <div className="relative p-2 bg-accent-600/15 rounded-xl ring-1 ring-accent-500/20">
            <Dna className="w-6 h-6 text-accent-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight">TraderDNA</h1>
            <p className="text-[11px] text-slate-500 font-medium">Your Trading Edge</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto no-scrollbar">
          {desktopNavItems}
        </nav>
        <div className="border-t border-white/[0.05] pt-4 px-2 space-y-2">
          <div className="flex items-center gap-2.5 py-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-500/20 to-accent-700/10 flex items-center justify-center flex-shrink-0 ring-1 ring-accent-500/20">
              <span className="text-xs font-semibold text-accent-400">
                {session.user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-slate-400 truncate flex-1">{session.user.email}</span>
            <button
              onClick={() => signOut()}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-ink-900/80 border-b border-white/[0.05] z-40 px-4 py-3 flex items-center justify-between backdrop-blur-xl safe-top">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-accent-600/15 rounded-lg ring-1 ring-accent-500/20">
            <Dna className="w-5 h-5 text-accent-400" />
          </div>
          <h1 className="text-base font-bold tracking-tight">TraderDNA</h1>
        </div>
        <span className="text-xs text-slate-500 font-medium">{currentNav?.label}</span>
      </header>

      {/* Mobile more menu */}
      {moreMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 top-0 z-45 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setMoreMenuOpen(false)} />
          <div className="lg:hidden fixed bottom-[76px] left-2 right-2 z-50 bg-ink-900/95 border border-white/[0.08] rounded-2xl shadow-modal p-3 safe-bottom animate-slide-up backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-sm font-semibold text-slate-300">More Tools</span>
              <button onClick={() => setMoreMenuOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {secondaryItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => navigate(item.view)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                    view === item.view
                      ? 'bg-accent-500/10 text-accent-400 ring-1 ring-accent-500/20'
                      : 'text-slate-400 bg-white/[0.03] hover:text-slate-200 hover:bg-white/[0.06]'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.shortLabel}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center gap-2 px-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-500/20 to-accent-700/10 flex items-center justify-center flex-shrink-0 ring-1 ring-accent-500/20">
                  <span className="text-xs font-semibold text-accent-400">
                    {session.user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-slate-400 truncate flex-1">{session.user.email}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 transition-all"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-ink-900/85 border-t border-white/[0.05] z-40 backdrop-blur-xl safe-bottom">
        <div className="flex items-stretch justify-around px-1 py-1">
          {primaryItems.map((item) => {
            const isActive = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl transition-all duration-200 flex-1 min-w-0 ${isActive ? 'text-accent-400' : 'text-slate-600 hover:text-slate-300'}`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] font-medium truncate">{item.shortLabel}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl transition-colors flex-1 min-w-0 ${
              moreMenuOpen || secondaryItems.some((i) => i.view === view)
                ? 'text-accent-400'
                : 'text-slate-600 hover:text-slate-300'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen overflow-x-hidden relative">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="relative w-14 h-14 mx-auto mb-5">
                  <div className="absolute inset-0 border-2 border-accent-500/20 rounded-full" />
                  <div className="absolute inset-0 border-2 border-transparent border-t-accent-500 rounded-full animate-spin" />
                </div>
                <p className="text-slate-500 text-sm font-medium">Loading market data...</p>
              </div>
            </div>
          ) : (
            <div key={view} className="animate-fade-in-up">
              {view === 'dashboard' && (
                <Dashboard
                  pairs={pairs}
                  trades={trades}
                  isLive={isLive}
                  onNavigate={navigate}
                  onExecuteTrade={handleExecuteTrade}
                />
              )}
              {view === 'scanner' && (
                <Scanner
                  pairs={pairs}
                  strategy={strategy}
                  onStrategyChange={setStrategy}
                  onExecuteTrade={handleExecuteTrade}
                  lastUpdate={lastUpdate}
                  onRefresh={refresh}
                  isLive={isLive}
                  refreshing={refreshing}
                />
              )}
              {view === 'backtest' && <Backtest pairs={pairs} />}
              {view === 'journal' && (
                <Journal
                  trades={trades}
                  addTrade={addTrade}
                  closeTrade={closeTrade}
                  deleteTrade={deleteTrade}
                  pendingSignal={pendingSignal}
                  onClearPendingSignal={() => setPendingSignal(null)}
                  refetchTrades={refetch}
                  config={tradeConfig}
                  pairs={pairs}
                />
              )}
              {view === 'analytics' && <Analytics trades={trades} />}
              {view === 'calendar' && <TradeCalendar trades={trades} />}
              {view === 'edge' && <EdgeDNA trades={trades} />}
              {view === 'scorer' && <PreTradeScorer trades={trades} config={tradeConfig} />}
              {view === 'risk' && (
                <RiskCalculator accountBalance={accountBalance} riskPerTrade={riskPerTrade} currency={currency} />
              )}
              {view === 'import' && (
                <Import refetchTrades={refetch} onOpenJournal={() => navigate('journal')} />
              )}
              {view === 'settings' && (
                <SettingsView
                  settings={settings}
                  updateSettings={updateSettings}
                  strategy={strategy}
                  onStrategyChange={setStrategy}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
