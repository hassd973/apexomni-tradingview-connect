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
    this.token = 'x5nvK7DNDURcpAHEBuCbHrza';
    this.url = 'https://s1303816.eu-nbg-2.betterstackdata.com';
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const logEntry = {
      message: info.message,
      level: info.level,
      dt: info.timestamp || new Date().toISOString()
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
    new BetterStackTransport()
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new BetterStackTransport()
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new BetterStackTransport()
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
        'Authorization': `Bearer ${telemetryToken}`
      },
      params: {
        source_ids: sourceId,
        query: 'level=info',
        batch: 100,
        order: 'newest_first'
      },
      maxRedirects: 5
    });

    if (response.data && Array.isArray(response.data)) {
      return response.data;
    } else {
      logger.warn('No logs returned from Telemetry API, attempting direct query');
      return await fetchLogsDirectly();
    }
  } catch (error) {
    logger.error(`Error fetching BetterStack logs via Telemetry API: ${error.message}`);
    logger.info('Falling back to direct query method');
    return await fetchLogsDirectly();
  }
}

async function fetchLogsDirectly() {
  const username = 'utUpktCnjfkSuJ1my8BEQ9DpczfTifyHn';
  const password = 'jRbcPkBws9m1J1d4BE52fqVFoVbhALthUgEh1uMGfCKjGxH7lWr2kmgh9q6f7eT0';
  const url = 'https://eu-nbg-2-connect.betterstackdata.com?output_format_pretty_row_numbers=0';
  const query = "WITH database || '_' || table AS named_collection, collections AS (SELECT database, table FROM system.tables WHERE database IN ('t371838') AND engine = 'View' AND match(table, '(_logs|_metrics|_s3)\$') UNION DISTINCT SELECT (arrayJoin([('t371838','ice_king_logs'), ('t371838','ice_king_metrics'), ('t371838','ice_king_s3'), ('t371838','ice_king_2_logs'), ('t371838','ice_king_2_metrics'), ('t371838','ice_king_2_s3'), ('t371838','onboarding_real_time_flights_logs'), ('t371838','onboarding_real_time_flights_metrics'), ('t371838','onboarding_real_time_flights_s3')]) AS database_tables).1 AS database, database_tables.2 AS table ORDER BY database, table) SELECT named_collection, 'SELECT * FROM ' || if(endsWith(named_collection, '_s3'), 's3Cluster(primary,' || named_collection || ')', 'remote(' || named_collection || ')') || ' LIMIT 10' AS query_with FROM collections FORMAT Pretty";

  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await axios.post(url, query, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'plain/text'
      },
      maxRedirects: 5
    });

    if (response.data) {
      const logs = parseDirectQueryResponse(response.data);
      return logs;
    } else {
      logger.error('No logs returned from direct query');
      return [];
    }
  } catch (error) {
    logger.error(`Error fetching logs via direct query: ${error.message}`);
    return [];
  }
}

function parseDirectQueryResponse(data) {
  try {
    const lines = data.split('\n').filter(line => line.trim());
    const logs = lines.map(line => {
      const [named_collection, query] = line.split(/\s+/).filter(Boolean);
      return {
        dt: new Date().toISOString(),
        message: `Query for ${named_collection}: ${query}`,
        level: 'info'
      };
    });
    return logs;
  } catch (error) {
    logger.error(`Error parsing direct query response: ${error.message}`);
    return [];
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
