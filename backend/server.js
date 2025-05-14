const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all origins (or specify your frontend domain)
app.use(cors());

// Better Stack configuration
const BETTER_STACK_TOKEN = 'WGdCT5KhHtg4kiGWAbdXRaSL';
const BETTER_STACK_SOURCE_ID = '1303816'; // Extracted from the provided link
const BETTER_STACK_API_URL = 'https://telemetry.betterstack.com/api/v2/query/live-tail';

// CoinMarketCap API configuration
const CMC_API_KEY = 'bef090eb-323d-4ae8-86dd-266236262f19';
const CMC_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

// CoinGecko API configuration
const COINGECKO_API_KEY = 'CG-zH5yUbmxFumgf3Yu1BeNqyx3';
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/markets';

// Mock data as fallback
const mockCryptoData = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock', high_24h: 61000, low_24h: 59000 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock', high_24h: 4100, low_24h: 3900 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', current_price: 0.01962, total_volume: 135674.745, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', high_24h: 0.020, low_24h: 0.018 }
];

// Function to fetch live logs from Better Stack
async function fetchLiveLogs(query = '', batch = 100) {
  if (!BETTER_STACK_TOKEN || !BETTER_STACK_SOURCE_ID) {
    console.warn('Better Stack credentials not configured');
    return [];
  }

  try {
    const response = await axios.get(BETTER_STACK_API_URL, {
      headers: {
        'Authorization': `Bearer ${BETTER_STACK_TOKEN}`,
      },
      params: {
        source_ids: BETTER_STACK_SOURCE_ID,
        query: query,
        batch: batch,
        order: 'newest_first'
      },
      timeout: 10000
    });

    return response.data.rows || [];
  } catch (error) {
    console.error('Failed to fetch live logs:', error.message);
    return [];
  }
}

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

    console.log(`Successfully fetched crypto data, count: ${data.length}`, data);
    return data;
  } catch (error) {
    console.error('Failed to fetch crypto data from CoinMarketCap:', error.message, error.response?.data || error.response?.status);
    console.warn('Falling back to mock data');
    return mockCryptoData;
  }
}

// API endpoint to get crypto data
app.get('/api/crypto', async (req, res) => {
  try {
    console.log('Received request for /api/crypto from:', req.headers['user-agent']);
    const data = await fetchCryptoData();
    if (data.length === 0) {
      console.warn('No crypto data available');
      res.status(500).json({ error: 'Failed to fetch crypto data' });
      return;
    }
    console.log('Sending crypto data response:', data);
    res.json(data);
  } catch (error) {
    console.error('Error in /api/crypto endpoint:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get live logs from Better Stack
app.get('/api/logs', async (req, res) => {
  try {
    const { query, batch } = req.query;
    console.log('Received request for /api/logs with query:', query);
    
    const logs = await fetchLiveLogs(query, batch);
    
    if (logs.length === 0) {
      console.warn('No logs available');
      res.status(404).json({ error: 'No logs found' });
      return;
    }
    
    res.json(logs);
  } catch (error) {
    console.error('Error in /api/logs endpoint:', error.message);
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
