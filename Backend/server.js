const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for frontend
app.use(express.json());

// Better Stack API configuration
const BETTER_STACK_API_KEY = process.env.BETTER_STACK_API_KEY;
const BETTER_STACK_LOGS_ENDPOINT = 'https://api.betterstack.com/logs'; // Replace with actual endpoint

// Token stats API configuration (placeholder; replace with Omni Exchange or other API)
const TOKEN_STATS_API_URL = 'https://api.example.com/token-stats'; // Replace with actual API
const TOKEN_STATS_API_KEY = process.env.TOKEN_STATS_API_KEY;

// Endpoint to fetch live log data from Better Stack
app.get('/logs', async (req, res) => {
  try {
    const response = await axios.get(BETTER_STACK_LOGS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${BETTER_STACK_API_KEY}`,
      },
      params: {
        limit: req.query.limit || 50, // Number of logs to fetch
        from: req.query.from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching logs:', error.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Endpoint to fetch live token statistics
app.get('/token-stats', async (req, res) => {
  try {
    const response = await axios.get(TOKEN_STATS_API_URL, {
      headers: {
        Authorization: `Bearer ${TOKEN_STATS_API_KEY}`,
      },
      params: {
        symbols: req.query.symbols || 'ETH,BNB,ADA', // Default tokens; frontend can override
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching token stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch token stats' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
