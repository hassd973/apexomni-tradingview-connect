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
        backgroundColor: 'rgba(30, 58, 138, 0.8)',
        gridColor: 'rgba(255, 255, 255, 0.1)',
        enable_publishing: false,
        allow_symbol_change: true,
        studies: [
          'ICE KING🌍🧊👑 V27.18.10 - Debug@your-user-id',
        ],
        autosize: true,
        save_image: true,
        overrides: {
          "paneProperties.background": "rgba(30, 58, 138, 0.8)",
          "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.1)",
          "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.1)",
          "scalesProperties.lineColor": "rgba(255, 255, 255, 0.3)",
          "scalesProperties.textColor": "rgba(255, 255, 255, 0.8)",
          "mainSeriesProperties.candleStyle.upColor": "#00FF00",
          "mainSeriesProperties.candleStyle.downColor": "#FF0000",
          "mainSeriesProperties.candleStyle.borderUpColor": "#00FF00",
          "mainSeriesProperties.candleStyle.borderDownColor": "#FF0000",
          "mainSeriesProperties.candleStyle.wickUpColor": "rgba(255, 255, 255, 0.5)",
          "mainSeriesProperties.candleStyle.wickDownColor": "rgba(255, 255, 255, 0.5)",
        },
        studies_overrides: {
          "volume.volume.color.0": "rgba(255, 0, 0, 0.3)",
          "volume.volume.color.1": "rgba(0, 255, 0, 0.3)",
        },
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
