
import React, { useEffect, useState } from 'react';

export default function IceKingDashboard() {
  const [balance, setBalance] = useState(null);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    fetch('/balance')
      .then(res => res.json())
      .then(data => setBalance(data))
      .catch(err => console.error(err));

    fetch('/positions')
      .then(res => res.json())
      .then(data => setPositions(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ backgroundColor: '#001f3f', color: 'white', padding: '2rem', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', textAlign: 'center' }}>🌍🧊👑 ICE KING DASHBOARD</h1>
      <section>
        <h2>Balance</h2>
        <pre>{balance ? JSON.stringify(balance, null, 2) : 'Loading...'}</pre>
      </section>
      <section>
        <h2>Open Positions</h2>
        {positions.length > 0 ? (
          <ul>
            {positions.map((p, i) => (
              <li key={i}>
                {p.symbol} → {p.side} {p.size} @ {p.entryPrice}
              </li>
            ))}
          </ul>
        ) : <p>No open positions.</p>}
      </section>
    </div>
  );
}
