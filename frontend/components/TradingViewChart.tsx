import { useEffect, useRef } from 'react';
import styles from './TradingViewChart.module.css';

const TradingViewChart = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          symbol: 'BTCUSDT',
          interval: '60',
          container_id: containerRef.current.id,
          autosize: true,
          theme: 'dark',
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <div id="tvchart" ref={containerRef} className={styles.chart} />;
};

export default TradingViewChart;
