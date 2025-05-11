// === Ice King Dashboard Script ===
// Author: ZEL
// Purpose: Display token data and logs with TradingView chart
// Features: Terminal-style UI, sticky chart toggle, backend integration

// --- Constants and Configuration ---
const BACKEND_URL = 'https://apexomni-backend-fppm.onrender.com';
const TOKEN_REFRESH_INTERVAL = 30000;
const LOG_REFRESH_INTERVAL = 10000;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

// --- Mock Data (Immediate Fallback) ---
const mockTokens = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock', high_24h: 61000, low_24h: 59000, market_cap_rank: 1 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock', high_24h: 4100, low_24h: 3900, market_cap_rank: 2 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', current_price: 0.01962, total_volume: 135674.745, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', high_24h: 0.020, low_24h: 0.018, market_cap_rank: 150 }
];

// --- Global State ---
let usedPuns = [];
let currentToken = mockTokens[0];
let currentTimeframe = 'D'; // TradingView uses 'D' for 1-day
let allTokens = mockTokens;
let sortedTokens = [...mockTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
let isChartDocked = false;
let selectedTokenLi = null;
let isMockData = false;

// --- Utility Functions ---

// Fetch with retry and detailed logging
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DEBUG] Fetching ${url} (Attempt ${i + 1}/${retries})`);
      const response = await fetch(url, { 
        timeout: 5000,
        headers: { 'Accept': 'application/json' } // Ensure JSON response
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log(`[DEBUG] Fetch successful for ${url}, response:`, data);
      return data;
    } catch (error) {
      console.error(`[ERROR] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
      if (i === retries - 1) {
        console.error(`[ERROR] All retries failed for ${url}. Falling back to ${isMockData ? 'mock' : 'previous'} data.`);
        document.getElementById('live-price-header').textContent = `> Live Price: Error - Connection unstable (${error.message})`;
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Validate and sanitize token data
function sanitizeTokenData(data) {
  if (!data || !Array.isArray(data)) {
    console.error('[ERROR] Invalid token data format, expected array:', data);
    return mockTokens;
  }
  return data.map(token => ({
    id: String(token.id || '').replace(/[^a-zA-Z0-9-]/g, ''),
    name: String(token.name || 'Unknown').substring(0, 50),
    symbol: String(token.symbol || '').toUpperCase().substring(0, 10),
    current_price: Number(token.current_price || 0),
    total_volume: Number(token.total_volume || 0),
    price_change_percentage_24h: Number(token.price_change_percentage_24h || 0),
    market_cap: Number(token.market_cap || 0),
    circulating_supply: Number(token.circulating_supply || 0),
    source: String(token.source || 'Unknown'),
    high_24h: Number(token.high_24h || 0),
    low_24h: Number(token.low_24h || 0),
    market_cap_rank: Number(token.market_cap_rank || 0)
  })).filter(token => token.current_price > 0);
}

// --- DOM Manipulation Functions ---

// Update token list
function updateTokenList(tokens) {
  const tokenList = document.getElementById('token-list');
  const loaderTokens = document.getElementById('loader-tokens');
  tokenList.innerHTML = '';
  loaderTokens.style.display = 'none';
  tokens.slice(0, 10).forEach(token => {
    const li = document.createElement('li');
    li.className = 'gradient-bg p-2 rounded hover-glow hover-performance-green selected-token';
    li.innerHTML = `
      > ${token.name} (${token.symbol})
      <br>
      > Price: $${token.current_price.toLocaleString()}
      <br>
      > 24h Change: ${token.price_change_percentage_24h.toFixed(2)}%
      <br>
      > Market Cap: $${token.market_cap.toLocaleString()}
    `;
    li.addEventListener('click', () => selectToken(token));
    tokenList.appendChild(li);
  });
}

// Update live price and ticker
function updateLiveData(tokens) {
  const livePriceHeader = document.getElementById('live-price-header');
  const tickerMarqueeHeader = document.getElementById('ticker-marquee-header');
  if (tokens.length > 0) {
    const firstToken = tokens[0];
    livePriceHeader.textContent = `> Live Price: $${firstToken.current_price.toLocaleString()} (${firstToken.symbol})`;
    const marqueeContent = tokens
      .map(token => `<span>[${token.symbol}] $${token.current_price.toLocaleString()} (${token.price_change_percentage_24h.toFixed(2)}%)</span>`)
      .join('');
    tickerMarqueeHeader.innerHTML = marqueeContent;
    const duration = Math.max(60, tokens.length * 2); // Dynamic duration based on number of tokens
    tickerMarqueeHeader.style.animationDuration = `${duration}s`;
  }
}

// Select token for chart
function selectToken(token) {
  currentToken = token;
  document.getElementById('chart-title-header').textContent = `> Chart: ${token.name} (${token.symbol})`;
  document.getElementById('chart-title-modal').textContent = `> Chart: ${token.name} (${token.symbol})`;
  updateChart(`BINANCE:${token.symbol}USDT`); // Changed to Binance exchange
  if (selectedTokenLi) selectedTokenLi.classList.remove('selected-token');
  selectedTokenLi = event.target.closest('li');
  selectedTokenLi.classList.add('selected-token');
}

// Ensure TradingView script is loaded before initializing widget
function loadTradingViewScript(callback) {
  if (typeof TradingView !== 'undefined') {
    callback();
    return;
  }
  const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
  if (!existingScript) {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      console.log('[DEBUG] TradingView script loaded');
      callback();
    };
    script.onerror = () => {
      console.error('[ERROR] Failed to load TradingView script');
    };
    document.head.appendChild(script);
  } else {
    const interval = setInterval(() => {
      if (typeof TradingView !== 'undefined') {
        clearInterval(interval);
        console.log('[DEBUG] TradingView script already loaded, proceeding');
        callback();
      }
    }, 100);
  }
}

// Update chart with loading indicator
function updateChart(symbol) {
  const containerId = isChartDocked ? 'chart-container-header' : 'chart-container-modal';
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[ERROR] Chart container ${containerId} not found`);
    return;
  }
  container.innerHTML = '<div class="loader text-center text-gray-500 text-sm">> Loading Chart...</div>'; // Loading indicator
  loadTradingViewScript(() => {
    try {
      new TradingView.widget({
        container_id: containerId,
        width: '100%',
        height: isChartDocked ? '100%' : '80vh',
        symbol: symbol || 'BINANCE:BTCUSDT',
        interval: currentTimeframe,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        backgroundColor: '#0a0f14',
        gridColor: 'rgba(0, 255, 0, 0.1)',
        enable_publishing: false,
        allow_symbol_change: true,
        details: true,
        studies: ['Volume@tv-basicstudies'],
      });
      console.log(`[DEBUG] TradingView widget initialized for ${symbol} on interval ${currentTimeframe}`);
    } catch (error) {
      console.error('[ERROR] Failed to initialize TradingView widget:', error);
      container.innerHTML = `<div class="text-red-500 text-sm">> Chart failed: ${error.message}</div>`;
    }
  });
}

// Toggle mock data mode
function toggleMockData() {
  isMockData = !isMockData;
  document.getElementById('toggle-data-mode').textContent = `[${isMockData ? 'Real' : 'Mock'} Data]`;
  initializeData();
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  const tokenList = document.getElementById('token-list');
  const loaderTokens = document.getElementById('loader-tokens');
  const livePriceHeader = document.getElementById('live-price-header');
  const tickerMarqueeHeader = document.getElementById('ticker-marquee-header');
  const chartModal = document.getElementById('chart-modal');
  const toggleStickyHeader = document.getElementById('toggle-sticky-header');
  const toggleStickyModal = document.getElementById('toggle-sticky-modal');
  const toggleDataMode = document.getElementById('toggle-data-mode');

  // Initial fetch and render
  async function initializeData() {
    const data = isMockData ? mockTokens : await fetchWithRetry(`${BACKEND_URL}/api/crypto`);
    if (data) {
      allTokens = sanitizeTokenData(data);
      sortedTokens = [...allTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
      updateTokenList(allTokens);
      updateLiveData(allTokens);
      updateChart(`BINANCE:${currentToken.symbol}USDT`);
    } else {
      allTokens = mockTokens;
      updateTokenList(allTokens);
      updateLiveData(allTokens);
    }
  }
  initializeData();

  // Refresh tokens
  setInterval(async () => {
    const data = isMockData ? mockTokens : await fetchWithRetry(`${BACKEND_URL}/api/crypto`);
    if (data) {
      allTokens = sanitizeTokenData(data);
      sortedTokens = [...allTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
      updateTokenList(allTokens);
      updateLiveData(allTokens);
    }
  }, TOKEN_REFRESH_INTERVAL);

  // Timeframe buttons
  document.querySelectorAll('.timeframe-btn').forEach(button => {
    button.addEventListener('click', () => {
      const timeframeMap = {
        '1min': '1',
        '5min': '5',
        '15min': '15',
        '1hr': '60',
        '4hr': '240',
        '1d': 'D'
      };
      const timeframeKey = button.id.split('-').pop();
      currentTimeframe = timeframeMap[timeframeKey] || 'D';
      updateChart(`BINANCE:${currentToken.symbol}USDT`);
      document.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });

  // Toggle sticky chart
  toggleStickyHeader.addEventListener('click', () => {
    isChartDocked = false;
    chartModal.classList.add('active');
    updateChart(`BINANCE:${currentToken.symbol}USDT`);
  });

  toggleStickyModal.addEventListener('click', () => {
    isChartDocked = true;
    chartModal.classList.remove('active');
    updateChart(`BINANCE:${currentToken.symbol}USDT`);
  });

  // Toggle mock data
  toggleDataMode.addEventListener('click', toggleMockData);
});
