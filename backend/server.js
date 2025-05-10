const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
}));

// Simple in-memory throttle for API calls
const apiThrottle = {
  lastCall: 0,
  minInterval: 1200, // ~50 calls/min (60s / 50 = 1.2s)
  async wait() {
    const now = Date.now();
    const timeSinceLast = now - this.lastCall;
    if (timeSinceLast < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLast));
    }
    this.lastCall = Date.now();
  }
};

// Root Route
app.get('/', (req, res) => {
  res.json({ message: 'ApexOmni Backend Running', endpoints: ['/health', '/token-stats', '/logs'] });
});

// Token Stats Endpoint (Using CoinMarketCap)
app.get('/token-stats', async (req, res) => {
  try {
    await apiThrottle.wait();
    const symbols = req.query.symbols ? req.query.symbols.split(',') : ['BTC', 'ETH', 'BNB', 'FLOKI', 'SHIB', 'PEOPLE'];
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbols.join(',')}&convert=USD`;
    const response = await axios.get(url, {
      headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY }
    });
    const formattedData = Object.values(response.data.data).map(item => ({
      id: item.slug,
      name: item.name,
      symbol: item.symbol.toUpperCase(),
      total_volume: item.quote.USD.volume_24h || 0,
      current_price: item.quote.USD.price || 0,
      price_change_percentage_24h: item.quote.USD.percent_change_24h || 0,
      market_cap: item.quote.USD.market_cap || 0,
      circulating_supply: item.circulating_supply || 0,
      source: 'CoinMarketCap'
    }));
    res.json(formattedData);
  } catch (error) {
    console.error('[ERROR] Token Stats:', error.message, error.response?.data);
    res.status(500).json({ error: 'Failed to fetch token stats', details: error.message });
  }
});

// Logs Endpoint (Using Better Stack)
app.get('/logs', async (req, res) => {
  try {
    await apiThrottle.wait();
    const query = req.query.query || 'level=info';
    const batch = parseInt(req.query.batch) || 50;
    const sourceIds = '1303816'; // ice_king source ID
    const url = `https://telemetry.betterstack.com/api/v2/query/live-tail?source_ids=${sourceIds}&query=${encodeURIComponent(query)}&batch=${batch}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.BETTER_STACK_TOKEN}` }
    });
    console.log('[DEBUG] Better Stack response:', response.data);
    res.json({ logs: response.data.events || [] });
  } catch (error) {
    console.error('[ERROR] Logs:', error.message, error.response?.data);
    res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[INFO] Server running on port ${PORT}`);
});
