# ICE KING 🌍🧊👑 Trading Dashboard

A static website displaying low-volume tokens and real-time TradingView alerts from the ICE KING V28.1.7 strategy via Better Stack ClickHouse. Built with HTML, JavaScript, Tailwind CSS, and Chart.js.

## Integration

1. **Verify Files**:
   - Ensure `frontend/` contains: `index.html`, `script.js`, `styles.css`, `package.json`, `tailwind.config.js`, `README.md`.

2. **Configure Better Stack**:
   - `script.js` uses ClickHouse credentials (username: `ua439SvEJ8fzbFUfZLgfrngQ0hPAJWpeW`, password: `ACTAv2qyDnjVwEoeByXTZzY7LT0CBcT4Zd86AjYnE7fy6kPB5TYr4pjFqIfTjiPs`) for `t371838.ice_king_logs`.
   - Verify the table in Better Stack:
     - Go to Better Stack > Query > Run `SELECT * FROM t371838.ice_king_logs LIMIT 10`.
     - Ensure logs have `type='debug'` and JSON `message` fields.
     - If incorrect, update `script.js` query or table name.
     - Commit and push:
       ```bash
       git add frontend/script.js
       git commit -m "Update Better Stack query"
       git push
       ```

3. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

4. **Test Locally**:
   ```bash
   npm start
   ```
   - Opens `http://localhost:3000`.
   - Ensure Render’s observability forwards logs to `eu-nbg-2-connect.betterstackdata.com:443`.

## Deploy to Render

1. **Add to Repository**:
   - Commit and push:
     ```bash
     git add frontend/
     git commit -m "Update ICE KING Trading Dashboard with ClickHouse and UI"
     git push
     ```

2. **Trigger Deployment**:
   - Use the deploy hook:
     ```bash
     curl -X POST https://api.render.com/deploy/srv-cvnb26idbo4c73bhfjq0?key=kVx4mjdNEVc
     ```
   - **Security Note**: Keep the deploy hook URL secret.

3. **Verify Render Configuration**:
   - Go to [Render Dashboard](https://dashboard.render.com/) and ensure:
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install`
     - **Publish Directory**: `frontend`
     - **Start Command**: `npm start`
   - Update if incorrect and redeploy using the hook.

4. **Backend Logging**:
   - Ensure `backend/` logs `ICE KING V28.1.7` alerts in JSON format (e.g., `{"type":"debug","event":"long_entry",...}`).
   - Verify Render’s observability settings forward logs to Better Stack:
     - In Render, go to Web Service > Observability > Add Better Stack integration.
     - Configure with host `eu-nbg-2-connect.betterstackdata.com:443`.

## Better Stack Troubleshooting

If stuck at `Connecting to Better Stack...` or seeing errors:

1. **Check Debug Logs and Network Tab**:
   - Open DevTools (F12) > Console and Network tab.
   - **Console Errors**:
     - **Request timed out after 10000ms**: API is slow or unreachable. Check Network tab for `https://eu-nbg-2-connect.betterstackdata.com`.
     - **Failed to fetch**: Network error, CORS issue, or API unreachable. Look for:
       - **Status**: `Blocked`, `Failed`, or no response.
       - **Response**: Note error messages.
       - **Possible Causes**:
         - CORS restriction: API may not allow browser requests.
         - Network issue: Render IPs may be blocked.
         - Invalid credentials: Verify username/password.
         - Table issue: Verify `t371838.ice_king_logs`.
     - **HTTP 401 Unauthorized**: Invalid credentials. Verify username/password in Better Stack.
     - **HTTP 400 Bad Request**: Invalid query or table. Confirm `t371838.ice_king_logs` exists.
     - **HTTP 5xx Server Error**: Better Stack issue. Retry or contact support.
     - **No data field in response**: Empty logs or table issue. Check Better Stack.
     - **Invalid log message format**: `message` is not JSON. Inspect logs.
     - **No logs received**: No logs match `type='debug'`.
   - Share console and Network tab screenshots.

2. **Test the ClickHouse Query**:
   - Run:
     ```bash
     curl -u ua439SvEJ8fzbFUfZLgfrngQ0hPAJWpeW:ACTAv2qyDnjVwEoeByXTZzY7LT0CBcT4Zd86AjYnE7fy6kPB5TYr4pjFqIfTjiPs \
       -H 'Content-type: plain/text' \
       -X POST 'https://eu-nbg-2-connect.betterstackdata.com?output_format_pretty_row_numbers=0' \
       -d "SELECT * FROM t371838.ice_king_logs WHERE type = 'debug' ORDER BY timestamp DESC LIMIT 10"
     ```
   - If it fails with:
     - `401`: Regenerate credentials in Better Stack.
     - `400`: Verify table or query syntax.
     - No data: Check Better Stack for logs.

3. **Verify Better Stack Setup**:
   - Check Query dashboard for `t371838.ice_king_logs`.
   - Confirm logs are ingested via `eu-nbg-2-connect.betterstackdata.com:443`.

4. **Verify Log Format**:
   - Check a log’s `message` field in Better Stack.
   - Ensure it’s JSON (e.g., `{"type":"debug","event":"long_entry","market":"BTC-USDT","timestamp":"2025-05-08T14:00:00Z"}`).
   - If not, modify `backend/app.js` to log JSON.

5. **Check Firewall and CORS**:
   - Ensure Better Stack accepts Render IPs:
     - `44.226.145.213`
     - `54.187.200.255`
     - `34.213.214.55`
     - `35.164.95.156`
     - `44.230.95.183`
     - `44.229.200.200`
   - If CORS errors appear, contact Better Stack to confirm browser request support.

6. **Redeploy if Changes Made**:
   - Update files and redeploy:
     ```bash
     git add frontend/
     git commit -m "Update ClickHouse and UI"
     git push
     curl -X POST https://api.render.com/deploy/srv-cvnb26idbo4c73bhfjq0?key=kVx4mjdNEVc
     ```

## Features

- **Low-Volume Tokens**:
  - Sources: CoinGecko, CoinMarketCap, CryptoCompare (volume < $5M).
  - Sorted by 24h price change (toggle high-to-low/low-to-high).
  - Numeric score (0-100) based on 24h price change.
  - Gradient transparency (green to red based on price change).
  - Interactive 7-day price charts (USD) on click.
  - Top 5 USDT pairs suggested.
  - Data: Name, symbol, score, 24h volume, price, 24h price change, market cap, circulating supply.
  - Emojis: 🍀 (token), 🤑 (positive price change), 🤮 (negative price change).
- **TradingView Alerts**:
  - Real-time alerts from ICE KING V28.1.7 via Better Stack ClickHouse.
  - Emojis: 🚀 (long entry), 🧪 (short entry), 🧊 (filter_blocked), 🏁 (exit), 🛡️ (protect exit), ✅ (other).
- **Design**:
  - Sleek dark theme with transparent, blurred backgrounds.
  - Responsive for web and mobile (Tailwind CSS).
  - Visual hierarchy with large headers (`text-4xl`, `text-2xl`) and fitting text.
  - Custom scrollbar and chart styling.

## Notes

- **Better Stack**: Uses ClickHouse credentials for `t371838.ice_king_logs`. See https://betterstack.com/docs/logs/clickhouse/.
- **CoinMarketCap API**: Configured with provided key. Monitor usage at https://coinmarketcap.com/api/.
- **CoinGecko/CryptoCompare**: Free tiers may have rate limits.
- **Charts**: Powered by Chart.js and CoinGecko API.
- **Alerts**: Limited to 20 recent alerts.
- **Compatibility**: Ensure backend logs JSON alerts (e.g., `{"type":"debug","event":"long_entry",...}`).

## License

MIT
