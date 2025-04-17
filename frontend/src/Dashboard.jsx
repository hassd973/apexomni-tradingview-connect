
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

export default function Dashboard() {
  const [balance, setBalance] = useState(null);
  const [positions, setPositions] = useState([]);
  const [btcPrice, setBtcPrice] = useState([]);

  useEffect(() => {
    fetch('/balance').then(res => res.json()).then(data => setBalance(data.totalEquityValue));
    fetch('/positions').then(res => res.json()).then(data => setPositions(data.positions));
    fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1')
      .then(res => res.json())
      .then(data => setBtcPrice(data.prices));
  }, []);

  const chartData = {
    labels: btcPrice.map(p => new Date(p[0]).toLocaleTimeString()),
    datasets: [{
      label: 'BTC/USD',
      data: btcPrice.map(p => p[1]),
      fill: true,
      backgroundColor: 'rgba(0, 191, 255, 0.1)',
      borderColor: '#00ffff',
      tension: 0.4,
    }],
  };

  return (
    <div>
      <h1>🧊 ICE KING DASHBOARD 👑</h1>
      <section>
        <h2>Balance</h2>
        <p>${balance || "Loading..."}</p>
      </section>
      <section>
        <h2>Open Positions</h2>
        {positions.length > 0 ? (
          <table>
            <thead>
              <tr><th>Market</th><th>Side</th><th>Size</th><th>Entry Price</th></tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i}><td>{p.symbol}</td><td>{p.side}</td><td>{p.size}</td><td>${p.entryPrice}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p>No open positions.</p>}
      </section>
      <section>
        <h2>Live BTC Chart (1 Day)</h2>
        <Line data={chartData} />
      </section>
    </div>
  );
}
