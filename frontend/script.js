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
const mockLogs = [
  { timestamp: new Date().toISOString(), message: 'Dashboard initialized', level: 'info' },
  { timestamp: new Date().toISOString(), message: 'Using mock data', level: 'warn' }
];

// --- Ice King Puns for Marquee ---
const iceKingPuns = [
  "Everything is Going to be okay! ❄️👑",
  "Penguins are my royal guards! 🐧🧊",
  "Time to freeze the market! ❄️😂",
  "Ice to meet you, traders! 🧊🐧",
  "I’m the coolest king around! 👑❄️",
  "Penguin power activate! 🐧🧊😂",
  "Snow way I’m missing this trade! ❄️📈",
  "Freeze your doubts, let’s trade! 🧊💸",
  "I’m skating through the market! ⛸️❄️",
  "Cold cash, hot trades! 🥶💰",
  "My portfolio’s cooler than ice! ❄️📊",
  "Chill out, I’ve got this! 🧊😎",
  "Ice King’s here to rule the charts! 👑📉",
  "Let’s make it snow profits! ❄️💵",
  "I’m frosting the competition! 🧊🏆",
  "Cool trades, warm wins! ❄️🔥"
];

// --- Global State ---
let usedPuns = [];
let currentToken = mockTokens[0];
let currentTimeframe = '1d';
let allTokens = mockTokens;
let sortedTokens = [...mockTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
let isChartDocked = false;
let selectedTokenLi = null;
let logs = mockLogs;

// --- Utility Functions ---

// Fetch with retry (using Render logs instead of Papertrail)
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DEBUG] Fetching ${url} (Attempt ${i + 1}/${retries})`);
      const response = await fetch(url, { timeout: 5000 });
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
        console.error(`[ERROR] All retries failed for ${url}, using fallback`);
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
  })).filter(token => token.current_price > 0); // Filter out invalid tokens
}

// Get random Ice King pun
function getRandomPun() {
  if (usedPuns.length === iceKingPuns.length) usedPuns = [];
  let pun;
  do {
    pun = iceKingPuns[Math.floor(Math.random() * iceKingPuns.length)];
  } while (usedPuns.includes(pun));
  usedPuns.push(pun);
  return pun;
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
    tickerMarqueeHeader.innerHTML = tokens
      .map(token => `<span>[${token.symbol}] $${token.current_price.toLocaleString()} (${token.price_change_percentage_24h.toFixed(2)}%)</span>`)
      .join('');
  }
}

// Select token for chart
function selectToken(token) {
  currentToken = token;
  document.getElementById('chart-title-header').textContent = `> Chart: ${token.name} (${token.symbol})`;
  document.getElementById('chart-title-modal').textContent = `> Chart: ${token.name} (${token.symbol})`;
  updateChart(token.symbol + 'USD');
  if (selectedTokenLi) selectedTokenLi.classList.remove('selected-token');
  selectedTokenLi = event.target.closest('li');
  selectedTokenLi.classList.add('selected-token');
}

// Update chart
function updateChart(symbol) {
  const containerId = isChartDocked ? 'chart-container-header' : 'chart-container-modal';
  new TradingView.widget({
    container_id: containerId,
    width: '100%',
    height: isChartDocked ? '100%' : '80vh',
    symbol: symbol || 'BTCUSD',
    interval: currentTimeframe,
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    toolbar_bg: '#0a0f14',
    enable_publishing: false,
    allow_symbol_change: true,
    details: true,
    studies: ['Volume@tv-basicstudies'],
  });
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

  // Initial fetch and render
  async function initializeData() {
    const data = await fetchWithRetry(`${BACKEND_URL}/api/crypto`);
    if (data) {
      allTokens = sanitizeTokenData(data);
      sortedTokens = [...allTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
      updateTokenList(allTokens);
      updateLiveData(allTokens);
      updateChart(currentToken.symbol + 'USD');
    } else {
      updateTokenList(mockTokens);
      updateLiveData(mockTokens);
    }
  }
  initializeData();

  // Refresh tokens
  setInterval(async () => {
    const data = await fetchWithRetry(`${BACKEND_URL}/api/crypto`);
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
      currentTimeframe = button.id.split('-').pop();
      updateChart(currentToken.symbol + 'USD');
      document.querySelectorAll('.timeframe-btn').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });

  // Toggle sticky chart
  toggleStickyHeader.addEventListener('click', () => {
    isChartDocked = false;
    chartModal.classList.add('active');
    updateChart(currentToken.symbol + 'USD');
  });

  toggleStickyModal.addEventListener('click', () => {
    isChartDocked = true;
    chartModal.classList.remove('active');
    updateChart(currentToken.symbol + 'USD');
  });
});
