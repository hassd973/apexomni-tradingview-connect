import { useEffect, useRef } from 'react'

const Chart = () => {
  const chartContainerRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('tradingview_token');
    if (!token) {
      console.error('No TradingView token found. Please sign in.');
      return;
    }

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true

    script.onload = () => {
      new window.TradingView.widget({
        container_id: chartContainerRef.current.id,
        width: '100%',
        height: 400,
        symbol: 'BITSTAMP:BTCUSD',
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#1e3a8a',
        enable_publishing: false,
        allow_symbol_change: true,
        studies: [
          // Replace with your Ice King indicator ID if known
          'IceKingIndicator@your-user-id', // Placeholder; get the actual ID from TradingView
        ],
        utm_source: 'ice-king-dashboard-tm4b.onrender.com',
        utm_medium: 'widget',
        utm_campaign: 'chart-logo',
        utm_term: 'BITSTAMP:BTCUSD',
      })
    }

    script.onerror = () => {
      console.error('Failed to load TradingView script');
    };

    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return <div id="tradingview_chart" ref={chartContainerRef}></div>
}

export default Chart
