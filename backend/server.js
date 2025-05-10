const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for frontend
app.use(express.json());

// API configurations
const BETTER_STACK_TOKEN = process.env.BETTER_STACK_TOKEN;
const BETTER_STACK_LOGS_ENDPOINT = 'https://telemetry.betterstack.com/api/v2/query/live-tail';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/coins/markets';
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const COINMARKETCAP_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';

// Endpoint to fetch live logs from Better Stack
app.get('/logs', async (req, res) => {
  try {
    const params = {
      source_ids: '1303816', // Provided source ID
      query: req.query.query || 'level=info', // Default to info logs; frontend can override
      batch: req.query.batch || 100, // Default to 100 rows
      from: req.query.from || new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Last 30 minutes
      to: req.query.to || new Date().toISOString(), // Current time
      order: req.query.order || 'newest_first', // Default to newest first
    };

    const response = await axios.get(BETTER_STACK_LOGS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${BETTER_STACK_TOKEN}`,
      },
      params,
      maxRedirects: 5, // Follow redirects as per Better Stack docs
    });

    res.json({
      logs: response.data.data, // Return log rows
      next: response.data.pagination?.next, // Pagination URL for next batch
    });
  } catch (error) {
    console.error('Error fetching logs:', error.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Endpoint to fetch token statistics (CoinGecko by default, CoinMarketCap optional)
app.get('/token-stats', async (req, res) => {
  const provider = req.query.provider || 'coingecko'; // Default to CoinGecko
  const symbols = req.query.symbols?.split(',') || ['bitcoin', 'ethereum', 'binancecoin']; // Default tokens

  try {
    if (provider === 'coinmarketcap') {
      // CoinMarketCap API
      const response = await axios.get(COINMARKETCAP_API_URL, {
        headers: {
          'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
        },
        params: {
          limit: 100, // Adjust as needed
        },
      });

      // Filter for requested symbols
      const filteredData = response.data.data.filter(coin =>
        symbols.includes(coin.slug)
      ).map(coin => ({
        id: coin.slug,
        name: coin.name,
        symbol: coin.symbol,
        price: coin.quote.USD.price,
        volume_24h: coin.quote.USD.volume_24h,
        market_cap: coin.quote.USD.market_cap,
      }));

      res.json(filteredData);
    } else {
      // CoinGecko API
      const response = await axios.get(COINGECKO_API_URL, {
        headers: {
          'x-cg-api-key': COINGECKO_API_KEY,
        },
        params: {
          vs_currency: 'usd',
          ids: symbols.join(','),
          order: 'market_cap_desc',
          per_page: 100,
          page: 1,
          sparkline: false,
        },
      });

      res.json(response.data);
    }
  } catch (error) {
    console.error(`Error fetching token stats from ${provider}:`, error.message);
    res.status(500).json({ error: `Failed to fetch token stats from ${provider}` });
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
