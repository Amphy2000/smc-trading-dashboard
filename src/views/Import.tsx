import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { getPipSize } from '@/lib/forex';
import { getSessionFromTime, getDayOfWeek } from '@/lib/edgeAnalyzer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Upload, FileText, CheckCircle2, AlertCircle, X,
  TrendingUp, TrendingDown, Info,
  RefreshCw, BookOpen,
  Link2, Unlink, Lock, Shield, Loader2, Wifi, Eye, EyeOff,
} from 'lucide-react';

interface ParsedTrade {
  pair: string;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number;
  pips_result: number | null;
  profit_loss: number | null;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  session: string;
  day_of_week: number;
  planned_rr: number | null;
}

interface ImportProps {
  refetchTrades: () => Promise<void>;
  onOpenJournal: () => void;
}

function cleanCell(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function parseReportDate(value: string): Date {
  return new Date(value.trim().replace(/\./g, '-'));
}

function buildTrade(cols: string[], header: string[]): ParsedTrade | null {
  const index = (name: string) => header.indexOf(name);
  const symbolIndex = index('symbol');
  const openPriceIndex = index('open_price');
  const openTimeIndex = index('open_time');
  if (symbolIndex < 0 || openPriceIndex < 0 || openTimeIndex < 0) return null;

  const pair = cols[symbolIndex]?.trim();
  const openPrice = parseFloat(cols[openPriceIndex]);
  const openDate = parseReportDate(cols[openTimeIndex] || '');
  if (!pair || !openPrice || isNaN(openDate.getTime())) return null;

  const value = (name: string): string => {
    const position = index(name);
    return position >= 0 ? (cols[position] || '').trim() : '';
  };

  const direction = value('type').toLowerCase().includes('sell') ? 'SELL' : 'BUY';
  const closePriceValue = parseFloat(value('close_price'));
  const closeTimeValue = value('close_time');
  const closeDate = closeTimeValue ? parseReportDate(closeTimeValue) : null;
  const hasClose = closeDate !== null && !isNaN(closeDate.getTime()) && !isNaN(closePriceValue);
  const pipSize = getPipSize(pair);
  const pipsResult = hasClose
    ? direction === 'BUY'
      ? (closePriceValue - openPrice) / pipSize
      : (openPrice - closePriceValue) / pipSize
    : null;
  const stopLoss = parseFloat(value('sl'));
  const takeProfit = parseFloat(value('tp'));
  const riskPips = !isNaN(stopLoss) ? Math.abs(openPrice - stopLoss) / pipSize : 0;
  const rewardPips = !isNaN(takeProfit) ? Math.abs(takeProfit - openPrice) / pipSize : 0;

  return {
    pair,
    direction,
    entry_price: openPrice,
    exit_price: hasClose ? closePriceValue : null,
    stop_loss: !isNaN(stopLoss) ? stopLoss : null,
    take_profit: !isNaN(takeProfit) ? takeProfit : null,
    lot_size: parseFloat(value('volume')) || 0.01,
    pips_result: pipsResult,
    profit_loss: parseFloat(value('profit')) || null,
    opened_at: openDate.toISOString(),
    closed_at: hasClose ? closeDate?.toISOString() || null : null,
    status: hasClose ? 'closed' : 'open',
    session: getSessionFromTime(openDate),
    day_of_week: getDayOfWeek(openDate),
    planned_rr: riskPips > 0 ? rewardPips / riskPips : null,
  };
}

function parseDelimitedReport(text: string): ParsedTrade[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(delimiter).map((cell) => cell.trim().toLowerCase().replace(/ /g, '_'));
  return lines.slice(1)
    .map((line) => buildTrade(line.split(delimiter), header))
    .filter((trade): trade is ParsedTrade => trade !== null);
}

function parseHtmlReport(text: string): ParsedTrade[] {
  const document = new DOMParser().parseFromString(text, 'text/html');
  const rows = Array.from(document.querySelectorAll('tr'))
    .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cleanCell(cell.innerHTML)))
    .filter((row) => row.length > 0);
  const headerRow = rows.findIndex((row) => row.some((cell) => cell.toLowerCase() === 'symbol') && row.some((cell) => cell.toLowerCase().replace(/ /g, '_') === 'open_price'));
  if (headerRow < 0) return [];
  const header = rows[headerRow].map((cell) => cell.toLowerCase().replace(/ /g, '_'));
  return rows.slice(headerRow + 1)
    .map((row) => buildTrade(row, header))
    .filter((trade): trade is ParsedTrade => trade !== null);
}

function parseMt5Report(text: string, fileName: string): ParsedTrade[] {
  return fileName.toLowerCase().endsWith('.html') || text.includes('<table')
    ? parseHtmlReport(text)
    : parseDelimitedReport(text);
}

type SyncMode = 'broker' | 'csv' | 'manual';

interface BrokerPreset {
  name: string;
  servers: string[];
}

const BROKER_PRESETS: BrokerPreset[] = [
  { name: 'FundedNext', servers: ['FundedNext-Server', 'FundedNext-Server 2', 'FundedNext-Server 3'] },
  { name: 'IC Markets', servers: ['ICMarketsSC-Demo', 'ICMarketsSC-Live01', 'ICMarketsSC-Live02', 'ICMarketsSC-Live03', 'ICMarketsSC-Live04', 'ICMarketsSC-Live05', 'ICMarketsSC-Live06', 'ICMarketsSC-Live07', 'ICMarketsSC-Live08', 'ICMarketsSC-Live09', 'ICMarketsSC-Live10', 'ICMarketsSC-Live11', 'ICMarketsSC-Live12', 'ICMarketsSC-Live13', 'ICMarketsSC-Live14', 'ICMarketsSC-Live15', 'ICMarketsSC-Live16', 'ICMarketsSC-Live17', 'ICMarketsSC-Live18', 'ICMarketsSC-Live19', 'ICMarketsSC-Live20'] },
  { name: 'Exness', servers: ['Exness-Real', 'Exness-Demo', 'Exness-Real1', 'Exness-Real2', 'Exness-Real3', 'Exness-Real4', 'Exness-Real5', 'Exness-Real6', 'Exness-Real7', 'Exness-Real8', 'Exness-Real9', 'Exness-Real10'] },
  { name: 'FTMO', servers: ['FTMO-Server', 'FTMO-Server2', 'FTMO-Server3'] },
  { name: 'Pepperstone', servers: ['Pepperstone-Edge', 'Pepperstone-Edge 2', 'Pepperstone-Edge 3', 'Pepperstone-Edge 4', 'Pepperstone-Edge 5'] },
  { name: 'FBS', servers: ['FBS-Server', 'FBS-Server-Real', 'FBS-Server-Demo'] },
  { name: 'OANDA', servers: ['OANDA-Live', 'OANDA-Demo', 'OANDA-Live-1', 'OANDA-Live-2', 'OANDA-Live-3'] },
  { name: 'RoboForex', servers: ['RoboForex-ECN', 'RoboForex-Pro', 'RoboForex-Real', 'RoboForex-Demo'] },
  { name: 'XM', servers: ['XM-Real', 'XM-Demo', 'XM-Real-1', 'XM-Real-2', 'XM-Real-3', 'XM-Real-4', 'XM-Real-5', 'XM-Real-6', 'XM-Real-7', 'XM-Real-8', 'XM-Real-9', 'XM-Real-10'] },
  { name: 'Other / Custom', servers: [] },
];

interface BrokerConnection {
  id: string;
  status: string;
  login: string;
  server: string;
  broker_name: string;
  last_sync_at: string;
  last_error: string;
}

export function Import({ refetchTrades, onOpenJournal }: ImportProps) {
  const { session } = useAuth();
  const [mode, setMode] = useState<SyncMode>('broker');
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [brokerConnection, setBrokerConnection] = useState<BrokerConnection | null>(null);
  const [connectForm, setConnectForm] = useState({ login: '', password: '', server: '', platform: 'mt5' });
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const invokeEdgeFn = useCallback(async (body: Record<string, unknown>) => {
    const sbUrl = 'https://crvmktuwdamkavssrysv.supabase.co';
    const sbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm1rdHV3ZGFta2F2c3NyeXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NDU0MTUsImV4cCI6MjEwNjAyMTQxNX0.yAWaQENxqy_rFIDzqQ3IoRiGcos_vVikxAY0qSqtd68';
    const res = await fetch(`${sbUrl}/functions/v1/metaapi-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sbKey}`,
      },
      body: JSON.stringify({ ...body, userToken: session?.access_token || '' }),
    });
    const json = await res.json().catch(() => ({ error: 'Invalid response from server' }));
    if (!res.ok) throw new Error(json.error || `Server error (${res.status})`);
    return json;
  }, [session?.access_token]);

  const fetchBrokerStatus = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await invokeEdgeFn({ action: 'status' });
      if (data.connected) {
        setBrokerConnection({
          id: data.connectionId,
          status: data.status,
          login: data.login,
          server: data.server,
          broker_name: data.broker_name,
          last_sync_at: data.last_sync_at,
          last_error: data.last_error,
        });
      } else {
        setBrokerConnection(null);
      }
    } catch {
      // ignore
    }
  }, [invokeEdgeFn]);

  useEffect(() => {
    fetchBrokerStatus();
  }, [fetchBrokerStatus]);

  useEffect(() => {
    if (brokerConnection?.status === 'deploying' && pollCount < 20) {
      const timer = setTimeout(() => {
        fetchBrokerStatus();
        setPollCount((c) => c + 1);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [brokerConnection?.status, pollCount, fetchBrokerStatus]);

  useEffect(() => {
    if (brokerConnection?.status !== 'deploying') setPollCount(0);
  }, [brokerConnection?.status]);

  const handleConnectBroker = useCallback(async () => {
    if (!connectForm.login || !connectForm.password || !connectForm.server) {
      setError('Please fill in all fields');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      await invokeEdgeFn({
        action: 'connect',
        login: connectForm.login,
        password: connectForm.password,
        server: connectForm.server,
        platform: connectForm.platform,
      });
      setPollCount(0);
      await fetchBrokerStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
    } finally {
      setConnecting(false);
    }
  }, [connectForm, invokeEdgeFn, fetchBrokerStatus]);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await invokeEdgeFn({ action: 'sync' });
      await fetchBrokerStatus();
      await refetchTrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }, [invokeEdgeFn, fetchBrokerStatus, refetchTrades]);

  const handleDisconnect = useCallback(async () => {
    try {
      await invokeEdgeFn({ action: 'disconnect' });
      setBrokerConnection(null);
    } catch {
      // ignore
    }
  }, [invokeEdgeFn]);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setImported(0);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        setError('The file could not be read.');
        return;
      }
      const trades = parseMt5Report(text, file.name);
      if (trades.length === 0) {
        setError('No trades were found. Upload an MT5 HTML report or a tab-separated Account History export.');
        return;
      }
      setParsedTrades(trades);
    };
    reader.onerror = () => setError('The file could not be read.');
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (parsedTrades.length === 0) return;
    setImporting(true);
    setError(null);
    let successCount = 0;
    for (const trade of parsedTrades) {
      const { error: insertError } = await supabase.from('trades').insert({
        pair: trade.pair,
        direction: trade.direction,
        status: trade.status,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        lot_size: trade.lot_size,
        pips_result: trade.pips_result,
        profit_loss: trade.profit_loss,
        notes: 'Imported from MT5',
        opened_at: trade.opened_at,
        closed_at: trade.closed_at,
        session: trade.session,
        confidence_level: 5,
        mental_state: 'neutral',
        confluences: [],
        planned_rr: trade.planned_rr,
        day_of_week: trade.day_of_week,
      });
      if (!insertError) successCount++;
    }
    setImporting(false);
    setImported(successCount);
    setParsedTrades([]);
    await refetchTrades();
    if (successCount === 0) setError('The trades could not be imported. Please try again while signed in.');
  }, [parsedTrades, refetchTrades]);

  const wins = parsedTrades.filter((t) => (t.pips_result || 0) > 0).length;
  const losses = parsedTrades.filter((t) => (t.pips_result || 0) < 0).length;
  const totalPips = parsedTrades.reduce((sum, t) => sum + (t.pips_result || 0), 0);

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Wifi }> = {
    active: { label: 'Connected & Syncing', color: 'text-green-400', icon: Wifi },
    deploying: { label: 'Connecting...', color: 'text-yellow-400', icon: Loader2 },
    syncing: { label: 'Syncing trades...', color: 'text-blue-400', icon: RefreshCw },
    connected: { label: 'Connected', color: 'text-green-400', icon: Wifi },
    disconnected: { label: 'Disconnected', color: 'text-slate-400', icon: Unlink },
    error: { label: 'Error', color: 'text-red-400', icon: AlertCircle },
    connecting: { label: 'Connecting...', color: 'text-yellow-400', icon: Loader2 },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Import from MT5</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Connect your broker and trades sync automatically — or use other methods</p>
      </div>

      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
        <button onClick={() => setMode('broker')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${mode === 'broker' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <Link2 className="w-4 h-4" /> Connect Broker
        </button>
        <button onClick={() => setMode('csv')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${mode === 'csv' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <Upload className="w-4 h-4" /> Upload
        </button>
        <button onClick={() => setMode('manual')} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${mode === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <BookOpen className="w-4 h-4" /> Manual
        </button>
      </div>

      {mode === 'broker' && (
        <>
          {brokerConnection && brokerConnection.status !== 'disconnected' ? (
            <Card className="p-5 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${brokerConnection.status === 'active' ? 'bg-green-600/20' : 'bg-yellow-600/20'}`}>
                    {(() => {
                      const StatusIcon = statusConfig[brokerConnection.status]?.icon || Wifi;
                      return <StatusIcon className={`w-5 h-5 ${statusConfig[brokerConnection.status]?.color || 'text-slate-400'} ${brokerConnection.status === 'deploying' || brokerConnection.status === 'syncing' ? 'animate-spin' : ''}`} />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">{brokerConnection.broker_name || brokerConnection.server}</h3>
                    <p className="text-xs text-slate-500">Login: {brokerConnection.login} · {brokerConnection.server}</p>
                  </div>
                </div>
                <Badge variant={brokerConnection.status === 'active' ? 'success' : brokerConnection.status === 'error' ? 'danger' : 'warning'}>
                  {statusConfig[brokerConnection.status]?.label || brokerConnection.status}
                </Badge>
              </div>

              {brokerConnection.last_error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-400">{brokerConnection.last_error}</span>
                </div>
              )}

              {brokerConnection.last_sync_at && (
                <p className="text-xs text-slate-500 mb-4">
                  Last synced: {new Date(brokerConnection.last_sync_at).toLocaleString()}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleSyncNow} disabled={syncing || brokerConnection.status === 'deploying'}>
                  {syncing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Syncing...</> : <><RefreshCw className="w-4 h-4 mr-1.5" /> Sync Now</>}
                </Button>
                <Button variant="ghost" onClick={handleDisconnect} className="text-red-400 hover:text-red-300">
                  <Unlink className="w-4 h-4 mr-1.5" /> Disconnect
                </Button>
              </div>

              {brokerConnection.status === 'deploying' && (
                <div className="mt-4 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                  <span className="text-xs text-yellow-400">Connecting to your broker. This takes 1-2 minutes. The page will update automatically.</span>
                </div>
              )}
            </Card>
          ) : (
            <>
              <Card className="p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2.5 bg-blue-600/20 rounded-xl flex-shrink-0">
                    <Link2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-200 mb-1">Connect Your MT5 Broker</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Enter your MT5 login details. Trades sync automatically — no manual work required.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">MT5 Login Number</label>
                    <input
                      type="text"
                      value={connectForm.login}
                      onChange={(e) => setConnectForm({ ...connectForm, login: e.target.value })}
                      placeholder="e.g. 12345678"
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">MT5 Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={connectForm.password}
                        onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })}
                        placeholder="Your MT5 account password"
                        className="w-full px-3 py-2.5 pr-10 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                      />
                      <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Broker</label>
                    <select
                      value={selectedBroker}
                      onChange={(e) => {
                        const broker = BROKER_PRESETS.find((b) => b.name === e.target.value);
                        setSelectedBroker(e.target.value);
                        setConnectForm({ ...connectForm, server: broker && broker.servers.length > 0 ? broker.servers[0] : '' });
                      }}
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select your broker...</option>
                      {BROKER_PRESETS.map((b) => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Broker Server</label>
                    {selectedBroker === 'Other / Custom' || !selectedBroker ? (
                      <input
                        type="text"
                        value={connectForm.server}
                        onChange={(e) => setConnectForm({ ...connectForm, server: e.target.value })}
                        placeholder="e.g. ICMarkets-Live01, Exness-Real"
                        className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                      />
                    ) : (
                      <select
                        value={connectForm.server}
                        onChange={(e) => setConnectForm({ ...connectForm, server: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                      >
                        {BROKER_PRESETS.find((b) => b.name === selectedBroker)?.servers.map((srv) => (
                          <option key={srv} value={srv}>{srv}</option>
                        ))}
                      </select>
                    )}
                    <p className="text-[10px] text-slate-600 mt-1">Find this in MT5: Tools &gt; Options &gt; Server, or on your broker's email confirmation</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Platform</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConnectForm({ ...connectForm, platform: 'mt5' })}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${connectForm.platform === 'mt5' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                      >
                        MT5
                      </button>
                      <button
                        onClick={() => setConnectForm({ ...connectForm, platform: 'mt4' })}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${connectForm.platform === 'mt4' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                      >
                        MT4
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mt-4">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400">{error}</span>
                  </div>
                )}

                <Button onClick={handleConnectBroker} disabled={connecting} size="lg" className="w-full mt-4">
                  {connecting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Connecting...</> : <><Link2 className="w-4 h-4 mr-1.5" /> Connect Broker</>}
                </Button>

                <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-slate-600">
                  <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Encrypted</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Never stored in plain text</span>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {mode === 'csv' && (
        <>
          <Card className="p-5 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg flex-shrink-0">
                <Info className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">Upload MT5 Report</h3>
                <ol className="text-xs text-slate-400 space-y-1 leading-relaxed">
                  <li>1. Open MT5 Desktop &gt; Account History tab</li>
                  <li>2. Right-click any trade &gt; Save as Report</li>
                  <li>3. Save as .csv or .html file</li>
                  <li>4. Upload it below</li>
                </ol>
              </div>
            </div>
          </Card>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {imported > 0 && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-400">{imported} trades imported successfully.</span>
            </div>
          )}

          {parsedTrades.length === 0 ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'}`}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt,.html" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ''; }} />
              <Upload className={`w-11 h-11 mx-auto mb-4 ${dragOver ? 'text-blue-400' : 'text-slate-500'}`} />
              <p className="text-sm font-medium text-slate-300 mb-1">Tap to upload or drag and drop</p>
              <p className="text-xs text-slate-500">MT5 HTML report or tab-separated CSV</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Card className="p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-slate-400 uppercase">Trades</p><p className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">{parsedTrades.length}</p></Card>
                <Card className="p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-slate-400 uppercase">W / L</p><p className="text-xl sm:text-2xl font-bold mt-1"><span className="text-green-400">{wins}</span><span className="text-slate-600 mx-1">/</span><span className="text-red-400">{losses}</span></p></Card>
                <Card className="p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-slate-400 uppercase">Pips</p><p className={`text-xl sm:text-2xl font-bold mt-1 ${totalPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPips > 0 ? '+' : ''}{totalPips.toFixed(0)}</p></Card>
              </div>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><h3 className="text-sm font-semibold text-slate-300">Preview</h3></div>
                  <button onClick={() => setParsedTrades([])} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {parsedTrades.slice(0, 20).map((trade, index) => (
                    <div key={`${trade.pair}-${trade.opened_at}-${index}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/30 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {trade.direction === 'BUY' ? <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />}
                        <span className="text-sm text-slate-200 font-medium">{trade.pair}</span>
                        <Badge variant={trade.status === 'open' ? 'info' : 'neutral'}>{trade.status}</Badge>
                      </div>
                      <span className={`text-sm font-mono flex-shrink-0 ${(trade.pips_result || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{trade.pips_result === null ? '—' : `${trade.pips_result > 0 ? '+' : ''}${trade.pips_result.toFixed(1)}p`}</span>
                    </div>
                  ))}
                  {parsedTrades.length > 20 && <p className="text-xs text-slate-500 text-center pt-2">+ {parsedTrades.length - 20} more trades</p>}
                </div>
              </Card>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setParsedTrades([])}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing}>{importing ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />Importing...</> : <><CheckCircle2 className="w-4 h-4 mr-1" />Import {parsedTrades.length} Trades</>}</Button>
              </div>
            </>
          )}
        </>
      )}

      {mode === 'manual' && (
        <Card className="p-6 text-center">
          <div className="p-3 bg-blue-600/10 rounded-xl w-fit mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-200 mb-2">Quick Manual Entry</h3>
          <p className="text-sm text-slate-400 mb-4 leading-relaxed max-w-md mx-auto">
            The fastest way to log a trade from your phone. Just enter the pair, direction, entry price, and pips result — takes about 15 seconds per trade.
          </p>
          <Button onClick={onOpenJournal} size="lg">
            <BookOpen className="w-4 h-4 mr-1.5" /> Open Trade Journal
          </Button>
        </Card>
      )}
    </div>
  );
}
