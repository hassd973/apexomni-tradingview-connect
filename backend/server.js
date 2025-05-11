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
  origin: ['https://ice-king-dashboard-tm48.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());

const cmcApiKey = 'bef090eb-323d-4ae8-86dd-266236262f19';
const cmcApiUrl = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/category';

async function fetchCryptoData() {
  try {
    const response = await axios.get(cmcApiUrl, {
      headers: {
        'X-CMC_PRO_API_KEY': cmcApiKey,
        'Accept': 'application/json'
      },
      params: {
        id: '605e2ce9d41eae1066535f7c',
        convert: 'USD'
      }
    });
    return response.data.data;
  } catch (error) {
    logger.error(`Error fetching CoinMarketCap data: ${error.message}`);
    throw error;
  }
}

async function fetchLiveLogs() {
  const sourceId = '1303816';
  const telemetryToken = 'WGdCT5KhHtg4kiGWAbdXRaSL';
  const url = 'https://telemetry.betterstack.com/api/v2/query/live-tail';
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${telemetryToken}`,
        'Accept': 'application/json'
      },
      params: {
        source_ids: sourceId,
        query: 'level=info',
        batch: 100,
        order: 'newest_first'
      },
      maxRedirects: 5
    });

    logger.info(`Telemetry API response status: ${response.status}`);
    if (response.data && Array.isArray(response.data)) {
      logger.info(`Retrieved ${response.data.length} logs from Telemetry API`);
      return response.data;
    } else {
      logger.warn('No logs returned from Telemetry API, returning mock logs');
      return getMockLogs();
    }
  } catch (error) {
    logger.error(`Error fetching BetterStack logs via Telemetry API: ${error.message}`);
    if (error.response) {
      logger.error(`Telemetry API error details: ${JSON.stringify(error.response.data)}`);
    }
    logger.info('Returning mock logs as a fallback');
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
