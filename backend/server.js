const express = require('express');
const cors = require('cors');
const Moralis = require('moralis').default;
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

// Initialize Moralis
async function initializeMoralis() {
  try {
    const apiKey = process.env.MORALIS_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjQ5YWIwMzg4LWYyYzEtNDJmYy1hZjlhLTE4ZTRjYmNhYTkzNSIsIm9yZ0lkIjoiNDQ2MzgwIiwidXNlcklkIjoiNDU5MjYzIiwidHlwZUlkIjoiYmVjNGZiYjctNzdjZi00N2MwLTg2NmUtYWYzMzZmMTAxNmFiIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDY5MDYxODksImV4cCI6NDkwMjY2NjE4OX0.f4Wb6eaKesaWXJFLM7-pyYusGbAbOpc9MZEQdjWIL_4';
    await Moralis.start({ apiKey });
    logger.info('Moralis SDK initialized');
  } catch (error) {
    logger.error(`Moralis initialization failed: ${error.message}`);
    throw error;
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

// Map symbols to Moralis-compatible token addresses (Ethereum)
const tokenAddressMap = {
  'BTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
  'ETH': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  'BNB': '0xb8c77482e45f1f44de1745f52c74426c631bdd52', // BNB
  'FLOKI': '0xcf0c122c6b73ff809c693db761e7baebe62b6a2e', // FLOKI
  'SHIB': '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // SHIB
  'PEOPLE': '0x7a4d2b4a88f3ee18da283a0b230c6ed2f74cfdc2' // ConstitutionDAO (updated)
};

async function fetchMoralisData(symbols) {
  try {
    const chain = 'eth'; // Ethereum; adjust to 'bsc' for BNB if needed
    const addresses = symbols.map(symbol => tokenAddressMap[symbol.toUpperCase()]).filter(address => address);
    if (!addresses.length) {
      logger.warn('No valid token addresses found for symbols: ' + symbols.join(','));
      return [];
    }

    const pricePromises = addresses.map(address =>
      Moralis.EvmApi.token.getTokenPrice({
        chain,
        address
      })
    );
    const responses = await Promise.allSettled(pricePromises);
    const tokenData = responses
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          const data = result.value.data;
          const symbol = Object.keys(tokenAddressMap).find(
            key => tokenAddressMap[key] === addresses[index]
          );
          return {
            tokenAddress: addresses[index],
            tokenSymbol: symbol || data.tokenSymbol || 'UNKNOWN',
            tokenName: data.tokenName || 'Unknown',
            usdPrice: data.usdPrice,
            priceChange24h: data['24hrPercentChange'] || 0 // May be null; mock if unavailable
          };
        } else {
          logger.error(`Moralis price fetch failed for address ${addresses[index]}: ${result.reason.message}`);
          return null;
        }
      })
      .filter(data => data !== null);

    logger.info(`Fetched Moralis data for ${tokenData.length} tokens: ${tokenData.map(t => t.tokenSymbol).join(',')}`);
    return tokenData;
  } catch (error) {
    logger.error(`Moralis fetch failed: ${error.message}`);
    return [];
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
    const symbols = req.query.symbols
      ? req.query.symbols.split(',')
      : ['BTC', 'ETH', 'BNB', 'FLOKI', 'SHIB', 'PEOPLE'];
    const moralisData = await fetchMoralisData(symbols);
    if (!moralisData.length) {
      logger.warn('No Moralis data returned');
      return res.status(500).json({ error: 'No token data available' });
    }

    const enhancedData = moralisData.map(token => {
      const price = parseFloat(token.usdPrice) || 0;
      // Mock volume and market cap (Moralis getTokenPrice doesn't provide these)
      const totalVolume = Math.random() * 10000000; // Placeholder; use Moralis market data if available
      const marketCap = price * (Math.random() * 1000000000); // Placeholder
      const sentimentScore = Math.random() * 0.5 + 0.5;
      const sentimentMentions = Math.floor(Math.random() * 1000);
      const liquidityRatio = totalVolume / marketCap || 0;
      const priceChange24h = parseFloat(token.priceChange24h) || Math.random() * 10 - 5;
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

// Start server after initializing Moralis
Promise.all([initializeLogs(), initializeMoralis()])
  .then(() => {
    app.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
    });
  })
  .catch(error => {
    logger.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  });
