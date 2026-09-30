import { useState } from 'react';
import { Card, Input, Select, Button, Badge } from '@/components/ui';
import type { AppSettings, StrategyConfig, TimeframeKey, TradingStyle, TradeConfig } from '@/lib/types';
import { DEFAULT_STRATEGY } from '@/lib/signalEngine';
import { STYLE_PRESETS, getConfigFromSettings } from '@/lib/edgeAnalyzer';
import { Save, RotateCcw, Settings as SettingsIcon, Sliders, Plus, X, Tags } from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings | null;
  updateSettings: (updates: Partial<Omit<AppSettings, 'id' | 'updated_at'>>) => Promise<boolean>;
  strategy: StrategyConfig;
  onStrategyChange: (s: StrategyConfig) => void;
}

const STYLE_OPTIONS = Object.entries(STYLE_PRESETS).map(([value, preset]) => ({ value, label: preset.label }));

export function SettingsView({ settings, updateSettings, strategy, onStrategyChange }: SettingsViewProps) {
  const config: TradeConfig = getConfigFromSettings(settings || {});
  const [style, setStyle] = useState<TradingStyle>(settings?.trading_style || 'smc');
  const [setupTypes, setSetupTypes] = useState<string[]>(config.setupTypes);
  const [confluences, setConfluences] = useState<string[]>(config.confluences);
  const [newSetup, setNewSetup] = useState('');
  const [newConfluence, setNewConfluence] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleStyleChange = (newStyle: string) => {
    const s = newStyle as TradingStyle;
    setStyle(s);
    const preset = STYLE_PRESETS[s];
    if (preset) {
      setSetupTypes([...preset.setupTypes]);
      setConfluences([...preset.confluences]);
    }
  };

  const addSetupType = () => {
    const s = newSetup.trim();
    if (s && !setupTypes.includes(s)) {
      setSetupTypes([...setupTypes, s]);
      setNewSetup('');
    }
  };

  const removeSetupType = (s: string) => {
    setSetupTypes(setupTypes.filter((x) => x !== s));
  };

  const addConfluence = () => {
    const c = newConfluence.trim();
    if (c && !confluences.includes(c)) {
      setConfluences([...confluences, c]);
      setNewConfluence('');
    }
  };

  const removeConfluence = (c: string) => {
    setConfluences(confluences.filter((x) => x !== c));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateSettings({
      trading_style: style,
      custom_setup_types: setupTypes,
      custom_confluences: confluences,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetStrategy = () => {
    onStrategyChange(DEFAULT_STRATEGY);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Customize your trading style, labels, and SMC scanner parameters</p>
      </div>

      {/* Trading style & custom labels */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Tags className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-100">Trading Style & Labels</h2>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Choose a preset that matches your trading style, then customize the setup types and confluences to fit exactly how you trade.
          These labels appear in your journal, edge analysis, and pre-trade scorer.
        </p>

        <div className="mb-5">
          <Select
            label="Trading Style Preset"
            value={style}
            onChange={handleStyleChange}
            options={STYLE_OPTIONS}
          />
        </div>

        {/* Setup types */}
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 font-medium">Your Setup Types</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {setupTypes.map((s) => (
              <div key={s} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
                <span className="text-slate-200">{s}</span>
                <button onClick={() => removeSetupType(s)} className="text-slate-500 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newSetup} onChange={setNewSetup} placeholder="Add custom setup type..." className="flex-1" />
            <Button size="sm" variant="secondary" onClick={addSetupType} disabled={!newSetup.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        {/* Confluences */}
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 font-medium">Your Confluences</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {confluences.map((c) => (
              <div key={c} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
                <span className="text-slate-200">{c}</span>
                <button onClick={() => removeConfluence(c)} className="text-slate-500 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newConfluence} onChange={setNewConfluence} placeholder="Add custom confluence..." className="flex-1" />
            <Button size="sm" variant="secondary" onClick={addConfluence} disabled={!newConfluence.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Labels'}
          </Button>
          {saved && <Badge variant="success">Saved!</Badge>}
        </div>
      </Card>

      {/* SMC strategy parameters */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">SMC Scanner Parameters</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={resetStrategy} className="flex-shrink-0">
            <RotateCcw className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Reset</span>
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">4-Tier Timeframe Selection (Top-Down)</h3>
            <p className="text-xs text-slate-500 mb-3">HTF determines directional bias, MTF locates the POI, LTF confirms MSS/CHoCH, Entry TF finds inducement + valid OB near liquidity.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Select label="HTF (Bias)" value={strategy.htfTimeframe} onChange={(v) => onStrategyChange({ ...strategy, htfTimeframe: v as TimeframeKey })}
                options={[{ value: '1D', label: 'Daily' }, { value: '4h', label: '4 Hour' }, { value: '1h', label: '1 Hour' }]} />
              <Select label="MTF (POI)" value={strategy.mtfTimeframe} onChange={(v) => onStrategyChange({ ...strategy, mtfTimeframe: v as TimeframeKey })}
                options={[{ value: '1D', label: 'Daily' }, { value: '4h', label: '4 Hour' }, { value: '1h', label: '1 Hour' }]} />
              <Select label="LTF (MSS)" value={strategy.ltfTimeframe} onChange={(v) => onStrategyChange({ ...strategy, ltfTimeframe: v as TimeframeKey })}
                options={[{ value: '4h', label: '4 Hour' }, { value: '1h', label: '1 Hour' }, { value: '15m', label: '15 Min' }]} />
              <Select label="Entry TF" value={strategy.entryTimeframe} onChange={(v) => onStrategyChange({ ...strategy, entryTimeframe: v as TimeframeKey })}
                options={[{ value: '1h', label: '1 Hour' }, { value: '15m', label: '15 Min' }]} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Market Structure</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Input label="Swing Length" type="number" value={strategy.swingLength} onChange={(v) => onStrategyChange({ ...strategy, swingLength: +v })} />
              <div className="flex flex-col">
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">P/D Filter</label>
                <button onClick={() => onStrategyChange({ ...strategy, premiumDiscountOnly: !strategy.premiumDiscountOnly })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${strategy.premiumDiscountOnly ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {strategy.premiumDiscountOnly ? 'P/D Only' : 'Any Zone'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Order Blocks</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Input label="Min OB Strength (x avg)" type="number" step="0.1" value={strategy.minOrderBlockStrength} onChange={(v) => onStrategyChange({ ...strategy, minOrderBlockStrength: +v })} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Fair Value Gaps</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Input label="FVG Max Age (bars)" type="number" value={strategy.fvgMaxAge} onChange={(v) => onStrategyChange({ ...strategy, fvgMaxAge: +v })} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Liquidity</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Input label="Min Liquidity Touches" type="number" value={strategy.liquidityMinTouches} onChange={(v) => onStrategyChange({ ...strategy, liquidityMinTouches: +v })} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Risk Management</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Input label="Min R:R Ratio" type="number" step="0.1" value={strategy.riskRewardMin} onChange={(v) => onStrategyChange({ ...strategy, riskRewardMin: +v })} />
              <Input label="Min Confidence %" type="number" value={strategy.minConfidence} onChange={(v) => onStrategyChange({ ...strategy, minConfidence: +v })} />
              <Input label="ATR SL Multiplier" type="number" step="0.1" value={strategy.atrMultiplierSL} onChange={(v) => onStrategyChange({ ...strategy, atrMultiplierSL: +v })} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
