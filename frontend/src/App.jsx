
import React from 'react'
import BalanceCard from './components/BalanceCard'
import PositionsTable from './components/PositionsTable'
import TradingViewChart from './components/TradingViewChart'

export default function App() {
  return (
    <div className="dashboard">
      <h1>🌍🧊👑 ICE KING DASHBOARD</h1>
      <BalanceCard />
      <PositionsTable />
      <TradingViewChart />
    </div>
  )
}
