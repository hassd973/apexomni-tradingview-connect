const express = require('express');
const cors = require('cors');
const winston = require('winston');
const TransportStream = require('winston-transport');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Custom BetterStack Transport
class BetterStackTransport extends TransportStream {
  constructor(options = {}) {
    super(options);
    this.name = 'betterStack';
    this.level = options.level || 'info';
    this.token = options.token || process.env.BETTERSTACK_TOKEN || 'XEBetwKsdutXhsDodis2P75H'; // Hardcoded Telemetry API token
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

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new BetterStackTransport({
      level: 'info',
      token: process.env.BETTERSTACK_TOKEN || 'XEBetwKsdutXhsDodis2P75H'
    })
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new BetterStackTransport({
      level: 'error',
      token: process.env.BETTERSTACK_TOKEN || 'XEBetwKsdutXhsDodis2P75H'
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new BetterStackTransport({
      level: 'error',
      token: process.env.BETTERSTACK_TOKEN || 'XEBetwKsdutXhsDodis2P75H'
    })
  ]
});

// Middleware
app.use(cors({
  origin: ['https://ice-king-dashboard-tm48.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());

// CoinMarketCap API configuration (hardcoded)
const cmcApiKey = 'bef090eb-323d-4ae8-86dd-266236262f19';
const cmcApiUrl = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

// Fetch CoinMarketCap data
async function fetchCryptoData() {
  try {
    const response = await axios.get(cmcApiUrl, {
      headers: {
        'X-CMC_PRO_API_KEY': cmcApiKey,
        'Accept': 'application/json'
      },
      params: {
        start: 1,
        limit: 100,
        convert: 'USD'
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching CoinMarketCap data:', error.message);
    throw error;
  }
}

// Fetch BetterStack live logs
async function fetchLiveLogs() {
  const sourceId = '1303816'; // Hardcoded SOURCE_ID
  const telemetryToken = 'XEBetwKsdutXhsDodis2P75H'; // Hardcoded Telemetry API token
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

// Routes
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// New endpoint for CoinMarketCap data
app.get('/api/crypto', async (req, res) => {
  try {
    const cryptoData = await fetchCryptoData();
    res.json(cryptoData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crypto data' });
  }
});

// New endpoint for BetterStack live logs
app.get('/api/logs', async (req, res) => {
  try {
    const logData = await fetchLiveLogs();
    res.json(logData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live logs' });
  }
});

// Log server start
logger.info(`Server started on port ${port}`);

// Start server
app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
}).on('error', (error) => {
  logger.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});


### Changes and Explanations:
1. **CoinMarketCap Integration**:
   - Added `cmcApiKey` and `cmcApiUrl` with the hardcoded key `bef090eb-323d-4ae8-86dd-266236262f19`.
   - Created `fetchCryptoData()` to fetch the top 100 cryptocurrencies.
   - Added a `/api/crypto` endpoint to serve this data as JSON.

2. **BetterStack Live Logs**:
   - Hardcoded `sourceId` (1303816) and `telemetryToken` (`XEBetwKsdutXhsDodis2P75H`) as requested.
   - Implemented `fetchLiveLogs()` using the provided `curl` format (`https://telemetry.betterstack.com/api/v2/query/live-tail` with `source_ids` and `query` parameters).
   - Added a `/api/logs` endpoint to return the live log data.

3. **Existing Functionality**:
   - Updated the `BetterStackTransport` to use the hardcoded `XEBetwKsdutXhsDodis2P75H` token as a fallback if `process.env.BETTERSTACK_TOKEN` is undefined.
   - Kept the original Winston logger and CORS middleware intact.

4. **Error Handling**:
   - Added basic error handling for API calls, logging errors to the console and returning appropriate HTTP status codes.

### Notes:
- **Security**: Hardcoding API keys and tokens is done as per your request but is insecure for production. Consider using environment variables (e.g., `process.env.CMC_API_KEY`, `process.env.TELEMETRY_TOKEN`) and setting them in Render.
- **CORS**: The existing CORS configuration allows your front-end (`https://ice-king-dashboard-tm48.onrender.com`) to access these endpoints.
- **Usage**: Update your front-end `script.js` to fetch from `/api/crypto` and `/api/logs` instead of the CoinMarketCap API directly. For example:
  - Replace `fetch(`${apiUrl}?start=1&limit=100&convert=USD`, ...)` with `fetch('/api/crypto', ...)`.
  - Add a new call to `fetch('/api/logs', ...)` to populate `#log-list`.
- **Testing**: Deploy this on Render and test the new endpoints with `curl` or a browser (e.g., `https://your-render-url/api/crypto`, `https://your-render-url/api/logs`).

If you need further adjustments or have an existing `script.js` to align with these endpoints, let me know!
