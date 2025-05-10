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

// Token Stats Endpoint
app.get('/token-stats', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : ['bitcoin', 'ethereum', 'binancecoin'];
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${symbols.join(',')}&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`;
    const response = await axios.get(url, {
      headers: { 'x-cg-api-key': process.env.COINGECKO_API_KEY }
    });
    const formattedData = response.data.map(item => ({
      id: item.id,
      name: item.name,
      symbol: item.symbol.toUpperCase(),
      total_volume: item.total_volume,
      current_price: item.current_price,
      price_change_percentage_24h: item.price_change_percentage_24h,
      market_cap: item.market_cap,
      circulating_supply: item.circulating_supply,
      source: 'CoinGecko'
    }));
    res.json(formattedData);
  } catch (error) {
    console.error('[ERROR] Token Stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch token stats', details: error.message });
  }
});

// Logs Endpoint
app.get('/logs', async (req, res) => {
  try {
    const query = req.query.query || 'level=info';
    const batch = parseInt(req.query.batch) || 50;
    const url = `https://logs.betterstack.com/api/v1/query?${query}&batch=${batch}&source_ids=1303816`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.BETTER_STACK_TOKEN}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error('[ERROR] Logs:', error.message);
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
