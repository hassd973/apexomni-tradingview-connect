const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Logtail = require('@logtail/node'); // Updated for @logtail/node

const app = express();
const port = process.env.PORT || 3000;

// Initialize Logtail
const logtail = new Logtail("x5nvK7DNDURcpAHEBuCbHrza", {
  endpoint: 'https://s1303816.eu-nbg-2.betterstackdata.com',
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory log storage (for /api/logs)
let logs = [];

// Function to fetch crypto data from Coinpaprika
async function fetchCryptoData() {
  try {
    logtail.info('Fetching crypto data from Coinpaprika');
    const response = await axios.get('https://api.coinpaprika.com/v1/tickers', {
      params: {
        limit: 10 // Fetch top 10 coins
      }
    });
    const data = response.data.map(coin => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      current_price: parseFloat(coin.quotes.USD.price),
      total_volume: parseFloat(coin.quotes.USD.volume_24h),
      price_change_percentage_24h: parseFloat(coin.quotes.USD.percent_change_24h),
      market_cap: parseFloat(coin.quotes.USD.market_cap),
      circulating_supply: parseFloat(coin.circulating_supply),
      source: 'Coinpaprika'
    }));
    logtail.info('Successfully fetched crypto data', { count: data.length });
    return data;
  } catch (error) {
    logtail.error('Failed to fetch crypto data from Coinpaprika', { error: error.message });
    return [];
  }
}

// API endpoint to get crypto data
app.get('/api/crypto', async (req, res) => {
  try {
    logtail.info('Received request for /api/crypto');
    const data = await fetchCryptoData();
    if (data.length === 0) {
      logtail.warn('No crypto data available');
      res.status(500).json({ error: 'Failed to fetch crypto data' });
      return;
    }
    res.json(data);
  } catch (error) {
    logtail.error('Error in /api/crypto endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get logs
app.get('/api/logs', (req, res) => {
  try {
    logtail.info('Received request for /api/logs');
    res.json(logs);
  } catch (error) {
    logtail.error('Error in /api/logs endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to add a log (for testing)
app.post('/api/logs', (req, res) => {
  try {
    const { message, level } = req.body;
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: message || 'No message provided',
      level: level || 'info'
    };
    logs.push(logEntry);
    logtail.log(logEntry.level, 'Added log entry', logEntry);
    res.status(201).json(logEntry);
  } catch (error) {
    logtail.error('Error in /api/logs POST endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  logtail.info('Health check requested');
  res.status(200).json({ status: 'OK' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  logtail.info('Server started', { port });
});

// Flush logs on process exit
process.on('SIGINT', () => {
  logtail.flush();
  process.exit();
});
