import IceKingDashboard from './components/IceKingDashboard.jsx'

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center py-10">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-bold neon-text text-cyan-400">
          ICE KING Dashboard 🌍🧊👑
        </h1>
        <p className="text-lg text-gray-400 mt-2">
          Real-time trading insights for Apex Pro
        </p>
      </header>
      <IceKingDashboard />
    </div>
  )
}

export default App
