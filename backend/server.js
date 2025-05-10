const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('betterstack');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['https://apexomni-frontend.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const BINANCE_API = 'https://api.binance.com/api/v3';
const BETTERSTACK_TOKEN = process.env.BETTERSTACK_TOKEN || 'your_betterstack_token_here';
const betterstack = createClient(BETTERSTACK_TOKEN);

async function fetchCoinGeckoData(symbols) {
  try {
    const ids = symbols.join(',');
    const response = await axios.get(`${COINGECKO_API}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        ids,
        order: 'market_cap_desc',
        per_page: 100,
        page: 1,
        sparkline: false
      },
      headers: { 'Accept': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error(`[ERROR] CoinGecko fetch failed: ${error.message}`);
    return [];
  }
}

async function fetchBinanceData(symbol) {
  try {
    const response = await axios.get(`${BINANCE_API}/ticker/24hr`, {
      params: { symbol: `${symbol}USDT` },
      headers: { 'Accept': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error(`[ERROR] Binance fetch failed for ${symbol}: ${error.message}`);
    return null;
  }
}

async function fetchBetterStackLogs(query, batch = 50) {
  try {
    const response = await betterstack.logs.search({
      query,
      batch,
      order: 'desc'
    });
    return response.logs || [];
  } catch (error) {
    console.error(`[ERROR] BetterStack logs fetch failed: ${error.message}`);
    return [];
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/tokens/enhanced', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : [
      'bitcoin', 'ethereum', 'binancecoin', 'floki-inu', 'shiba-inu', 'constitutiondao'
    ];
    const coingeckoData = await fetchCoinGeckoData(symbols);
    if (!coingeckoData.length) {
      console.warn('[WARN] No CoinGecko data returned');
      return res.status(500).json({ error: 'No token data available' });
    }

    const enhancedData = await Promise.all(coingeckoData.map(async (coin) => {
      const binanceData = await fetchBinanceData(coin.symbol.toUpperCase());
      const sentimentScore = Math.random() * 0.5 + 0.5;
      const sentimentMentions = Math.floor(Math.random() * 1000);
      const liquidityRatio = (coin.total_volume / coin.market_cap) || 0;
      const score = (
        (coin.price_change_percentage_24h || 0) * 0.4 +
        (sentimentScore * 100) * 0.3 +
        (liquidityRatio * 100) * 0.2 +
        (coin.total_volume / 1000000) * 0.1
      ).toFixed(2);

      return {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        total_volume: coin.total_volume || 0,
        current_price: coin.current_price || 0,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        market_cap: coin.market_cap || 0,
        circulating_supply: coin.circulating_supply || 0,
        liquidity_ratio: liquidityRatio,
        sentiment_score: sentimentScore,
        sentiment_mentions: sentimentMentions,
        score: parseFloat(score),
        source: 'CoinGecko+Binance'
      };
    }));

    console.log('[DEBUG] Enhanced token data:', enhancedData);
    res.json(enhancedData);
  } catch (error) {
    console.error('[ERROR] /tokens/enhanced:', error.message);
    res.status(500).json({ error: 'Failed to fetch token data' });
  }
});

app.get('/logs', async (req, res) => {
  try {
    const query = req.query.query || 'level:info';
    const batch = parseInt(req.query.batch) || 50;
    const logs = await fetchBetterStackLogs(query, batch);
    console.log('[DEBUG] Logs fetched:', logs);
    res.json({ logs });
  } catch (error) {
    console.error('[ERROR] /logs:', error.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.listen(port, () => {
  console.log(`[INFO] Server running on port ${port}`);
});
