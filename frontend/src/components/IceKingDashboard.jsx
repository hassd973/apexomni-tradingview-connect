import { useState, useEffect } from 'react'
import axios from 'axios'
import Chart from './Chart.jsx'

const IceKingDashboard = () => {
  const [balance, setBalance] = useState(0)
  const [positions, setPositions] = useState([])
  const [error, setError] = useState(null)

  const fetchData = async () => {
    try {
      const balanceRes = await axios.get('/api/balance')
      setBalance(balanceRes.data.balance || 0)

      const positionsRes = await axios.get('/api/positions')
      setPositions(positionsRes.data || [])
      setError(null)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to fetch account data.')
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="dashboard w-full max-w-5xl space-y-8">
      {error && <p className="text-red-400 text-center">{error}</p>}
      <div className="card neon-border">
        <h2 className="text-2xl font-semibold text-cyan-300">Balance</h2>
        <p className="text-4xl mt-2 text-white">${balance.toFixed(2)}</p>
      </div>

      <div className="card neon-border">
        <h2 className="text-2xl font-semibold text-cyan-300">Open Positions</h2>
        {positions.length > 0 ? (
          <div className="mt-4 space-y-3">
            {positions.map((position, index) => (
              <div
                key={index}
                className="flex justify-between py-2 border-b border-gray-700 text-gray-300"
              >
                <span>{position.market}</span>
                <span className={position.side === 'Long' ? 'text-green-400' : 'text-red-400'}>
                  {position.side}
                </span>
                <span>{position.size} BTC</span>
                <span>${position.entryPrice.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 mt-2">No open positions.</p>
        )}
      </div>

      <div className="card neon-border">
        <h2 className="text-2xl font-semibold text-cyan-300">Live BTC Chart (1D)</h2>
        <div className="mt-4">
          <Chart />
        </div>
      </div>
    </div>
  )
}

export default IceKingDashboard
