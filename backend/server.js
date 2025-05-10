const express = require('express');
const cors = require('cors');
const axios = require('axios');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, 'logs.json') })
  ]
});

// Initialize logs.json if it doesn't exist
async function initializeLogs() {
  try {
    await fs.access(path.join(__dirname, 'logs.json'));
  } catch (error) {
    await fs.writeFile(path.join(__dirname, 'logs.json'), JSON.stringify([]));
    logger.info('Initialized logs.json');
  }
}

// Middleware
app.use(cors({
  origin: ['https://apexomni-frontend.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());

// Log server start
initializeLogs().then(() => {
  logger.info(`Server started on port ${port}`);
});

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const BINANCE_API = 'https://api.binance.com/api/v3';

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
    logger.info(`Fetched CoinGecko data for ${ids}`);
    return response.data;
  } catch (error) {
    logger.error(`CoinGecko fetch failed: ${error.message}`);
    return [];
  }
}

async function fetchBinanceData(symbol) {
  try {
    const response = await axios.get(`${BINANCE_API}/ticker/24hr`, {
      params: { symbol: `${symbol}USDT` },
      headers: { 'Accept': 'application/json' }
    });
    logger.info(`Fetched Binance data for ${symbol}USDT`);
    return response.data;
  } catch (error) {
    logger.error(`Binance fetch failed for ${symbol}: ${error.message}`);
    return null;
  }
}

async function fetchLogs(query = 'level:info', batch = 50) {
  try {
    const data = await fs.readFile(path.join(__dirname, 'logs.json'), 'utf8');
    let logs = JSON.parse(data);
    if (query) {
      const level = query.split(':')[1]?.toLowerCase();
      if (level) {
        logs = logs.filter(log => log.level.toLowerCase() === level);
      }
    }
    logs = logs.slice(0, batch).map(log => ({
      dt: log.timestamp,
      message: log.message,
      level: log.level
    }));
    logger.info(`Fetched ${logs.length} logs with query "${query}"`);
    return logs;
  } catch (error) {
    logger.error(`Logs fetch failed: ${error.message}`);
    return [];
  }
}

// Routes
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/tokens/enhanced', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : [
      'bitcoin', 'ethereum', 'binancecoin', 'floki-inu', 'shiba-inu', 'constitutiondao'
    ];
    const coingeckoData = await fetchCoinGeckoData(symbols);
    if (!coingeckoData.length) {
      logger.warn('No CoinGecko data returned');
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

    logger.info(`Returning ${enhancedData.length} enhanced tokens`);
    res.json(enhancedData);
  } catch (error) {
    logger.error(`/tokens/enhanced failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch token data' });
  }
});

app.get('/logs', async (req, res) => {
  try {
    const query = req.query.query || 'level:info';
    const batch = parseInt(req.query.batch) || 50;
    const logs = await fetchLogs(query, batch);
    logger.info(`Returning ${logs.length} logs`);
    res.json({ logs });
  } catch (error) {
    logger.error(`/logs failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
