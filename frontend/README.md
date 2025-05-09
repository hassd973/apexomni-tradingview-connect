ICE KING 🌍🧊👑 Trading Dashboard
A static website displaying low-volume tokens and real-time TradingView alerts from the ICE KING V28.1.7 strategy via Better Stack Live Tail. Built with HTML, JavaScript, Tailwind CSS, and Chart.js.
Integration

Verify Files:

Ensure frontend/ contains: index.html, script.js, styles.css, package.json, tailwind.config.js, README.md.


Configure Better Stack:

script.js uses the source token (x5nvK7DNDURcpAHEBuCbHrza) and numeric source_ids (1303816) for the ice_king source.
Verify the source_ids in Better Stack:
Go to Better Stack > Sources > Select ice_king.
Confirm the numeric ID is 1303816 (from URL https://telemetry.betterstack.com/team/371838/tail?s=1303816).
If incorrect, update frontend/script.js:const BETTERSTACK_SOURCE_IDS = 'YOUR_CORRECT_NUMERIC_SOURCE_ID';


Commit and push:git add frontend/script.js
git commit -m "Update Better Stack source ID"
git push






Install Dependencies:
cd frontend
npm install


Test Locally:
npm start


Opens http://localhost:3000.
Ensure Render’s observability is forwarding logs to Better Stack via eu-nbg-2-vec.betterstackdata.com.



Deploy to Render

Add to Repository:

Commit and push:git add frontend/
git commit -m "Update ICE KING Trading Dashboard with UI enhancements"
git push




Trigger Deployment:

Use the deploy hook:curl -X POST https://api.render.com/deploy/srv-cvnb26idbo4c73bhfjq0?key=kVx4mjdNEVc


Security Note: Keep the deploy hook URL secret.


Verify Render Configuration:

Go to Render Dashboard and ensure:
Root Directory: frontend
Build Command: npm install
Publish Directory: frontend
Start Command: npm start


Update if incorrect and redeploy using the hook.


Backend Logging:

Ensure backend/ logs ICE KING V28.1.7 alerts in JSON format (e.g., {"type":"debug","event":"long_entry",...}).
Verify Render’s observability settings forward logs to Better Stack:
In Render, go to your Web Service > Observability > Add Better Stack integration.
Configure with the source token (x5nvK7DNDURcpAHEBuCbHrza).





Better Stack Live Tail Troubleshooting
If stuck at Connecting to Better Stack Live Tail... or seeing errors:

Check Debug Logs and Network Tab:

Open browser DevTools (F12) > Console and Network tab.
Console Errors:
Request timed out after 10000ms: API is slow or unreachable. Check Network tab for the request to https://telemetry.betterstack.com/api/v2/query/live-tail.
Failed to fetch: Network error, CORS issue, or API unreachable. Look for:
Status: Blocked, Failed, or no response (CORS or network issue).
Response: Note any error messages.
Possible Causes (logged in console):
CORS restriction: Better Stack API may not allow browser requests.
Network issue: Render IPs may be blocked or API is down.
Invalid URL or token: Verify BETTERSTACK_LIVE_TAIL_API and token.




HTTP 401 Unauthorized: Invalid BETTERSTACK_TOKEN. Verify x5nvK7DNDURcpAHEBuCbHrza in Better Stack > Sources > ice_king.
HTTP 400 Bad Request: Invalid source_ids (1303816) or query. Confirm ID in Better Stack > Sources > ice_king.
HTTP 5xx Server Error: Better Stack API issue. Wait and retry or contact support.
No data field in response: API format changed or no logs. Check Better Stack dashboard.
Invalid log message format: Log message is not JSON. Inspect logs in Better Stack.
No logs received: No logs match type=debug or no new logs.


Share console and Network tab screenshots with support.


Test the Live Tail API:

Run:curl -L -H "Authorization: Bearer x5nvK7DNDURcpAHEBuCbHrza" \
  --data-urlencode "source_ids=1303816" \
  --data-urlencode "query=type=debug" \
  "https://telemetry.betterstack.com/api/v2/query/live-tail"


If it fails with:
401: Regenerate token in Better Stack > Sources > ice_king.
400: Verify 1303816 or try query=*.
No data: Check Better Stack dashboard for logs.




Verify Better Stack Setup:

Check Logs dashboard for ice_king logs (source_id: 1303816).
Confirm logs are ingested via eu-nbg-2-vec.betterstackdata.com.


Verify Log Format:

Check a recent log’s message field in Better Stack.
Ensure it’s JSON (e.g., {"type":"debug","event":"long_entry","market":"BTC-USDT","timestamp":"2025-05-08T14:00:00Z"}).
If not, modify backend/app.js to log JSON.


Check Firewall and CORS:

Ensure Better Stack accepts Render IPs:
44.226.145.213
54.187.200.255
34.213.214.55
35.164.95.156
44.230.95.183
44.229.200.200


If Network tab shows CORS errors, contact Better Stack support to confirm browser request support.


Redeploy if Changes Made:

Update files and redeploy:git add frontend/
git commit -m "Update UI and Better Stack debugging"
git push
curl -X POST https://api.render.com/deploy/srv-cvnb26idbo4c73bhfjq0?key=kVx4mjdNEVc





Features

Low-Volume Tokens:
Sources: CoinGecko, CoinMarketCap, CryptoCompare (volume < $5M).
Sorted by 24h price change (toggle high-to-low/low-to-high).
Gradient transparency (green to red based on price change).
Interactive price charts (7-day USD price movement) on click.
Top 5 USDT pairs suggested.
Data: Name, symbol, 24h volume, price, 24h price change, market cap, circulating supply.
Emojis: 🍀 (token), 🤑 (positive price change), 🤮 (negative price change).


TradingView Alerts:
Real-time alerts from ICE KING V28.1.7 via Better Stack Live Tail API.
Emojis: 🚀 (long entry), 🧪 (short entry), 🧊 (filter_blocked), 🏁 (exit), 🛡️ (protect exit), ✅ (other).


Design:
Sleek dark theme with transparent, blurred backgrounds.
Responsive for web and mobile (Tailwind CSS).
Visual hierarchy with large headers (text-4xl, text-2xl) and fitting text.
Custom scrollbar and chart styling.



Notes

Better Stack: Uses source token (x5nvK7DNDURcpAHEBuCbHrza) and source_ids (1303816) for ice_king. See https://betterstack.com/docs/logs/api/.
CoinMarketCap API: Configured with provided key. Monitor usage at https://coinmarketcap.com/api/.
CoinGecko/CryptoCompare: Free tiers may have rate limits.
Charts: Powered by Chart.js and CoinGecko API.
Alerts: Limited to 20 recent alerts.
Compatibility: Ensure backend logs JSON alerts (e.g., {"type":"debug","event":"long_entry",...}).

License
MIT
