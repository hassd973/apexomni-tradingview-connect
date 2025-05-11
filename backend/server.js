const express = require('express');
const cors = require('cors');
const winston = require('winston');
const { Logtail } = require('@logtail/node');
const { LogtailTransport } = require('@logtail/winston');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Create a Logtail client
const logtail = new Logtail('x5nvK7DNDURcpAHEBuCbHrza', {
  endpoint: 'https://s1303816.eu-nbg-2.betterstackdata.com',
});

// Create a Winston logger with Logtail transport
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new LogtailTransport(logtail)
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new LogtailTransport(logtail)
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new LogtailTransport(logtail)
  ]
});

app.use(cors({
  origin: ['https://ice-king-dashboard-tm4b.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());

// Cache for token data
let tokenCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const coincapApiUrl = 'https://api.coincap.io/v2/assets?limit=10';

async function fetchCryptoData(retries = 3, delay = 5000) {
  // Check cache first
  if (tokenCache && (Date.now() - lastCacheTime) < CACHE_DURATION) {
    logger.info('Returning cached token data');
    return tokenCache;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(coincapApiUrl, {
        timeout: 10000
      });
      const data = response.data.data;

      // Map CoinCap data to our format
      const mappedData = data.map(token => ({
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        current_price: parseFloat(token.priceUsd),
        total_volume: parseFloat(token.volumeUsd24Hr) || 0,
        price_change_percentage_24h: parseFloat(token.changePercent24Hr) || 0,
        market_cap: parseFloat(token.marketCapUsd) || 0,
        circulating_supply: parseFloat(token.supply) || 0,
        source: 'CoinCap'
      }));

      // Update cache
      tokenCache = mappedData;
      lastCacheTime = Date.now();
      logger.info('Fetched and cached CoinCap data');
      return mappedData;
    } catch (error) {
      logger.error(`Error fetching CoinCap data (attempt ${i + 1}/${retries}): ${error.message}`);
      if (error.response && error.response.status === 429) {
        logger.warn('Rate limit hit, increasing delay for next attempt');
        delay = 10000; // Back off to 10 seconds on 429
      }
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function fetchLiveLogs() {
  const username = 'utUpktCnjfkSuJ1my8BEQ9DpczfTifyHn';
  const password = 'jRbcPkBws9m1J1d4BE52fqVFoVbhALthUgEh1uMGfCKjGxH7lWr2kmgh9q6f7eT0';
  const url = 'https://eu-nbg-2-connect.betterstackdata.com?output_format_pretty_row_numbers=0';
  const query = "SELECT * FROM remote('t371838_ice_king_logs') WHERE level = 'info' ORDER BY dt DESC LIMIT 10 FORMAT JSONEachRow";

  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await axios.post(url, query, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'plain/text',
        'Accept': 'application/json'
      },
      maxRedirects: 5
    });

    logger.info(`Direct query response: ${JSON.stringify(response.data)}`);
    if (response.data) {
      const logs = parseDirectQueryResponse(response.data);
      logger.info(`Parsed ${logs.length} logs from direct query`);
      return logs;
    } else {
      logger.error('No logs returned from direct query');
      return getMockLogs();
    }
  } catch (error) {
    logger.error(`Error fetching logs via direct query: ${error.message}`);
    if (error.response) {
      logger.error(`Direct query error details: ${JSON.stringify(error.response.data)}`);
    }
    return getMockLogs();
  }
}

function parseDirectQueryResponse(data) {
  try {
    if (typeof data === 'string') {
      const lines = data.split('\n').filter(line => line.trim());
      const logs = lines.map(line => {
        try {
          const parsed = JSON.parse(line);
          return {
            dt: parsed.dt || new Date().toISOString(),
            message: parsed.message || 'No message',
            level: parsed.level || 'info'
          };
        } catch (e) {
          logger.error(`Error parsing log line: ${line}, error: ${e.message}`);
          return null;
        }
      }).filter(log => log !== null);
      return logs;
    } else if (Array.isArray(data)) {
      return data.map(log => ({
        dt: log.dt || new Date().toISOString(),
        message: log.message || 'No message',
        level: log.level || 'info'
      }));
    } else {
      logger.error('Unexpected direct query response format');
      return [];
    }
  } catch (error) {
    logger.error(`Error parsing direct query response: ${error.message}`);
    return getMockLogs();
  }
}

function getMockLogs() {
  logger.warn('Returning mock logs as a fallback');
  return [
    { dt: new Date().toISOString(), message: 'Mock log: Server is running', level: 'info' },
    { dt: new Date().toISOString(), message: 'Mock log: Health check passed', level: 'info' }
  ];
}

app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/crypto', async (req, res) => {
  try {
    const cryptoData = await fetchCryptoData();
    res.json(cryptoData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crypto data' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logData = await fetchLiveLogs();
    res.json(logData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live logs' });
  }
});

logger.info(`Server started on port ${port}`);

app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
}).on('error', (error) => {
  logger.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});

// Ensure logs are sent to BetterStack before shutdown
process.on('SIGTERM', async () => {
  await logtail.flush();
  process.exit(0);
});
