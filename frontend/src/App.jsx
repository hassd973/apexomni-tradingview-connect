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
      const authUrl = 'https://omni-trading-webhook.onrender.com/auth/init';
      console.log('Initiating sign-in with URL:', authUrl);

      const response = await axios.get(authUrl, {
        params: {
          redirect_uri: window.location.href,
        },
      });

      console.log('Auth response:', response.data);

      if (response.data.authUrl) {
        console.log('Redirecting to TradingView login:', response.data.authUrl);
        window.location.href = response.data.authUrl;
      } else {
        throw new Error('Failed to initiate sign-in: No auth URL provided');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Sign-in failed. Please check the console for details.';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Sign-in error:', err);
    }
  };

  // Handle callback after TradingView login
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const token = urlParams.get('token');

    if (code) {
      // Exchange code for token
      const exchangeCodeForToken = async () => {
        try {
          const response = await axios.get('https://omni-trading-webhook.onrender.com/auth/callback', {
            params: { code },
          });
          const newToken = response.data.token;
          if (newToken) {
            localStorage.setItem('tradingview_token', newToken);
            setIsSignedIn(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            throw new Error('No token received after code exchange');
          }
        } catch (err) {
          setError('Failed to exchange code for token. Please try again.');
          console.error('Token exchange error:', err);
        } finally {
          setIsLoading(false);
        }
      };
      exchangeCodeForToken();
    } else if (token) {
      localStorage.setItem('tradingview_token', token);
      setIsSignedIn(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('tradingview_token');
    setIsSignedIn(false);
    setError(null);
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
