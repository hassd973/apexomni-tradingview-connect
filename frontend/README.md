ICE KING 🌍🧊👑 Trading Dashboard
A static website displaying low-volume tokens from multiple sources and real-time TradingView alerts from the ICE KING V28.1.7 strategy. Built with HTML, JavaScript, and Tailwind CSS.
Integration

Verify Files:

Ensure frontend/ contains: index.html, script.js, package.json, tailwind.config.js, README.md.


Update WebSocket URL:

For internal testing, script.js uses wss://omni-trading-webhook:10000.
For production, deploy backend/ and update with the external URL (e.g., wss://apexomni-backend.onrender.com).


Install Dependencies:
cd frontend
npm install


Test Locally:
npm start


Opens http://localhost:3000.
Ensure omni-trading-webhook:10000 is accessible (see WebSocket Troubleshooting).



Deploy to Render

Add to Repository:

Commit and push:git add frontend/
git commit -m "Update ICE KING Trading Dashboard"
git push




Create a Static Site on Render:

Go to Render Dashboard > "New" > "Static Site".
Connect hassd973/apexomni-tradingview-connect.
Configure:
Root Directory: frontend
Build Command: npm install
Publish Directory: frontend
Start Command: npm start


Deploy and verify at the Render URL.


Deploy Backend (for WebSocket):

Create a Render Web Service for backend/.
Set:
Root Directory: backend
Build Command: npm install
Start Command: node app.js


Note the URL (e.g., https://apexomni-backend.onrender.com).
Update frontend/script.js with wss://apexomni-backend.onrender.com.



WebSocket Troubleshooting
If wss://omni-trading-webhook:10000 fails to connect:

Verify Backend:

Run locally:cd /path/to/apexomni-tradingview-connect/backend
npm install
node app.js


Ensure backend/app.js uses WebSocket (e.g., ws library) and listens on port 10000.
Test with a WebSocket client (e.g., Postman):{"type":"debug","event":"long_entry","market":"BTC-USDT","timestamp":"2025-05-08 14:00:00"}




Expose Internal Webhook:

Use ngrok:ngrok http 10000


Update script.js with ngrok URL (e.g., wss://abc123.ngrok.io).
Commit and push:git add frontend/script.js
git commit -m "Update WebSocket URL to ngrok"
git push






Check Logs:

Open browser DevTools (F12) > Console.
Look for errors like WebSocket error:, WebSocket closed: Code=, or Failed to initialize WebSocket:.
Share errors with support.


Protocol Mismatch:

If the backend uses HTTP, modify script.js for polling (consult backend docs).
Example HTTP polling (if needed):async function pollAlerts() {
  try {
    const response = await fetch('http://omni-trading-webhook:10000/alerts');
    const alert = await response.json();
    // Process alert as in ws.onmessage
  } catch (error) {
    console.error('Polling error:', error);
    setTimeout(pollAlerts, 5000);
  }
}





Features

Low-Volume Tokens:
Sources: CoinGecko, CoinMarketCap, CryptoCompare (volume < $5M).
Data: Name, symbol, 24h volume, price, 24h price change, market cap, circulating supply.
Emojis: 🍀 (token), 🤑 (positive price change), 🤮 (negative price change).


TradingView Alerts:
Real-time alerts from ICE KING V28.1.7 via omni-trading-webhook:10000 or deployed backend.
Emojis: 🚀 (long entry), 🧪 (short entry), 🧊 (filter_blocked), 🏁 (exit), 🛡️ (protect exit), ✅ (other).


Design: Sleek dark theme with Tailwind CSS, responsive dual-section layout.

Notes

WebSocket URL: Use wss://omni-trading-webhook:10000 for internal testing. Expose via ngrok or deploy backend/ for external access.
CoinMarketCap API: Configured with provided key. Monitor usage at https://coinmarketcap.com/api/.
CoinGecko/CryptoCompare: Free tiers may have rate limits.
Alerts: Limited to 20 recent alerts.
Compatibility: Ensure backend sends ICE KING V28.1.7 alerts (e.g., {"type":"debug","event":"long_entry",...}).

License
MIT
