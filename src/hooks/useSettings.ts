import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AppSettings } from '@/lib/types';

const DEFAULT_SETTINGS: Omit<AppSettings, 'id' | 'updated_at'> = {
  account_balance: 10000,
  risk_per_trade: 2,
  currency: 'USD',
  custom_setup_types: null,
  custom_confluences: null,
  trading_style: 'smc',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      setLoading(false);
      return;
    }

    if (!data) {
      const { data: newSettings, error: insertError } = await supabase
        .from('app_settings')
        .insert(DEFAULT_SETTINGS)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating settings:', insertError);
        setLoading(false);
        return;
      }
      setSettings(newSettings as AppSettings);
    } else {
      setSettings(data as AppSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Partial<Omit<AppSettings, 'id' | 'updated_at'>>) => {
    if (!settings) return false;

    const { error } = await supabase
      .from('app_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', settings.id);

    if (error) {
      console.error('Error updating settings:', error);
      return false;
    }
    await fetchSettings();
    return true;
  }, [settings, fetchSettings]);

  return { settings, loading, updateSettings };
}
