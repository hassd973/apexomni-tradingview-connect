require('dotenv').config();
const express = require('express');
const cors = require('cors');
const winston = require('winston');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Configuration (for local testing only - use .env in production)
const CONFIG = {
  BETTERSTACK_TOKEN: process.env.BETTERSTACK_TOKEN || "WGdCT5KhHtg4kiGWAbdXRaSL",
  SOURCE_ID: process.env.SOURCE_ID || "1303816",
  ALLOWED_ORIGINS: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://ice-king-dashboard-tm48.onrender.com"
  ]
};

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Middleware
app.use(cors({
  origin: CONFIG.ALLOWED_ORIGINS,
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Log retrieval endpoint
app.get('/logs', async (req, res) => {
  try {
    const response = await axios.get(
      'https://telemetry.betterstack.com/api/v2/query/live-tail',
      {
        params: {
          source_ids: CONFIG.SOURCE_ID,
          query: 'level=info'
        },
        headers: {
          Authorization: `Bearer ${CONFIG.BETTERSTACK_TOKEN}`
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    logger.error("Failed to fetch logs:", error.message);
    res.status(500).json({ error: "Log retrieval failed" });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: "OK", time: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
  logger.warn('WARNING: Running with local test configuration');
});
