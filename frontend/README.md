ICE KING 🌍🧊👑 Trading Dashboard
A static website displaying low-volume tokens from CoinGecko and real-time TradingView alerts from the ICE KING V28.1.7 strategy. Built with HTML, JavaScript, and Tailwind CSS.
Integration

Extract the Zip:

Unzip ice-king-trading-dashboard.zip into your front-end folder (e.g., apexomni-tradingview-connect/frontend/).
Files: index.html, script.js, package.json, tailwind.config.js, README.md.


Update WebSocket URL:

Edit script.js and replace wss://your-websocket-server with the actual WebSocket URL from the apexomni-tradingview-connect repository.


Install Dependencies (if deploying):
npm install


Test Locally:
npm start


Opens http://localhost:3000.



Deploy to Render

Add to Repository:

Copy files to your apexomni-tradingview-connect front-end folder.
Commit and push:git add .
git commit -m "Add ICE KING Trading Dashboard"
git push




Create a Static Site on Render:

Go to Render Dashboard > "New" > "Static Site".
Connect your apexomni-tradingview-connect repository.
Set:
Root Directory: frontend (or your front-end folder name)
Build Command: npm install && npm run build
Publish Directory: frontend
Start Command: npm start




Deploy:

Trigger a deploy or set auto-deploy on push.



Features

Low-Volume Tokens:
Data: Name, symbol, 24h volume, price, 24h price change, market cap, circulating supply.
Emojis: 🍀 (token), 🤑 (positive price change), 🤮 (negative price change).


TradingView Alerts:
Real-time alerts from ICE KING V28.1.7.
Emojis: 🚀 (long entry), 🧪 (short entry), 🧊 (filter_blocked), 🏁 (exit), 🛡️ (protect exit), ✅ (other).


Design: Sleek dark theme with Tailwind CSS, responsive dual-section layout.

Notes

WebSocket URL: Replace wss://your-websocket-server in script.js with the actual URL from apexomni-tradingview-connect.
CoinGecko API: Rate-limited. Consider a paid plan for high-frequency updates.
Alerts: Limited to 20 recent alerts to prevent UI clutter.
Compatibility: Ensure the WebSocket server sends alerts in the format expected by ICE KING V28.1.7 (e.g., {"type":"debug","event":"long_entry",...}).

License
MIT
