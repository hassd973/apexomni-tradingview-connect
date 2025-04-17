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
        symbol: 'BTCUSD',
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#1e3a8a',
        enable_publishing: false,
        allow_symbol_change: true,
        studies: [
          'MASimple@tv-basicstudies', // Replace with your personal indicators
        ],
      })
    }

    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return <div id="tradingview_chart" ref={chartContainerRef}></div>
}
