const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all origins (or specify your frontend domain)
app.use(cors());

// CoinMarketCap API configuration
const CMC_API_KEY = process.env.CMC_API_KEY || 'bef090eb-323d-4ae8-86dd-266236262f19'; // Store in Render Environment Variables
const CMC_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

// Mock data as fallback
const mockCryptoData = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock', high_24h: 61000, low_24h: 59000 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock', high_24h: 4100, low_24h: 3900 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', current_price: 0.01962, total_volume: 135674.745, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', high_24h: 0.020, low_24h: 0.018 }
];

// Function to fetch crypto data from CoinMarketCap
async function fetchCryptoData() {
  try {
    console.log('Fetching crypto data from CoinMarketCap');
    const response = await axios.get(CMC_API_URL, {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
      },
      params: {
        start: 1,
        limit: 50, // Fetch top 50 tokens by market cap
        convert: 'USD',
      },
      timeout: 10000,
    });

    const data = response.data.data.map(coin => ({
      id: coin.slug, // CMC uses slug instead of id
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      current_price: parseFloat(coin.quote.USD.price),
      total_volume: parseFloat(coin.quote.USD.volume_24h),
      price_change_percentage_24h: parseFloat(coin.quote.USD.percent_change_24h),
      market_cap: parseFloat(coin.quote.USD.market_cap),
      circulating_supply: parseFloat(coin.circulating_supply),
      source: 'CoinMarketCap',
      high_24h: null, // CMC doesn't provide high_24h in this endpoint
      low_24h: null, // CMC doesn't provide low_24h in this endpoint
      market_cap_rank: coin.cmc_rank,
    }));

    console.log(`Successfully fetched crypto data, count: ${data.length}`);
    return data;
  } catch (error) {
    console.error('Failed to fetch crypto data from CoinMarketCap:', error.message);
    console.warn('Falling back to mock data');
    return mockCryptoData;
  }
}

// API endpoint to get crypto data
app.get('/api/crypto', async (req, res) => {
  try {
    console.log('Received request for /api/crypto');
    const data = await fetchCryptoData();
    if (data.length === 0) {
      console.warn('No crypto data available');
      res.status(500).json({ error: 'Failed to fetch crypto data' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error('Error in /api/crypto endpoint:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get logs (placeholder)
app.get('/api/logs', (req, res) => {
  try {
    console.log('Received request for /api/logs');
    res.json([]); // Placeholder; Render logs can't be retrieved via API
  } catch (error) {
    console.error('Error in /api/logs endpoint:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to add a log (for testing)
app.post('/api/logs', express.json(), (req, res) => {
  try {
    const { message, level } = req.body;
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: message || 'No message provided',
      level: level || 'info',
    };
    console.log(`[${logEntry.level}] ${logEntry.message}`, logEntry);
    res.status(201).json(logEntry);
  } catch (error) {
    console.error('Error in /api/logs POST endpoint:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ status: 'OK' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
