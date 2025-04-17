import { useState } from 'react'
import IceKingDashboard from './components/IceKingDashboard.jsx'

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false)

  const handleSignIn = () => {
    // Simulate sign-in logic (replace with actual auth logic)
    setIsSignedIn(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">ICE KING Dashboard 🌍🧊👑</h1>
      {!isSignedIn ? (
        <button onClick={handleSignIn}>Sign In to Access Indicators</button>
      ) : (
        <IceKingDashboard />
      )}
    </div>
  )
}

export default App
