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

// Mock Logs for Fallback
const mockLogs = [
  { dt: new Date().toISOString(), message: 'Mock log: Server initialized', level: 'info' },
  { dt: new Date().toISOString(), message: 'Mock log: Token data processed', level: 'info' },
  { dt: new Date().toISOString(), message: 'Mock log: API rate limit warning', level: 'warn' },
  { dt: new Date().toISOString(), message: 'Mock log: System check complete', level: 'info' }
];

// Root Route
app.get('/', (req, res) => {
  res.json({ message: 'ApexOmni Backend Running', endpoints: ['/health', '/token-stats', '/logs', '/top-tokens'] });
});

// Token Stats Endpoint (CoinMarketCap)
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

// Top Tokens Endpoint (CoinMarketCap Trending Gainers)
app.get('/top-tokens', async (req, res) => {
  try {
    await apiThrottle.wait();
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/trending/gainers-losers?limit=5&convert=USD';
    const response = await axios.get(url, {
      headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY }
    });
    const formattedData = response.data.data
      .filter(item => item.quote.USD.percent_change_24h > 0)
      .map(item => ({
        name: item.name,
        symbol: item.symbol.toUpperCase(),
        price_change_percentage_24h: item.quote.USD.percent_change_24h || 0,
        volume_24h: item.quote.USD.volume_24h || 0,
        market_cap: item.quote.USD.market_cap || 0,
        liquidity_ratio: (item.quote.USD.volume_24h / item.quote.USD.market_cap) || 0,
        source: 'CoinMarketCap'
      }));
    res.json(formattedData);
  } catch (error) {
    console.error('[ERROR] Top Tokens:', error.message, error.response?.data);
    res.status(500).json({ error: 'Failed to fetch top tokens', details: error.message });
  }
});

// Logs Endpoint (Better Stack with Mock Fallback)
app.get('/logs', async (req, res) => {
  try {
    await apiThrottle.wait();
    let query = req.query.query || 'level:info';
    // Normalize query syntax: accept both level:info and level=info
    if (query.includes('level=info')) {
      query = query.replace('level=info', 'level:info');
    }
    const batch = parseInt(req.query.batch) || 50;
    const sourceIds = '1303816';
    const url = `https://logs.betterstack.com/api/v1/query?source_ids=${sourceIds}&query=${encodeURIComponent(query)}&batch=${batch}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.BETTER_STACK_TOKEN}` }
    });
    console.log('[DEBUG] Better Stack response:', response.data);
    const logs = response.data.events && Array.isArray(response.data.events) ? response.data.events : [];
    if (logs.length === 0) {
      console.warn('[WARN] No logs returned from Better Stack, using mock logs');
      return res.json({ logs: mockLogs });
    }
    res.json({ logs });
  } catch (error) {
    console.error('[ERROR] Logs:', error.message, error.response?.data);
    res.json({ logs: mockLogs });
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
