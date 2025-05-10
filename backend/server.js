const express = require('express');
const cors = require('cors');
const winston = require('winston');
const axios = require('axios');
const app = express();
const port = 3000;

// ⚠️ HARDCODED CONFIG (REMOVE BEFORE DEPLOYING!)
const CONFIG = {
  BETTERSTACK_TOKEN: "WGdCT5KhHtg4kiGWAbdXRaSL", // Telemetry token (exposed, rotate ASAP)
  UPTIME_TOKEN: "kbwEU9ZqoTy2JHtpHda8dpKm",      // Uptime token (exposed, rotate ASAP)
  SOURCE_ID: "1303816",                           // Your BetterStack source ID
  ALLOWED_ORIGINS: [
    "https://ice-king-dashboard-tm48.onrender.com",
    "http://localhost:3000"
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
app.use(cors({ origin: CONFIG.ALLOWED_ORIGINS }));
app.use(express.json());

// Fetch logs from BetterStack
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

// List all sources (for debugging)
app.get('/sources', async (req, res) => {
  try {
    const response = await axios.get(
      'https://telemetry.betterstack.com/api/v1/sources',
      {
        headers: {
          Authorization: `Bearer ${CONFIG.BETTERSTACK_TOKEN}`
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    logger.error("Failed to fetch sources:", error.message);
    res.status(500).json({ error: "Failed to list sources" });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: "OK", time: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  logger.warn(`🚨 Server running with HARDCODED TOKENS (UNSAFE!)`);
  logger.info(`Server started on http://localhost:${port}`);
});
