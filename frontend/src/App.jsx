import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import './App.css';

function App() {
  const [balance, setBalance] = useState(null);
  const [positions, setPositions] = useState([]);
  const [btcPrice, setBtcPrice] = useState([]);

  useEffect(() => {
    fetch('/balance')
      .then(res => res.json())
      .then(data => setBalance(data.totalEquityValue))
      .catch(err => console.error('Balance error:', err));

    fetch('/positions')
      .then(res => res.json())
      .then(data => setPositions(data.openPositions || []))
      .catch(err => console.error('Positions error:', err));

    fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1')
      .then(res => res.json())
      .then(data => setBtcPrice(data.prices))
      .catch(err => console.error('BTC price error:', err));
  }, []);

  const chartData = {
    labels: btcPrice.map(p => new Date(p[0]).toLocaleTimeString()),
    datasets: [
      {
        label: 'BTC/USD',
        data: btcPrice.map(p => p[1]),
        fill: true,
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        borderColor: '#00f0ff',
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="dashboard">
      <h1>🌍🧊👑 ICE KING Dashboard</h1>
      <div className="card">
        <h2>Balance</h2>
        <p>${balance ? parseFloat(balance).toFixed(2) : 'Loading...'}</p>
      </div>
      <div className="card">
        <h2>Open Positions</h2>
        <table>
          <thead>
            <tr><th>Market</th><th>Side</th><th>Size</th><th>Entry</th></tr>
          </thead>
          <tbody>
            {positions.length > 0 ? positions.map((pos, idx) => (
              <tr key={idx}>
                <td>{pos.symbol}</td>
                <td>{pos.side}</td>
                <td>{pos.size}</td>
                <td>${pos.entryPrice}</td>
              </tr>
            )) : <tr><td colSpan="4">No open positions.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Live BTC Chart (1 Day)</h2>
        <Line data={chartData} />
      </div>
    </div>
  );
}

export default App;
