import { Logtail } from "@logtail/browser";

// === Ice King Dashboard Script ===
// Author: ZEL
// Purpose: Display token data and logs with TradingView chart
// Features: Terminal-style UI, sticky chart toggle, backend integration

// --- Constants and Configuration ---
const BACKEND_URL = 'https://apexomni-backend-fppm.onrender.com';
const TOKEN_REFRESH_INTERVAL = 300000; // 5 minutes
const LOG_REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

// Initialize Logtail for browser logging
const logtail = new Logtail("x5nvK7DNDURcpAHEBuCbHrza", {
  endpoint: 'https://s1303816.eu-nbg-2.betterstackdata.com',
});

// --- Mock Data (Fallback) ---
const mockTokens = [
  { id: 1, name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock' },
  { id: 1027, name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock' },
  { id: 9999, name: 'ConstitutionDAO', symbol: 'PEOPLE', current_price: 0.01962, total_volume: 135674.745, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock' }
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
let currentToken = null;
let currentTimeframe = '1D'; // Default to 1 day
let allTokens = [];
let sortedTokens = [];
let isChartDocked = false;
let selectedTokenLi = null;

// --- Utility Functions ---

// Fetch with retry
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DEBUG] Fetching ${url} (Attempt ${i + 1}/${retries})`);
      const response = await fetch(url, { timeout: 10000 });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log(`[DEBUG] Fetch successful for ${url}, response:`, data);
      return data;
    } catch (error) {
      console.error(`[ERROR] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
      if (error.message.includes('429')) {
        console.warn('Rate limit hit, increasing delay for next attempt');
        delay = 10000; // Back off to 10 seconds on 429
      }
      await logtail.error(`Fetch failed: ${error.message}`, { url, attempt: i + 1, retries, errorDetails: error.stack });
      if (i === retries - 1) {
        console.error(`[ERROR] All retries failed for ${url}`);
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
    logtail.error('Invalid token data format', { data });
    return [];
  }
  const sanitized = data.map(token => ({
    id: String(token.id || '').replace(/[^a-zA-Z0-9-]/g, ''),
    name: String(token.name || 'Unknown').substring(0, 50),
    symbol: String(token.symbol || '').toUpperCase().substring(0, 10),
    total_volume: Number(token.total_volume || token.volume_24h || 0),
    current_price: Number(token.current_price || token.price || 0),
    price_change_percentage_24h: Number(token.price_change_percentage_24h || token.percent_change_24h || 0),
    market_cap: Number(token.market_cap || 0),
    circulating_supply: Number(token.circulating_supply || 0),
    source: String(token.source || 'Coinpaprika')
  })).filter(token => token.symbol && token.current_price > 0);
  console.log('[DEBUG] Sanitized token data:', sanitized);
  return sanitized.length > 0 ? sanitized : mockTokens; // Fallback to mock data
}

// Validate and sanitize log data
function sanitizeLogData(data) {
  if (!data || !Array.isArray(data)) {
    console.error('[ERROR] Invalid log data format, expected array:', data);
    logtail.error('Invalid log data format', { data });
    return [];
  }
  const sanitized = data.map(log => ({
    timestamp: log.dt || new Date().toISOString(),
    message: String(log.message || log.body || 'No message').substring(0, 200),
    level: String(log.level || 'info').toLowerCase()
  }));
  console.log('[DEBUG] Sanitized log data:', sanitized);
  return sanitized;
}

// Cache data
function cacheData(data, type = 'tokens') {
  localStorage.setItem(`${type}Data`, JSON.stringify(data));
  localStorage.setItem(`${type}LastUpdate`, Date.now());
  console.log(`[DEBUG] Cached ${type} data`);
}

// Load cached data
function loadCachedData(type = 'tokens') {
  const cached = localStorage.getItem(`${type}Data`);
  const lastUpdate = localStorage.getItem(`${type}LastUpdate`);
  if (cached && lastUpdate && (Date.now() - lastUpdate < 5 * 60 * 1000)) {
    console.log(`[DEBUG] Using cached ${type} data`);
    return JSON.parse(cached);
  }
  console.log(`[DEBUG] No valid cached ${type} data`);
  return null;
}

// Fetch token data from backend
async function fetchTokenData() {
  console.log('[DEBUG] Fetching token data from backend');
  const url = `${BACKEND_URL}/api/crypto`;
  console.log('[DEBUG] Token fetch URL:', url);
  const data = await fetchWithRetry(url);
  if (data) {
    console.log('[DEBUG] Received token data:', data);
    return sanitizeTokenData(data);
  }
  console.warn('[WARN] No valid backend token data, using mock data');
  await logtail.warn('Fallback to mock token data');
  alert('Using mock token data due to backend failure. Check console for errors.');
  return sanitizeTokenData(mockTokens);
}

// Fetch logs from backend
async function fetchLogs() {
  console.log('[DEBUG] Fetching logs from backend');
  const url = `${BACKEND_URL}/api/logs`;
  console.log('[DEBUG] Log fetch URL:', url);
  const data = await fetchWithRetry(url);
  if (data && Array.isArray(data)) {
    console.log('[DEBUG] Received log data:', data);
    return sanitizeLogData(data);
  }
  console.warn('[WARN] No valid log data, returning empty array');
  await logtail.warn('No valid log data from backend');
  alert('No logs available due to backend failure. Check console for errors.');
  return [];
}

// Update tokens
async function updateTokens() {
  console.log('[DEBUG] Entering updateTokens');
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');

  if (!tokenList || !loader || !topPairs) {
    console.error('[ERROR] DOM elements missing: tokenList=', tokenList, 'loader=', loader, 'topPairs=', topPairs);
    await logtail.error('Missing DOM elements in updateTokens', { tokenList, loader, topPairs });
    return;
  }

  loader.style.display = 'flex';
  console.log('[DEBUG] DOM elements found, starting token fetch');

  let tokens = loadCachedData('tokens');
  if (!tokens) {
    tokens = await fetchTokenData();
    cacheData(tokens, 'tokens');
  } else {
    console.log('[DEBUG] Using cached token data immediately');
    allTokens = tokens;
    sortedTokens = [...tokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    renderTokenList();
    renderTopPairs();
  }

  allTokens = tokens;
  sortedTokens = [...tokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  renderTokenList();
  renderTopPairs();

  if (!currentToken && allTokens.length > 0) {
    currentToken = allTokens[0];
    showPriceChart(currentToken, currentTimeframe, 'header');
    console.log(`[DEBUG] Defaulted to token: ${currentToken.symbol}`);
  } else if (allTokens.length === 0) {
    currentToken = mockTokens[0];
    showPriceChart(currentToken, currentTimeframe, 'header');
    console.warn('[WARN] No tokens from backend, using mock token for chart');
    await logtail.warn('No tokens available, using mock for chart');
  }

  loader.style.display = 'none';
  console.log('[DEBUG] Tokens updated');
}

// Render token list and top pairs
function renderTokenList() {
  const tokenList = document.getElementById('token-list');
  tokenList.innerHTML = '';
  if (sortedTokens.length > 0) {
    sortedTokens.forEach((token, index) => {
      console.log('[DEBUG] Rendering token:', token.symbol);
      const opacity = 30 + (index / sortedTokens.length) * 40;
      const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
      const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
      const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
      const li = document.createElement('li');
      li.className = `p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} ${hoverClass} z-10 gradient-bg`;
      li.setAttribute('data-tooltip', '[Click to toggle chart]');
      const priceChange = token.price_change_percentage_24h;
      const priceChangeEmoji = priceChange >= 0 ? '🤑' : '🤮';
      const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';
      li.innerHTML = `
        <div class="flex flex-col space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-medium truncate">[🍀 ${token.name} (${token.symbol})]</span>
            <span class="text-xs">[Vol: $${token.total_volume.toLocaleString()}]</span>
          </div>
          <div class="text-xs">
            <p>[Price: $${token.current_price.toLocaleString()}]</p>
            <p class="${priceChangeColor}">[24h: ${priceChange.toFixed(2)}% ${priceChangeEmoji}]</p>
            <p>[Market Cap: $${token.market_cap.toLocaleString()}]</p>
            <p>[Circulating Supply: ${token.circulating_supply.toLocaleString()} ${token.symbol}]</p>
            <p>[Source: ${token.source}]</p>
          </div>
        </div>`;
      li.addEventListener('click', () => {
        if (selectedTokenLi) selectedTokenLi.classList.remove('selected-token');
        li.classList.add('selected-token');
        selectedTokenLi = li;
        currentToken = token;
        showPriceChart(token, currentTimeframe, isChartDocked ? 'modal' : 'header');
        console.log(`[DEBUG] Selected token: ${token.symbol}`);
      });
      tokenList.appendChild(li);
    });
  } else {
    console.warn('[WARN] No tokens to render');
    await logtail.warn('No tokens available to render');
    tokenList.innerHTML = '<li class="p-2 text-red-400 gradient-bg">[No token data available]</li>';
  }
}

function renderTopPairs() {
  const topPairs = document.getElementById('top-pairs');
  topPairs.innerHTML = sortedTokens.slice(0, 5).map((token, index) => {
    const opacity = 20 + (index / 4) * 30;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    return `<li class="px-2 py-1 rounded ${bgColor} hover-glow transition ${glowClass} ${hoverClass} gradient-bg">[${token.symbol}/USDT]</li>`;
  }).join('');
}

// Update logs
async function updateLogs() {
  console.log('[DEBUG] Entering updateLogs');
  const logList = document.getElementById('log-list');
  const loader = document.getElementById('loader-logs');

  if (!logList || !loader) {
    console.error('[ERROR] DOM elements missing: logList=', logList, 'loader=', loader);
    await logtail.error('Missing DOM elements in updateLogs', { logList, loader });
    return;
  }

  loader.style.display = 'flex';
  console.log('[DEBUG] DOM elements found, starting log fetch');

  let logs = loadCachedData('logs');
  if (!logs) {
    logs = await fetchLogs();
    cacheData(logs, 'logs');
  } else {
    console.log('[DEBUG] Using cached log data immediately');
    renderLogList();
  }

  renderLogList();
  loader.style.display = 'none';
  console.log('[DEBUG] Logs updated');
}

function renderLogList() {
  const logList = document.getElementById('log-list');
  logList.innerHTML = '';
  if (logs && logs.length > 0) {
    logs.forEach(log => {
      console.log('[DEBUG] Rendering log:', log.message);
      const li = document.createElement('li');
      const levelColor = log.level === 'error' ? 'text-red-400 glow-red' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400 glow-green';
      const date = new Date(log.timestamp);
      date.setHours(date.getHours() + 1); // GMT+1 offset
      li.className = `p-2 rounded-md bg-gray-800/50 text-xs fade-in ${levelColor} gradient-bg`;
      li.innerHTML = `
        <div class="flex flex-col">
          <span>[${date.toLocaleString()}]</span>
          <span>[${log.level.toUpperCase()}] ${log.message}</span>
        </div>`;
      logList.appendChild(li);
    });
  } else {
    console.warn('[WARN] No logs to render');
    await logtail.warn('No logs available to render');
    logList.innerHTML = '<li class="p-2 text-red-400 gradient-bg">[No log data available]</li>';
  }
}

// Show price chart using TradingView with robust fallback
function showPriceChart(token, timeframe, context = 'header') {
  console.log(`[DEBUG] Showing price chart for ${token.symbol} (Timeframe: ${timeframe}) in ${context} context`);
  const chartContainer = document.getElementById(`chart-container-${context}`);
  const chartTitle = document.getElementById(`chart-title-${context}`);
  const livePriceElement = document.getElementById(`live-price-${context}`);

  if (!chartContainer || !chartTitle || !livePriceElement) {
    console.error(`[ERROR] Missing DOM element for ${context} chart: container=${chartContainer}, title=${chartTitle}, price=${livePriceElement}`);
    logtail.error(`Missing DOM element for ${context} chart`, { context, chartContainer, chartTitle, livePriceElement });
    return;
  }

  chartContainer.innerHTML = '<div class="tradingview-widget-container" style="height: 100%; width: 100%;"></div>';

  const symbolMap = {
    'BTC': 'BINANCE:BTCUSDT',
    'ETH': 'BINANCE:ETHUSDT',
    'BNB': 'BINANCE:BNBUSDT',
    'FLOKI': 'BINANCE:FLOKIUSDT',
    'SHIB': 'BINANCE:SHIBUSDT',
    'PEOPLE': 'BINANCE:PEOPLEUSDT'
  };
  const tvSymbol = symbolMap[token.symbol] || `BINANCE:${token.symbol}USDT` || 'BINANCE:BTCUSDT'; // Fallback to BTC
  const timeframeMap = {
    '1min': '1',
    '5min': '5',
    '15min': '15',
    '1hr': '60',
    '4hr': '240',
    '1d': 'D'
  };
  const interval = timeframeMap[timeframe.toLowerCase()] || 'D';

  try {
    new TradingView.widget({
      container_id: `tradingview_${context}_${Date.now()}`,
      width: '100%',
      height: '100%',
      symbol: tvSymbol,
      interval: interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#0a0f14',
      enable_publishing: false,
      allow_symbol_change: false,
      hide_top_toolbar: true,
      hide_side_toolbar: true,
      backgroundColor: '#0a0f14',
      gridLineColor: 'rgba(0, 255, 0, 0.1)',
      overrides: {
        "paneProperties.background": "#0a0f14",
        "paneProperties.gridProperties.color": "rgba(0, 255, 0, 0.1)",
        "mainSeriesProperties.candleStyle.upColor": "#00ff00",
        "mainSeriesProperties.candleStyle.downColor": "#ff0000",
        "mainSeriesProperties.candleStyle.borderUpColor": "#00ff00",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ff0000",
        "mainSeriesProperties.candleStyle.wickUpColor": "#00ff00",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ff0000"
      },
      loading_screen: { backgroundColor: '#0a0f14', foregroundColor: '#00ff00' }
    });
    console.log('[DEBUG] TradingView chart initialized');
  } catch (error) {
    console.error('[ERROR] Failed to initialize TradingView chart:', error);
    chartContainer.innerHTML = `<div class="text-red-400 text-center p-4">Chart failed to load. Using fallback for ${token.symbol}. Error: ${error.message}</div>`;
    logtail.error(`Failed to initialize TradingView chart: ${error.message}`, { token: token.symbol, timeframe, context });
  }

  chartTitle.textContent = `> ${token.symbol} Price Chart`;
  livePriceElement.textContent = `> Live Price: $${token.current_price.toLocaleString()}`;
  console.log('[DEBUG] Price chart rendered');
}

// Update marquee with continuous content
function updateMarquee() {
  console.log('[DEBUG] Entering updateMarquee');
  const marqueeElements = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];

  if (!marqueeElements[0] || !marqueeElements[1]) {
    console.error('[ERROR] Marquee elements missing:', marqueeElements);
    logtail.error('Marquee elements missing', { marqueeElements });
    return;
  }

  function getUniquePun() {
    if (usedPuns.length === iceKingPuns.length) usedPuns = [];
    const availablePuns = iceKingPuns.filter(pun => !usedPuns.includes(pun));
    const selectedPun = availablePuns[Math.floor(Math.random() * availablePuns.length)] || 'Everything is Going to be okay! ❄️👑';
    usedPuns.push(selectedPun);
    return selectedPun;
  }

  const winners = sortedTokens.filter(t => t.price_change_percentage_24h > 0).slice(0, 3);
  const losers = sortedTokens.filter(t => t.price_change_percentage_24h < 0).slice(-3);
  const currentPun = getUniquePun();
  const fillerItems = ['🎉', '🚀', '💰', '📊', '🧊', '👑'].map(emoji => `<span class="glow-purple">[${emoji}]</span>`); // Ensure no black space
  const marqueeItems = [
    ...winners.map(t => `<span class="glow-green text-green-400">[🏆 ${t.symbol}: +${t.price_change_percentage_24h.toFixed(2)}%]</span>`),
    `<span class="glow-purple text-green-400">[${currentPun}]</span>`,
    ...losers.map(t => `<span class="glow-red text-red-400">[📉 ${t.symbol}: ${t.price_change_percentage_24h.toFixed(2)}%]</span>`),
    ...fillerItems
  ];
  const doubledItems = [...marqueeItems, ...marqueeItems, ...fillerItems]; // Double and add fillers for continuous scroll
  marqueeElements.forEach(element => {
    element.innerHTML = doubledItems.join('');
  });
  console.log('[DEBUG] Marquee updated');
}

// Initialize dashboard
function initializeDashboard() {
  console.log('[DEBUG] Initializing Ice King Dashboard...');
  updateTokens();
  setInterval(updateTokens, TOKEN_REFRESH_INTERVAL);
  updateLogs();
  setInterval(updateLogs, LOG_REFRESH_INTERVAL);
  updateMarquee();
  setInterval(updateMarquee, 20000);

  const timeframes = ['1min', '5min', '15min', '1hr', '4hr', '1d'];
  ['header', 'modal'].forEach(context => {
    timeframes.forEach(tf => {
      const btn = document.getElementById(`${context}-timeframe-${tf}`);
      if (btn) {
        btn.addEventListener('click', () => {
          timeframes.forEach(t => {
            const tBtn = document.getElementById(`${context}-timeframe-${t}`);
            if (tBtn) tBtn.classList.remove('active');
          });
          btn.classList.add('active');
          currentTimeframe = tf;
          if (currentToken) showPriceChart(currentToken, currentTimeframe, context);
          console.log(`[DEBUG] Timeframe changed to ${tf} in ${context}`);
        });
      } else {
        console.warn(`[WARN] Timeframe button ${context}-timeframe-${tf} not found`);
        logtail.warn(`Missing timeframe button ${context}-timeframe-${tf}`);
      }
    });
  });

  const toggleDockBtnHeader = document.getElementById('toggle-sticky-header');
  const toggleDockBtnModal = document.getElementById('toggle-sticky-modal');
  const chartModal = document.getElementById('chart-modal');

  if (!toggleDockBtnHeader || !toggleDockBtnModal || !chartModal) {
    console.error('[ERROR] Dock toggle elements missing:', toggleDockBtnHeader, toggleDockBtnModal, chartModal);
    logtail.error('Dock toggle elements missing', { toggleDockBtnHeader, toggleDockBtnModal, chartModal });
    return;
  }

  const toggleChartDock = () => {
    isChartDocked = !isChartDocked;
    chartModal.classList.toggle('active', isChartDocked);
    toggleDockBtnHeader.textContent = isChartDocked ? '[Dock Chart 🔍]' : '[Dock Chart 🔍]';
    toggleDockBtnModal.textContent = isChartDocked ? '[Undock Chart 🔍]' : '[Undock Chart 🔍]';
    toggleDockBtnHeader.classList.toggle('bg-green-500', isChartDocked);
    toggleDockBtnHeader.classList.toggle('bg-blue-500', !isChartDocked);
    toggleDockBtnModal.classList.toggle('bg-green-500', isChartDocked);
    toggleDockBtnModal.classList.toggle('bg-blue-500', !isChartDocked);
    toggleDockBtnHeader.classList.toggle('hover:bg-green-600', isChartDocked);
    toggleDockBtnHeader.classList.toggle('hover:bg-blue-600', !isChartDocked);
    toggleDockBtnModal.classList.toggle('hover:bg-green-600', isChartDocked);
    toggleDockBtnModal.classList.toggle('hover:bg-blue-600', !isChartDocked);
    if (isChartDocked && currentToken) showPriceChart(currentToken, currentTimeframe, 'modal');
    console.log(`[DEBUG] Chart dock toggled: ${isChartDocked ? 'Docked' : 'Undocked'}`);
  };

  toggleDockBtnHeader.addEventListener('click', toggleChartDock);
  toggleDockBtnModal.addEventListener('click', toggleChartDock);
  chartModal.addEventListener('click', (e) => {
    if (e.target === chartModal) toggleChartDock();
  });

  console.log('[DEBUG] Dashboard initialization complete');
}

// Start the dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('[DEBUG] DOMContentLoaded event fired');
  initializeDashboard();
});

// Ensure logs are sent to BetterStack before the page unloads
window.addEventListener('beforeunload', () => {
  logtail.flush();
});
