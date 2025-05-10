const express = require('express');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
}));

// In-memory cache
const cache = {
  enhancedTokens: { data: null, timestamp: 0 },
  ttl: 5 * 60 * 1000 // 5 minutes
};

// API throttle
const apiThrottle = {
  lastCall: 0,
  minInterval: 1200,
  async wait() {
    const now = Date.now();
    const timeSinceLast = now - this.lastCall;
    if (timeSinceLast < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLast));
    }
    this.lastCall = Date.now();
  }
};

// Mock X sentiment (replace with real X post analysis if available)
const mockXSentiment = {
  'BTC': { score: 0.8, mentions: 1200 },
  'ETH': { score: 0.7, mentions: 900 },
  'BNB': { score: 0.6, mentions: 500 },
  'FLOKI': { score: 0.9, mentions: 300 },
  'SHIB': { score: 0.85, mentions: 400 },
  'PEOPLE': { score: 0.75, mentions: 200 }
};

// Mock logs
const mockLogs = [
  { dt: new Date().toISOString(), message: 'Mock log: Server initialized', level: 'info' },
  { dt: new Date().toISOString(), message: 'Mock log: Token data processed', level: 'info' },
  { dt: new Date().toISOString(), message: 'Mock log: API rate limit warning', level: 'warn' },
  { dt: new Date().toISOString(), message: 'Mock log: System check complete', level: 'info' }
];

// Binance WebSocket for live prices
const ws = new WebSocket('wss://stream.binance.com:9443/ws');
const livePrices = {};
ws.on('open', () => {
  console.log('[INFO] Binance WebSocket connected');
  const symbols = ['btcusdt', 'ethusdt', 'bnbusdt', 'flokiusdt', 'shibusdt', 'peopleusdt'];
  symbols.forEach(symbol => {
    ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: [`${symbol}@ticker`],
      id: 1
    }));
  });
});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.e === '24hrTicker') {
    livePrices[msg.s] = {
      price: parseFloat(msg.c),
      priceChangePercent: parseFloat(msg.P),
      volume: parseFloat(msg.v),
      timestamp: new Date().toISOString()
    };
  }
});
ws.on('error', (error) => {
  console.error('[ERROR] Binance WebSocket:', error.message);
});

// Enhanced Tokens Endpoint
app.get('/tokens/enhanced', async (req, res) => {
  try {
    if (cache.enhancedTokens.data && (Date.now() - cache.enhancedTokens.timestamp) < cache.ttl) {
      console.log('[DEBUG] Serving cached enhanced tokens');
      return res.json(cache.enhancedTokens.data);
    }

    await apiThrottle.wait();
    const symbols = req.query.symbols ? req.query.symbols.split(',') : ['bitcoin', 'ethereum', 'binancecoin', 'floki-inu', 'shiba-inu', 'constitutiondao'];
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${symbols.join(',')}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;
    const response = await axios.get(url);
    const coingeckoData = response.data;

    const formattedData = coingeckoData.map(item => {
      const symbol = item.symbol.toUpperCase();
      const binanceSymbol = `${symbol}USDT`.toUpperCase();
      const liveData = livePrices[binanceSymbol] || {};
      const sentiment = mockXSentiment[symbol] || { score: 0.5, mentions: 100 };
      const liquidityRatio = (item.total_volume / item.market_cap) || 0;
      const score = (
        (item.price_change_percentage_24h || 0) * 0.4 +
        (item.total_volume / 1000000) * 0.3 +
        (liquidityRatio * 100) * 0.2 +
        (sentiment.score * 100) * 0.1
      ).toFixed(2);

      return {
        id: item.id,
        name: item.name,
        symbol: symbol,
        total_volume: item.total_volume || 0,
        current_price: liveData.price || item.current_price_usd || 0,
        price_change_percentage_24h: liveData.priceChangePercent || item.price_change_percentage_24h || 0,
        market_cap: item.market_cap || 0,
        circulating_supply: item.circulating_supply || 0,
        liquidity_ratio: liquidityRatio,
        sentiment_score: sentiment.score,
        sentiment_mentions: sentiment.mentions,
        score: parseFloat(score),
        source: 'CoinGecko+Binance'
      };
    }).filter(item => item.current_price > 0);

    cache.enhancedTokens = { data: formattedData, timestamp: Date.now() };
    res.json(formattedData);
  } catch (error) {
    console.error('[ERROR] Enhanced Tokens:', error.message, error.response?.data);
    res.status(500).json({ error: 'Failed to fetch enhanced tokens', details: error.message });
  }
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
