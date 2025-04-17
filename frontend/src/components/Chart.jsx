import { useEffect, useRef } from 'react'

const Chart = () => {
  const chartContainerRef = useRef(null)

  useEffect(() => {
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
        enable_publishing: false, // Set to true to enable features that may prompt sign-in
        allow_symbol_change: true,
        studies: [
          // Placeholder for Ice King indicator; user must sign in to load unpublished indicators
          // Replace with actual ID if known, e.g., 'IceKingIndicator@your-user-id'
        ],
        autosize: true,
        // Enable features that may require sign-in
        save_image: true, // This may prompt sign-in if the user isn't logged in
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

  return <div id="tradingview_chart" ref={chartContainerRef} style={{ height: '400px', width: '100%' }}></div>
}

export default Chart
