import { useState, useEffect, useCallback, useRef } from 'react';
import type { PairData } from '@/lib/types';
import { fetchLivePairs, generateSimulatedPairs } from '@/lib/forex';

export function useForexData(refreshInterval: number = 30000) {
  const [pairs, setPairs] = useState<PairData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hasDataRef = useRef(false);

  const refresh = useCallback(async (silent: boolean = false) => {
    if (silent) setRefreshing(true);

    try {
      const liveRequest = fetchLivePairs('1h', '5d');
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Live data request timed out')), 10000);
      });
      const { pairs: livePairs } = await Promise.race([liveRequest, timeout]);

      if (livePairs.length === 0) throw new Error('No live data');
      if (!mountedRef.current) return;

      hasDataRef.current = true;
      setPairs(livePairs);
      setIsLive(true);
      setError(null);
      setLastUpdate(Date.now());
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;

      if (!hasDataRef.current) {
        const simPairs = generateSimulatedPairs();
        hasDataRef.current = true;
        setPairs(simPairs);
        setIsLive(false);
        setError(err instanceof Error ? err.message : 'Live data unavailable, using simulation');
        setLastUpdate(Date.now());
        setLoading(false);
      }
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let fallbackTimer: number | undefined;

    const showFastFallback = () => {
      if (!mountedRef.current || hasDataRef.current) return;
      hasDataRef.current = true;
      setPairs(generateSimulatedPairs());
      setIsLive(false);
      setError('Live data is still loading, showing simulated market data');
      setLastUpdate(Date.now());
      setLoading(false);
    };

    fallbackTimer = window.setTimeout(showFastFallback, 1500);
    refresh(false).finally(() => {
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    });

    const interval = window.setInterval(() => refresh(true), refreshInterval);
    return () => {
      mountedRef.current = false;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      window.clearInterval(interval);
    };
  }, [refresh, refreshInterval]);

  return { pairs, loading, refreshing, lastUpdate, refresh, isLive, error };
}
