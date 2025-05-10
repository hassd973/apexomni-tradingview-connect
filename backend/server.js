const express = require('express');
const cors = require('cors');
const winston = require('winston');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Custom Winston Transport for BetterStack
const BetterStackTransport = winston.transports.Http.extend({
  constructor: function(options) {
    this.name = 'betterStack';
    this.level = options.level || 'info';
    this.token = options.token || process.env.BETTERSTACK_TOKEN;
    this.url = 'https://in.logs.betterstack.com';
  },
  log: function({ level, message, timestamp }, callback) {
    const logEntry = {
      dt: timestamp || new Date().toISOString(),
      message,
      level
    };
    axios.post(this.url, logEntry, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(() => callback(null, true))
      .catch(err => {
        console.error(`[ERROR] Failed to send log to BetterStack: ${err.message}`);
        callback(err);
      });
  }
});

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.json()
  ),
  transports: [
    new BetterStackTransport({ token: process.env.BETTERSTACK_TOKEN }),
    new winston.transports.Console() // For local debugging
  ]
});

// Middleware
app.use(cors({
  origin: ['https://ice-king-dashboard-tm48.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());

// Log server start
logger.info(`Server started on port ${port}`);

// Routes
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
}).on('error', (error) => {
  logger.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});
