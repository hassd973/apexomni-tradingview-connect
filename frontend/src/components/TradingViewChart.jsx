
import React, { useEffect } from 'react'

export default function TradingViewChart() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = "https://s3.tradingview.com/tv.js"
    script.async = true
    script.onload = () => {
      new window.TradingView.widget({
        container_id: "tradingview_btc_chart",
        width: "100%",
        height: 500,
        symbol: "BINANCE:BTCUSDT",
        interval: "D",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#000",
        enable_publishing: false,
        hide_top_toolbar: true,
        allow_symbol_change: true,
        withdateranges: true,
      });
    };
    document.body.appendChild(script)
  }, [])

  return (
    <section>
      <h2>📈 Live BTC Chart (1D)</h2>
      <div id="tradingview_btc_chart" />
    </section>
  )
}
