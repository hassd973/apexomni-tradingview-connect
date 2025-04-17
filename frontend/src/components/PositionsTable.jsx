
import React, { useEffect, useState } from 'react'

export default function PositionsTable() {
  const [positions, setPositions] = useState([])

  useEffect(() => {
    fetch('/positions')
      .then(res => res.json())
      .then(data => setPositions(data.openPositions))
      .catch(err => console.error('Positions fetch error:', err))
  }, [])

  return (
    <section>
      <h2>📊 Open Positions</h2>
      {positions.length > 0 ? (
        <table>
          <thead>
            <tr><th>Market</th><th>Side</th><th>Size</th><th>Entry Price</th></tr>
          </thead>
          <tbody>
            {positions.map((pos, idx) => (
              <tr key={idx}>
                <td>{pos.symbol}</td>
                <td>{pos.side}</td>
                <td>{pos.size}</td>
                <td>${parseFloat(pos.entryPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p>No open positions.</p>}
    </section>
  )
}
