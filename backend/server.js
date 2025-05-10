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

// Initialize logs.json
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

const CMC_API = 'https://pro-api.coinmarketcap.com';
const CMC_API_KEY = process.env.CMC_API_KEY || 'bef090eb-323d-4ae8-86dd-266236262f19';

async function fetchCMCData(symbols) {
  try {
    const response = await axios.get(`${CMC_API}/v1/cryptocurrency/quotes/latest`, {
      params: {
        symbol: symbols.join(','),
        convert: 'USD'
      },
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        'Accept': 'application/json'
      }
    });
    logger.info(`Fetched CMC data for ${symbols.join(',')}`);
    return response.data.data;
  } catch (error) {
    logger.error(`CMC fetch failed: ${error.response?.data?.status?.error_message || error.message}`);
    return {};
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
      'BTC', 'ETH', 'BNB', 'FLOKI', 'SHIB', 'PEOPLE'
    ];
    const cmcData = await fetchCMCData(symbols);
    if (!Object.keys(cmcData).length) {
      logger.warn('No CMC data returned');
      return res.status(500).json({ error: 'No token data available' });
    }

    const enhancedData = Object.values(cmcData).map(coin => {
      const quote = coin.quote.USD;
      const sentimentScore = Math.random() * 0.5 + 0.5;
      const sentimentMentions = Math.floor(Math.random() * 1000);
      const liquidityRatio = (quote.volume_24h / quote.market_cap) || 0;
      const score = (
        (quote.percent_change_24h || 0) * 0.4 +
        (sentimentScore * 100) * 0.3 +
        (liquidityRatio * 100) * 0.2 +
        (quote.volume_24h / 1000000) * 0.1
      ).toFixed(2);

      return {
        id: coin.slug,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        total_volume: quote.volume_24h || 0,
        current_price: quote.price || 0,
        price_change_percentage_24h: quote.percent_change_24h || 0,
        market_cap: quote.market_cap || 0,
        circulating_supply: coin.circulating_supply || 0,
        liquidity_ratio: liquidityRatio,
        sentiment_score: sentimentScore,
        sentiment_mentions: sentimentMentions,
        score: parseFloat(score),
        source: 'CoinMarketCap'
      };
    });

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
