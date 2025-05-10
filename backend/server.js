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

const MORALIS_API = 'https://deep-index.moralis.io/api/v2';
const MORALIS_API_KEY = process.env.MORALIS_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjQ5YWIwMzg4LWYyYzEtNDJmYy1hZjlhLTE4ZTRjYmNhYTkzNSIsIm9yZ0lkIjoiNDQ2MzgwIiwidXNlcklkIjoiNDU5MjYzIiwidHlwZUlkIjoiYmVjNGZiYjctNzdjZi00N2MwLTg2NmUtYWYzMzZmMTAxNmFiIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDY5MDYxODksImV4cCI6NDkwMjY2NjE4OX0.f4Wb6eaKesaWXJFLM7-pyYusGbAbOpc9MZEQdjWIL_4';

async function fetchMoralisData(symbols) {
  try {
    const chain = 'eth'; // Default to Ethereum; adjust if needed (e.g., 'bsc' for Binance Smart Chain)
    const addresses = await getTokenAddresses(symbols);
    const response = await axios.get(`${MORALIS_API}/erc20/price`, {
      params: {
        chain,
        token_addresses: addresses.join(',')
      },
      headers: {
        'X-API-Key': MORALIS_API_KEY,
        'Accept': 'application/json'
      }
    });
    logger.info(`Fetched Moralis data for ${symbols.join(',')}`);
    return response.data;
  } catch (error) {
    logger.error(`Moralis fetch failed: ${error.response?.data?.message || error.message}`);
    return [];
  }
}

// Map symbols to Moralis-compatible token addresses (example mappings)
async function getTokenAddresses(symbols) {
  const tokenAddressMap = {
    'BTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC on Ethereum
    'ETH': '0x0000000000000000000000000000000000000000', // Native ETH (not a token, but placeholder)
    'BNB': '0xb8c77482e45f1f44de1745f52c74426c631bdd52', // BNB on Ethereum
    'FLOKI': '0xcf0c122c6b73ff809c693db761e7baebe62b6a2e', // FLOKI on Ethereum
    'SHIB': '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // SHIB on Ethereum
    'PEOPLE': '0x2c6d39f1b3c5d6f7d3e71b7b2f5f5f8a6b3b5f9', // Placeholder (update if available)
  };
  return symbols.map(symbol => tokenAddressMap[symbol.toUpperCase()] || '').filter(address => address);
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
    const moralisData = await fetchMoralisData(symbols);
    if (!moralisData.length) {
      logger.warn('No Moralis data returned');
      return res.status(500).json({ error: 'No token data available' });
    }

    const enhancedData = moralisData.map(token => {
      const price = parseFloat(token.usdPrice) || 0;
      // Mock volume and market cap (Moralis price endpoint doesn't provide these)
      const totalVolume = Math.random() * 10000000; // Placeholder; replace with Moralis market data if available
      const marketCap = price * (Math.random() * 1000000000); // Placeholder
      const sentimentScore = Math.random() * 0.5 + 0.5;
      const sentimentMentions = Math.floor(Math.random() * 1000);
      const liquidityRatio = (totalVolume / marketCap) || 0;
      const priceChange24h = parseFloat(token.priceChange24h) || (Math.random() * 10 - 5); // Use Moralis if available, else mock
      const score = (
        (priceChange24h || 0) * 0.4 +
        (sentimentScore * 100) * 0.3 +
        (liquidityRatio * 100) * 0.2 +
        (totalVolume / 1000000) * 0.1
      ).toFixed(2);

      return {
        id: token.tokenAddress.toLowerCase(),
        name: token.tokenName || 'Unknown',
        symbol: token.tokenSymbol.toUpperCase(),
        total_volume: totalVolume,
        current_price: price,
        price_change_percentage_24h: priceChange24h,
        market_cap: marketCap,
        circulating_supply: Math.random() * 1000000000, // Placeholder
        liquidity_ratio: liquidityRatio,
        sentiment_score: sentimentScore,
        sentiment_mentions: sentimentMentions,
        score: parseFloat(score),
        source: 'Moralis'
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
