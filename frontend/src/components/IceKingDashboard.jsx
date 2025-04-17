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
    fetchData() // Initial fetch
    const interval = setInterval(fetchData, 30000) // Poll every 30 seconds
    return () => clearInterval(interval) // Cleanup on unmount
  }, [])

  return (
    <div className="dashboard w-full max-w-4xl">
      {error && <p className="text-red-500">{error}</p>}
      <div className="card">
        <h2 className="text-2xl font-semibold">Balance</h2>
        <p className="text-3xl">${balance.toFixed(2)}</p>
      </div>

      <div className="card">
        <h2 className="text-2xl font-semibold">Open Positions</h2>
        {positions.length > 0 ? (
          positions.map((position, index) => (
            <div key={index} className="flex justify-between py-2 border-b border-gray-500">
              <span>{position.market}</span>
              <span>{position.side}</span>
              <span>{position.size} BTC</span>
              <span>${position.entryPrice.toFixed(2)}</span>
            </div>
          ))
        ) : (
          <p>No open positions.</p>
        )}
      </div>

      <div className="card">
        <h2 className="text-2xl font-semibold">Live BTC Chart (1D)</h2>
        <Chart />
      </div>
    </div>
  )
}

export default IceKingDashboard
