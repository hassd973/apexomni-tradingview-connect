const express = require('express');
const cors = require('cors');
const winston = require('winston');
const TransportStream = require('winston-transport');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

class BetterStackTransport extends TransportStream {
  constructor(options = {}) {
    super(options);
    this.name = 'betterStack';
    this.level = options.level || 'info';
    this.token = 'WGdCT5KhHtg4kiGWAbdXRaSL'; // Hardcoded token for log ingestion
    this.url = 'https://in.logs.betterstack.com';
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const logEntry = {
      dt: info.timestamp || new Date().toISOString(),
      message: info.message,
      level: info.level
    };

    axios.post(this.url, logEntry, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(() => {
        callback();
      })
      .catch(error => {
        console.error(`[ERROR] Failed to send log to BetterStack: ${error.message}`);
        callback(error);
      });
  }
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new BetterStackTransport({
      level: 'info'
    })
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new BetterStackTransport({
      level: 'error'
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new BetterStackTransport({
      level: 'error'
    })
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
        id: '605e2ce9d41eae1066535f7c', // A16Z Portfolio category ID
        convert: 'USD'
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching CoinMarketCap data:', error.message);
    throw error;
  }
}

async function fetchLiveLogs() {
  const sourceId = '1303816';
  const telemetryToken = 'WGdCT5KhHtg4kiGWAbdXRaSL';
  try {
    const response = await axios.get('https://telemetry.betterstack.com/api/v2/query/live-tail', {
      headers: {
        'Authorization': `Bearer ${telemetryToken}`
      },
      params: {
        source_ids: sourceId,
        query: 'level=info'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching BetterStack logs:', error.message);
    throw error;
  }
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
