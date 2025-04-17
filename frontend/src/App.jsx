import { useState, useEffect } from 'react'
import axios from 'axios'
import IceKingDashboard from './components/IceKingDashboard.jsx'

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Check if there's a stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('tradingview_token');
    if (storedToken) {
      setIsSignedIn(true);
    }
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Hypothetical: Use apexomni-tradingview-connect to initiate OAuth flow
      // This might redirect the user to TradingView's login page
      const response = await axios.get('https://your-apexomni-tradingview-connect-url/auth/init', {
        params: {
          redirect_uri: window.location.href, // Callback URL after login
        },
      });

      if (response.data.authUrl) {
        // Redirect user to TradingView's login page
        window.location.href = response.data.authUrl;
      } else {
        throw new Error('Failed to initiate sign-in');
      }
    } catch (err) {
      setError('Sign-in failed. Please try again.');
      setIsLoading(false);
      console.error('Sign-in error:', err);
    }
  };

  // Handle callback after TradingView login (if redirected back)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token'); // Hypothetical token from callback

    if (token) {
      localStorage.setItem('tradingview_token', token);
      setIsSignedIn(true);
      setIsLoading(false);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('tradingview_token');
    setIsSignedIn(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">ICE KING Dashboard 🌍🧊👑</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {!isSignedIn ? (
        <button onClick={handleSignIn} disabled={isLoading}>
          {isLoading ? 'Signing In...' : 'Sign In to TradingView'}
        </button>
      ) : (
        <>
          <button onClick={handleSignOut} className="mb-4">
            Sign Out
          </button>
          <IceKingDashboard />
        </>
      )}
    </div>
  )
}

export default App
