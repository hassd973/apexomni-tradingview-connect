require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Enable CORS for all origins (or specify your frontend domain)
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Better Stack configuration
const BETTER_STACK_USERNAME = 'uJDSRvXdjN0eT2afRJ88m24R6YZiEwGcJ';
const BETTER_STACK_PASSWORD = '2WT0nhxDRzsw3KxyNJx9sOCmvajKzjaW3VTIRaY1vwPvHdTvGk3TVubeUFHPrEve';
const BETTER_STACK_HOST = 'eu-nbg-2-connect.betterstackdata.com';
const BETTER_STACK_PORT = 443;
const BETTER_STACK_API_URL = `https://${BETTER_STACK_HOST}:${BETTER_STACK_PORT}`;
const BETTER_STACK_TOKEN = 'WGdCT5KhHtg4kiGWAbdXRaSL';

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
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock', high_24h: 61000, low_24h: 59000 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock', high_24h: 4100, low_24h: 3900 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', current_price: 0.01962, total_volume: 135674.745, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', high_24h: 0.020, low_24h: 0.018 }
];

// Function to fetch live logs from Better Stack
async function fetchLiveLogs(query = '', batch = 100, sourceId = '1303816') {
  // Fallback logs if Better Stack is not configured
  const fallbackLogs = [
    { timestamp: new Date().toISOString(), message: 'No live logs available', level: 'info' },
    { timestamp: new Date().toISOString(), message: 'Check Better Stack configuration', level: 'warn' }
  ];

  // Credentials are hardcoded, no need to check

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
      timeout: 15000 // Increased timeout
    });

    // Parse the response and transform logs
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

    const data = response.data.data.map(coin => {
      const usdQuote = coin.quote.USD;
      return {
        id: coin.slug,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        current_price: parseFloat(usdQuote.price),
        total_volume: parseFloat(usdQuote.volume_24h),
        price_change_percentage_24h: parseFloat(usdQuote.percent_change_24h),
        market_cap: parseFloat(usdQuote.market_cap),
        circulating_supply: parseFloat(coin.circulating_supply),
        source: 'CoinMarketCap',
        high_24h: null, // CMC doesn't provide high_24h
        low_24h: null, // CMC doesn't provide low_24h
        market_cap_rank: coin.cmc_rank
      };
    }).filter(token => token.current_price > 0);

    console.log(`Successfully fetched crypto data, count: ${data.length}`, data.slice(0, 2));
    return data;
  } catch (error) {
    console.error('Failed to fetch crypto data from CoinMarketCap:', error.message, error.response?.data || error.response?.status);
    console.warn('Falling back to mock data');
    return mockCryptoData;
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

// Grok AI Interaction Endpoint
async function queryGrokAI(prompt) {
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'mixtral-8x7b-32768', // or another Groq model
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
