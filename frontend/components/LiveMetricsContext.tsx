import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface Metrics {
  totalEquityValue: number;
  availableBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  maintenanceMargin: number;
  initialMargin: number;
  totalRisk: number;
}

interface LiveMetricsContextValue {
  metrics: Metrics | null;
  error: string | null;
}

const LiveMetricsContext = createContext<LiveMetricsContextValue>({
  metrics: null,
  error: null,
});

export const LiveMetricsProvider = ({ children }: { children: ReactNode }) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const timestamp = Date.now().toString();
      const res = await fetch('https://omni.apex.exchange/api/v3/account-balance', {
        headers: {
          'APEX-SIGNATURE': process.env.NEXT_PUBLIC_APEX_SIGNATURE || '',
          'APEX-API-KEY': process.env.NEXT_PUBLIC_APEX_API_KEY || '',
          'APEX-TIMESTAMP': timestamp,
          'APEX-PASSPHRASE': process.env.NEXT_PUBLIC_APEX_PASSPHRASE || '',
        },
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }

      const data = await res.json();
      setMetrics({
        totalEquityValue: data.totalEquityValue,
        availableBalance: data.availableBalance,
        realizedPnl: data.realizedPnl,
        unrealizedPnl: data.unrealizedPnl,
        maintenanceMargin: data.maintenanceMargin,
        initialMargin: data.initialMargin,
        totalRisk: data.totalRisk,
      });
      setError(null);
    } catch (err) {
      setError('Live data failed to load');
    }
  };

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <LiveMetricsContext.Provider value={{ metrics, error }}>
      {children}
    </LiveMetricsContext.Provider>
  );
};

export const useLiveMetrics = () => useContext(LiveMetricsContext);

