
try {
  require('dotenv').config();
} catch (err) {
  console.warn('dotenv not available, skipping .env loading');
}
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const ytdl = require('ytdl-core');
const youtubeAudioStream = require('youtube-audio-stream');
const fs = require('fs');
const multer = require('multer');

let apexomniBuildOrderParams;
let apexomniCreateOrder;
let getOrder;
let getFill;
try {
  ({ apexomniBuildOrderParams, apexomniCreateOrder, getOrder, getFill } =
    require('../src/services'));
} catch (err) {
  console.warn('ApexOmni services not available, using stubs');
  apexomniBuildOrderParams = async () => ({ });
  apexomniCreateOrder = async () => ({ });
  getOrder = async () => ({ });
  getFill = async () => ({ });
}

const app = express();
const port = process.env.PORT || 3001;

// Determine the correct frontend path. Default to the frontend directory one
// level up from the backend folder so running the server from the project root
// works out of the box.
const defaultFrontend = path.join(__dirname, '..', 'frontend');
const distFrontend = path.join(defaultFrontend, 'dist');
const frontendPath = process.env.FRONTEND_PATH ||
  (fs.existsSync(distFrontend) ? distFrontend : defaultFrontend);
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

// File upload setup for 3D models
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

app.post('/api/upload-model', upload.single('model'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ filename: req.file.filename, originalName: req.file.originalname });
});

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
  try {
    console.log('Fetching gas prices from Etherscan');
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

    const logs = response.data.rows.map(log => ({
      timestamp: log.timestamp || new Date().toISOString(),
      message: log.message || log.raw || 'No message available',
      level: log.level || (log.message?.includes('error') ? 'error' : 
             log.message?.includes('warn') ? 'warn' : 'info')
    }));

    return logs.length > 0 ? logs : fallbackLogs;
  } catch (error) {
    console.error('Failed to fetch live logs:', error.message);
    return fallbackLogs;
  }
}

// API endpoint for live logs
app.get('/api/live-logs', async (req, res) => {
  try {
    const { query = '', batch = 50 } = req.query;
    const logs = await fetchLiveLogs(query, parseInt(batch));
    res.json({
      success: true,
      logs: logs.map(log => ({
        timestamp: log.timestamp,
        message: log.message,
        level: log.level || 'info'
      }))
    });
  } catch (error) {
    console.error('Error fetching live logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch live logs' });
  }
});

// BTC metrics endpoints used by the studio front-end
app.get('/api/btc/price', async (_req, res) => {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin', {
      timeout: 10000,
    });
    res.json({
      price: data.market_data.current_price.usd,
      volume: data.market_data.total_volume.usd,
      change: data.market_data.price_change_percentage_24h,
    });
  } catch (err) {
    console.error('Error fetching BTC price:', err.message);
    res.json({ price: 60000, volume: 4_500_000, change: 0 });
  }
});

app.get('/api/btc/historical', async (_req, res) => {
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart';
    const { data } = await axios.get(url, {
      params: { vs_currency: 'usd', days: 1, interval: 'minute' },
      timeout: 10000
    });
    res.json(data);
  } catch (err) {
    console.error('Error fetching BTC historical data:', err.message);
    res.status(500).json({ error: 'Failed to fetch BTC historical data' });
  }
});

app.get('/api/btc/stats', async (_req, res) => {
  try {
    const [hashResp, diffResp] = await Promise.all([
      axios.get('https://api.blockchain.info/q/hashrate?cors=true', { timeout: 10000 }),
      axios.get('https://api.blockchain.info/q/getdifficulty?cors=true', { timeout: 10000 })
    ]);
    res.json({
      hashrate: parseFloat(hashResp.data) / 1e9,
      diff: parseFloat(diffResp.data)
    });
  } catch (err) {
    console.error('Error fetching BTC stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch BTC stats' });
  }
});

app.get('/api/btc/latest-hash', async (_req, res) => {
  const urls = [
    'https://blockchain.info/latestblock',
    'https://blockstream.info/api/blocks/tip/hash'
  ];
  for (const url of urls) {
    try {
      const r = await axios.get(url, { timeout: 10000 });
      if (url.includes('latestblock')) {
        if (r.data && r.data.hash) return res.json({ hash: r.data.hash });
      } else {
        const t = typeof r.data === 'string' ? r.data.trim() : r.data;
        if (typeof t === 'string' && /^[0-9a-f]{64}$/i.test(t)) {
          return res.json({ hash: t });
        }
      }
    } catch (_) {
      continue;
    }
  }
  res.status(500).json({ error: 'Failed to fetch latest block hash' });
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
    const tokensRaw = tokenResp.data.tokens || [];
    const tokenCount = tokensRaw.length;
    const tokens = tokensRaw.map(t => ({
      symbol: t.tokenInfo.symbol,
      name: t.tokenInfo.name,
      address: t.tokenInfo.address,
      balance: t.balance / Math.pow(10, t.tokenInfo.decimals || 0)
    }));

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
      tokens,
      lastTx
    });
  } catch (error) {
    console.error('Wallet API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// Simple endpoint to create an order via ApexOmni
app.post('/api/order', async (req, res) => {
  const { symbol, side, size } = req.body;
  if (!symbol || !side || !size) {
    return res.status(400).json({ error: 'symbol, side and size required' });
  }
  try {
    const params = await apexomniBuildOrderParams({
      exchange: 'apexomni',
      strategy: 'manual',
      market: symbol,
      size: parseFloat(size),
      order: side.toLowerCase(),
      price: 0,
      position: side.toLowerCase() === 'buy' ? 'long' : 'short',
      reverse: false,
    });
    const order = await apexomniCreateOrder(params);
    res.json({ order });
  } catch (e) {
    console.error('Order API error:', e.message || e);
    res.status(500).json({ error: 'Failed to create order' });
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

// Stream audio from YouTube for DJ effects
app.get('/api/youtube-audio', (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).send('videoId required');
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'audio/mpeg');
  youtubeAudioStream(url).pipe(res).on('error', err => {
    console.error('stream error:', err.message);
    res.status(500).end('Failed to fetch audio');
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ status: 'OK' });
});

// Grok AI Interaction Endpoint
async function queryGrokAI(prompt) {
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: 'You are a helpful crypto trading assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Grok AI Query Error:', error.response?.data || error.message);
    return 'Sorry, I could not process your request at the moment.';
  }
}

// Grok AI endpoint
app.post('/api/grok', express.json(), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('Received Grok AI request:', prompt);
    const response = await queryGrokAI(prompt);
    
    res.json({ response });
  } catch (error) {
    console.error('Error in /api/grok endpoint:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
