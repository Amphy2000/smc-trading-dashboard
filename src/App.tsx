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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
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

  const desktopNavItems = NAV_ITEMS.map((item) => (
    <button
      key={item.view}
      onClick={() => navigate(item.view)}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all w-full ${
        view === item.view
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      <span>{item.label}</span>
    </button>
  ));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 bg-slate-900/95 border-r border-slate-800 flex-col p-4 z-40">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <Dna className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100">TraderDNA</h1>
            <p className="text-xs text-slate-500">Your Trading Edge</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {desktopNavItems}
        </nav>
        <div className="border-t border-slate-800 pt-4 px-2 space-y-2">
          <p className="text-xs text-slate-500">{tradeConfig.setupTypes.length} setup types</p>
          <p className="text-xs text-slate-500">{tradeConfig.confluences.length} confluences</p>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-blue-400">
                {session.user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-slate-400 truncate flex-1">{session.user.email}</span>
            <button
              onClick={() => signOut()}
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900/95 border-b border-slate-800 z-40 px-4 py-3 flex items-center justify-between backdrop-blur-sm safe-top">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/20 rounded-lg">
            <Dna className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-base font-bold">TraderDNA</h1>
        </div>
        <span className="text-xs text-slate-500">{currentNav?.label}</span>
      </header>

      {moreMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 top-0 z-45 bg-black/40" onClick={() => setMoreMenuOpen(false)} />
          <div className="lg:hidden fixed bottom-[72px] left-2 right-2 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 safe-bottom">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-sm font-semibold text-slate-300">More Tools</span>
              <button onClick={() => setMoreMenuOpen(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {secondaryItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => navigate(item.view)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    view === item.view
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.shortLabel}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 px-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-blue-400">
                    {session.user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-slate-400 truncate flex-1">{session.user.email}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 z-40 backdrop-blur-md safe-bottom">
        <div className="flex items-stretch justify-around px-1 py-1">
          {primaryItems.map((item) => {
            const isActive = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors flex-1 min-w-0 ${
                  isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-[10px] font-medium truncate">{item.shortLabel}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors flex-1 min-w-0 ${
              moreMenuOpen || secondaryItems.some((i) => i.view === view)
                ? 'text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <main className="lg:ml-60 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen overflow-x-hidden">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Loading market data...</p>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
