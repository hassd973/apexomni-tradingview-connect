# ICE KING Dashboard 🌍🧊👑

A futuristic dashboard for monitoring your trading balance, open positions, and live BTC chart with TradingView integration.

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Backend API running at `http://localhost:5000`

## Setup
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd ice-king-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser.

## Features
- Transparent futuristic blue theme
- Displays balance and open positions
- Live BTC chart with TradingView integration
- Sign-in to access personal indicators
- Ice King emojis in the UI

## Backend API
Ensure your backend API is running and provides the following endpoints:
- `GET /api/balance`: Returns `{ balance: number }`
- `GET /api/positions`: Returns an array of positions like `[{ market: string, side: string, size: number, entryPrice: number }]`

## Notes
- Replace the TradingView studies in `Chart.jsx` with your personal indicators.
- Add your Ice King emojis/images in the `src/assets/` folder.
- Update the API URL in `Dashboard.jsx` if your backend runs on a different port.