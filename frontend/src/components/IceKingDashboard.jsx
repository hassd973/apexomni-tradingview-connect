import { useState, useEffect } from 'react'
import axios from 'axios'
import Chart from './Chart.jsx'

const IceKingDashboard = () => {
  const [balance, setBalance] = useState(0)
  const [positions, setPositions] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('https://raw.githubusercontent.com/hassd973/apexomni-tradingview-connect/main/data/accountData.json')
        setBalance(response.data.balance || 0)
        setPositions(response.data.positions || [])
      } catch (error) {
        console.error('Error fetching data from GitHub:', error)
        setError('Failed to fetch account data from repository. Using mock data instead.')
        // Fallback to mock data
        setBalance(1000)
        setPositions([
          { market: 'BTCUSD', side: 'Long', size: 0.5, entryPrice: 60000 },
          { market: 'BTCUSD', side: 'Short', size: 0.3, entryPrice: 59000 },
        ])
      }
    }

    fetchData()
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
