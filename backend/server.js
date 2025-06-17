require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Determine the correct frontend path. Default to the frontend directory one
// level up from the backend folder so running the server from the project root
// works out of the box.
const frontendPath = process.env.FRONTEND_PATH ||
  path.join(__dirname, '..', 'frontend');
console.log('Frontend Path:', frontendPath);

// Serve static files from the frontend directory
app.use(express.static(frontendPath));

// Root route
app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  console.log('Serving index.html from:', indexPath);
  
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    res.status(404).send('index.html not found');
  }
});

// Enable CORS for all origins
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Better Stack configuration
// Credentials are expected via environment variables to avoid hard coding
// sensitive values in the repository.
const BETTER_STACK_HOST = process.env.BETTER_STACK_HOST ||
  'eu-nbg-2-connect.betterstackdata.com';
const BETTER_STACK_PORT = 443;
const BETTER_STACK_API_URL = `https://${BETTER_STACK_HOST}:${BETTER_STACK_PORT}`;
const BETTER_STACK_TOKEN = process.env.BETTER_STACK_TOKEN;

// Etherscan API configuration
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'K3I98GFINF6K4EYRQNZCZD6KIIQ3BAAQ5T';
const ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

// Specific log collections
const LOG_COLLECTIONS = [
  't371838_ice_king',
  't371838_ice_king_2'
];

// CoinMarketCap API configuration
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY;
const CMC_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

// CoinGecko API configuration
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/markets';

// Mock data as fallback
const mockCryptoData = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock', high_24h: 61000, low_24h: 59000, market_cap_rank: 1 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock', high_24h: 4100, low_24h: 3900, market_cap_rank: 2, gasPrice: 30 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', current_price: 0.01962, total_volume: 135674.745, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', high_24h: 0.020, low_24h: 0.018, market_cap_rank: 150 }
];

// Function to fetch ETH gas prices from Etherscan
async function fetchGasPrices() {
@@ -75,93 +79,149 @@ async function fetchGasPrices() {
    const response = await axios.get(ETHERSCAN_API_URL, {
      params: {
        module: 'gastracker',
        action: 'gasoracle',
        apikey: ETHERSCAN_API_KEY
      },
      timeout: 10000
    });
    if (response.data.status === '1' && response.data.result) {
      return {
        safeGasPrice: parseInt(response.data.result.SafeGasPrice),
        proposeGasPrice: parseInt(response.data.result.ProposeGasPrice),
        fastGasPrice: parseInt(response.data.result.FastGasPrice),
        lastBlock: response.data.result.LastBlock
      };
    } else {
      throw new Error('Invalid gas price data');
    }
  } catch (error) {
    console.error('Failed to fetch gas prices from Etherscan:', error.message);
    return null;
  }
}

// Function to fetch crypto data from CoinMarketCap
// Fetch crypto data from CoinMarketCap
async function fetchCryptoDataFromCMC() {
  console.log('Fetching crypto data from CoinMarketCap');
  const response = await axios.get(CMC_API_URL, {
    headers: {
      'X-CMC_PRO_API_KEY': CMC_API_KEY,
    },
    params: {
      start: 1,
      limit: 50,
      convert: 'USD',
    },
    timeout: 10000,
  });

  const gasData = await fetchGasPrices();
  return response.data.data.map(coin => {
    const usdQuote = coin.quote.USD;
    const tokenData = {
      id: coin.slug,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      current_price: parseFloat(usdQuote.price),
      total_volume: parseFloat(usdQuote.volume_24h),
      price_change_percentage_24h: parseFloat(usdQuote.percent_change_24h),
      market_cap: parseFloat(usdQuote.market_cap),
      circulating_supply: parseFloat(coin.circulating_supply),
      source: 'CoinMarketCap',
      high_24h: null,
      low_24h: null,
      market_cap_rank: coin.cmc_rank
    };
    if (coin.symbol.toUpperCase() === 'ETH' && gasData) {
      tokenData.gasPrice = gasData.proposeGasPrice;
    }
    return tokenData;
  }).filter(token => token.current_price > 0);
}

// Fetch crypto data from CoinGecko
async function fetchCryptoDataFromGecko() {
  console.log('Fetching crypto data from CoinGecko');
  const response = await axios.get(COINGECKO_API_URL, {
    params: {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: 50,
      page: 1,
      price_change_percentage: '24h'
    },
    timeout: 10000,
    headers: COINGECKO_API_KEY ? { 'x-cg-pro-api-key': COINGECKO_API_KEY } : {}
  });
  return response.data.map(coin => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    current_price: coin.current_price,
    total_volume: coin.total_volume,
    price_change_percentage_24h: coin.price_change_percentage_24h,
    market_cap: coin.market_cap,
    circulating_supply: coin.circulating_supply,
    source: 'CoinGecko',
    high_24h: coin.high_24h,
    low_24h: coin.low_24h,
    market_cap_rank: coin.market_cap_rank
  }));
}

// Unified function with fallback and caching
let cachedCryptoData = null;
let cachedAt = 0;
async function fetchCryptoData() {
  const now = Date.now();
  if (cachedCryptoData && now - cachedAt < 5 * 60 * 1000) {
    return cachedCryptoData;
  }
  try {
    const data = await fetchCryptoDataFromCMC();
    cachedCryptoData = data;
    cachedAt = now;
    console.log(`Successfully fetched crypto data, count: ${data.length}`, data.slice(0, 2));
    return data;
  } catch (error) {
    console.error('Failed to fetch crypto data from CoinMarketCap:', error.message, error.response?.data || error.response?.status);
    console.warn('Trying CoinGecko as fallback');
    try {
      const geckoData = await fetchCryptoDataFromGecko();
      if (geckoData.length > 0) {
        cachedCryptoData = geckoData;
        cachedAt = now;
        return geckoData;
      }
    } catch (geckoErr) {
      console.error('Failed to fetch crypto data from CoinGecko:', geckoErr.message);
    }
    console.warn('Falling back to mock data');
    cachedCryptoData = mockCryptoData;
    cachedAt = now;
    return mockCryptoData;
  }
}

// Function to fetch live logs from Better Stack
async function fetchLiveLogs(query = '', batch = 100, sourceId = '1303816') {
  const fallbackLogs = [
    { timestamp: new Date().toISOString(), message: 'No live logs available', level: 'info' },
    { timestamp: new Date().toISOString(), message: 'Check Better Stack configuration', level: 'warn' }
  ];

  try {
    const response = await axios.get('https://telemetry.betterstack.com/api/v2/query/live-tail', {
      headers: {
        'Authorization': `Bearer ${BETTER_STACK_TOKEN}`
      },
      params: {
        source_ids: sourceId,
        query: query,
        batch: Math.min(batch, 1000),
        order: 'newest_first'
      },
      timeout: 15000
    });

@@ -194,50 +254,101 @@ app.get('/api/live-logs', async (req, res) => {
    });
  } catch (error) {
    console.error('Error fetching live logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch live logs' });
  }
});

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

// API endpoint to fetch wallet details and open trades
app.get('/api/wallet', async (req, res) => {
  const { address } = req.query;
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }
  try {
    const balResp = await axios.get(ETHERSCAN_API_URL, {
      params: {
        module: 'account',
        action: 'balance',
        address,
        tag: 'latest',
        apikey: ETHERSCAN_API_KEY
      }
    });
    const balanceEth = parseFloat(balResp.data.result) / 1e18;

    const omniUrl = `https://api.omnidex.finance/v1/user/${address}/positions`;
    const omniResp = await axios.get(omniUrl);
    const omniData = omniResp.data || {};

    const tokenResp = await axios.get(`https://api.ethplorer.io/getAddressInfo/${address}?apiKey=freekey`);
    const tokenCount = tokenResp.data.tokens ? tokenResp.data.tokens.length : 0;

    const txResp = await axios.get(ETHERSCAN_API_URL, {
      params: {
        module: 'account',
        action: 'txlist',
        address,
        page: 1,
        sort: 'desc',
        apikey: ETHERSCAN_API_KEY
      }
    });
    const lastTx = txResp.data.result && txResp.data.result[0] ? txResp.data.result[0].hash : 'N/A';

    res.json({
      balanceEth,
      dex: omniData.exchange || omniData.account?.exchange || 'Unknown DEX',
      accountBalance: omniData.account?.balanceUsd || 'N/A',
      positions: omniData.positions || [],
      tokenCount,
      lastTx
    });
  } catch (error) {
    console.error('Wallet API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});
