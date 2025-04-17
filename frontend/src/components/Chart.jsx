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
        symbol: 'BITSTAMP:BTCUSD', // Match the symbol from the URL
        interval: 'D', // 1D timeframe, as in your screenshot
        timezone: 'Etc/UTC',
        theme: 'dark', // Match the dark theme from your screenshot
        style: '1', // Candlestick style, as seen in the screenshot
        locale: 'en',
        toolbar_bg: '#1e3a8a', // Futuristic blue theme
        enable_publishing: false,
        allow_symbol_change: true,
        studies: [
          'MASimple@tv-basicstudies', // Placeholder; replace with your personal indicators
        ],
        utm_source: 'ice-king-dashboard-tm4b.onrender.com',
        utm_medium: 'widget',
        utm_campaign: 'chart-logo',
        utm_term: 'BITSTAMP:BTCUSD',
      })
    }

    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return <div id="tradingview_chart" ref={chartContainerRef}></div>
}

export default Chart
