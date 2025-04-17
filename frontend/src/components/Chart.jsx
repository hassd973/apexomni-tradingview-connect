const Chart = () => {
  return (
    <div>
      <p className="text-white mb-2">
        Please <a href="https://www.tradingview.com/u/#login" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">sign in to TradingView</a> in a new tab to view the chart with your Ice King indicator.
      </p>
      <iframe
        src="https://www.tradingview.com/chart/H29LcEay/?symbol=BITSTAMP%3ABTCUSD&utm_source=ice-king-dashboard-tm4b.onrender.com&utm_medium=widget&utm_campaign=chart-logo&utm_term=BITSTAMP%3ABTCUSD"
        width="100%"
        height="400"
        frameBorder="0"
        allowTransparency="true"
        scrolling="no"
        title="TradingView Chart"
      />
    </div>
  )
}

export default Chart
