import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Trade } from '@/lib/types';

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('opened_at', { ascending: false });

    if (error) {
      console.error('Error fetching trades:', error);
      setTrades([]);
      setLoading(false);
      return;
    }
    setTrades((data || []) as Trade[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const addTrade = useCallback(async (trade: Omit<Trade, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('trades')
      .insert(trade)
      .select()
      .single();

    if (error) {
      console.error('Error adding trade:', error);
      return null;
    }
    await fetchTrades();
    return data as Trade;
  }, [fetchTrades]);

  const updateTrade = useCallback(async (id: string, updates: Partial<Trade>) => {
    const { error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating trade:', error);
      return false;
    }
    await fetchTrades();
    return true;
  }, [fetchTrades]);

  const closeTrade = useCallback(async (id: string, exitPrice: number, pipsResult: number, profitLoss: number) => {
    const { error } = await supabase
      .from('trades')
      .update({
        status: 'closed',
        exit_price: exitPrice,
        pips_result: pipsResult,
        profit_loss: profitLoss,
        closed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error closing trade:', error);
      return false;
    }
    await fetchTrades();
    return true;
  }, [fetchTrades]);

  const deleteTrade = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting trade:', error);
      return false;
    }
    await fetchTrades();
    return true;
  }, [fetchTrades]);

  return { trades, loading, addTrade, updateTrade, closeTrade, deleteTrade, refetch: fetchTrades };
}
