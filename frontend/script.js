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
let currentTimeframe = 'D'; // TradingView uses 'D' for 1-day
let allTokens = mockTokens;
let sortedTokens = [...mockTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
let isChartDocked = false;
let selectedTokenLi = null;
let isMockData = false;
let isDebugMode = false;

// --- Utility Functions ---

// Fetch with retry and detailed logging
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DEBUG] Fetching ${url} (Attempt ${i + 1}/${retries})`);
      const response = await fetch(url, { 
        timeout: 5000,
        headers: { 'Accept': 'application/json' }
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
        document.getElementById('live-price-header').textContent = `> Live Price: Error - Connection unstable (${error.message}) ❄️`;
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

// Update token list with enhanced visuals (display all tokens)
function updateTokenList(tokens) {
  const tokenList = document.getElementById('token-list');
  const loaderTokens = document.getElementById('loader-tokens');
  if (!tokenList || !loaderTokens) {
    console.error('[ERROR] Token list or loader not found');
    return;
  }
  tokenList.innerHTML = '';
  loaderTokens.style.display = 'none';
  tokens.forEach((token, index) => {
    const opacity = 30 + (index / tokens.length) * 40; // Dynamic opacity based on position in list
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const li = document.createElement('li');
    li.className = `gradient-bg p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} z-10`;
    li.setAttribute('data-tooltip', '[Click to toggle chart] ❄️');
    const priceChangeEmoji = token.price_change_percentage_24h >= 0 ? '🤑' : '🤮';
    li.innerHTML = `
      > 🍀 ${token.name} (${token.symbol})
      <br>
      > Price: $${token.current_price.toLocaleString()}
      <br>
      > 24h Change: ${token.price_change_percentage_24h.toFixed(2)}% ${priceChangeEmoji}
      <br>
      > 24h High: $${token.high_24h.toLocaleString()}
      <br>
      > 24h Low: $${token.low_24h.toLocaleString()}
      <br>
      > Market Cap Rank: #${token.market_cap_rank}
      <br>
      > Market Cap: $${token.market_cap.toLocaleString()}
    `;
    li.addEventListener('click', () => selectToken(token));
    tokenList.appendChild(li);
  });
}

// Update live price, ticker, and top pairs with Ice King flair
function updateLiveData(tokens) {
  const livePriceHeader = document.getElementById('live-price-header');
  const tickerMarqueeHeader = document.getElementById('ticker-marquee-header');
  const topPairs = document.getElementById('top-pairs');
  if (!livePriceHeader || !tickerMarqueeHeader || !topPairs) {
    console.error('[ERROR] Live data elements not found');
    return;
  }
  if (tokens.length > 0) {
    const firstToken = tokens[0];
    livePriceHeader.textContent = `> Live Price: $${firstToken.current_price.toLocaleString()} (${firstToken.symbol}) 👑`;
    const uniquePun = iceKingPuns[Math.floor(Math.random() * iceKingPuns.length)] || 'Chill out, I’ve got this! 🧊😎';
    const marqueeContent = [
      ...tokens.slice(0, 5).map(token => `<span class="glow-green">[${token.symbol}] $${token.current_price.toLocaleString()} (${token.price_change_percentage_24h.toFixed(2)}%)</span>`),
      `<span class="glow-purple">[${uniquePun}]</span>`
    ].join('');
    tickerMarqueeHeader.innerHTML = marqueeContent.repeat(3); // Triple for continuous scroll
    tickerMarqueeHeader.style.animationDuration = `${Math.max(60, tokens.length * 5)}s`;

    topPairs.innerHTML = '';
    const usdtPairs = tokens.filter(token => token.symbol && token.symbol !== 'USDT').slice(0, 5).map(token => `${token.symbol}/USDT (#${token.market_cap_rank})`);
    usdtPairs.forEach(pair => {
      const li = document.createElement('li');
      li.className = 'gradient-bg p-1 rounded-md text-sm glow-blue';
      li.innerHTML = `> 🧊 ${pair}`;
      topPairs.appendChild(li);
    });
  }
}

// Select token for chart
function selectToken(token) {
  currentToken = token;
  const chartTitleHeader = document.getElementById('chart-title-header');
  const chartTitleModal = document.getElementById('chart-title-modal');
  if (chartTitleHeader) chartTitleHeader.textContent = `> Chart: ${token.name} (${token.symbol}) ❄️`;
  if (chartTitleModal) chartTitleModal.textContent = `> Chart: ${token.name} (${token.symbol}) ❄️`;
  updateChart(`BINANCE:${token.symbol}USDT`);
  if (selectedTokenLi) selectedTokenLi.classList.remove('selected-token');
  selectedTokenLi = event.target.closest('li');
  if (selectedTokenLi) selectedTokenLi.classList.add('selected-token');
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

// Update chart with loading indicator and debug support
function updateChart(symbol) {
  const containerId = isChartDocked ? 'chart-container-header' : 'chart-container-modal';
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[ERROR] Chart container ${containerId} not found`);
    return;
  }
  container.innerHTML = '<div class="loader text-center text-green-400 text-sm">> Loading Chart... ❄️</div>'; // Ice King-themed loader
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
        overrides: {
          "paneProperties.background": "#0a0f14",
          "mainSeriesProperties.candleStyle.upColor": "#00ff00",
          "mainSeriesProperties.candleStyle.downColor": "#ff0000"
        }
      });
      console.log(`[DEBUG] TradingView widget initialized for ${symbol} on interval ${currentTimeframe}`);
      if (isDebugMode) alert(`Chart initialized for ${symbol} on ${currentTimeframe}`);
    } catch (error) {
      console.error('[ERROR] Failed to initialize TradingView widget:', error);
      container.innerHTML = `<div class="text-red-500 text-sm">> Chart failed: ${error.message} 🧊</div>`;
      if (isDebugMode) alert(`Chart failed: ${error.message}`);
      setTimeout(() => updateChart('BINANCE:BTCUSDT'), 2000); // Retry with BTC as fallback
    }
  });
}

// Toggle mock data mode
function toggleMockData() {
  isMockData = !isMockData;
  const toggleDataMode = document.getElementById('toggle-data-mode');
  if (toggleDataMode) toggleDataMode.textContent = `[${isMockData ? 'Real' : 'Mock'} Data] ❄️`;
  initializeData();
}

// Toggle debug mode
function toggleDebugMode() {
  isDebugMode = !isDebugMode;
  const toggleDebug = document.getElementById('toggle-debug');
  if (toggleDebug) toggleDebug.textContent = `[${isDebugMode ? 'Disable' : 'Enable'} Debug] 👑`;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  const tokenList = document.getElementById('token-list');
  const loaderTokens = document.getElementById('loader-tokens');
  const livePriceHeader = document.getElementById('live-price-header');
  const tickerMarqueeHeader = document.getElementById('ticker-marquee-header');
  const topPairs = document.getElementById('top-pairs');
  const chartModal = document.getElementById('chart-modal');
  const toggleStickyHeader = document.getElementById('toggle-sticky-header');
  const toggleStickyModal = document.getElementById('toggle-sticky-modal');
  const toggleDataMode = document.getElementById('toggle-data-mode');
  const toggleDebug = document.getElementById('toggle-debug');

  if (!tokenList || !loaderTokens || !livePriceHeader || !tickerMarqueeHeader || !topPairs || !chartModal || !toggleStickyHeader || !toggleStickyModal || !toggleDataMode || !toggleDebug) {
    console.error('[ERROR] One or more DOM elements not found:', { tokenList, loaderTokens, livePriceHeader, tickerMarqueeHeader, topPairs, chartModal, toggleStickyHeader, toggleStickyModal, toggleDataMode, toggleDebug });
    return;
  }

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
      updateChart(`BINANCE:${currentToken.symbol}USDT`);
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
    isChartDocked = !isChartDocked;
    chartModal.classList.toggle('active', !isChartDocked);
    toggleStickyHeader.textContent = `[${isChartDocked ? 'Undock' : 'Dock'} Chart] ❄️`;
    toggleStickyHeader.classList.toggle('bg-green-500', isChartDocked);
    toggleStickyHeader.classList.toggle('bg-blue-500', !isChartDocked);
    updateChart(`BINANCE:${currentToken.symbol}USDT`);
  });

  toggleStickyModal.addEventListener('click', () => {
    isChartDocked = !isChartDocked;
    chartModal.classList.toggle('active', !isChartDocked);
    toggleStickyModal.textContent = `[${isChartDocked ? 'Undock' : 'Dock'} Chart] ❄️`;
    toggleStickyModal.classList.toggle('bg-green-500', isChartDocked);
    toggleStickyModal.classList.toggle('bg-blue-500', !isChartDocked);
    updateChart(`BINANCE:${currentToken.symbol}USDT`);
  });

  // Toggle mock data
  toggleDataMode.addEventListener('click', toggleMockData);

  // Toggle debug mode
  toggleDebug.addEventListener('click', toggleDebugMode);
});
