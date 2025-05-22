// === Ice King Dashboard Script ===
// Author: ZEL
// Purpose: Display token data, logs, top/bottom performers with TradingView chart and ETH gas fee heatmap
// Features: Terminal-style UI, sticky chart toggle, backend integration, gas price heatmap

// --- Constants and Configuration ---
const BACKEND_URL = 'https://apexomni-backend-fppm.onrender.com';
const TOKEN_REFRESH_INTERVAL = 30000;
const LOG_REFRESH_INTERVAL = 10000;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

// --- Mock Data (Fallback) ---
const mockTokens = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock', high_24h: 61000, low_24h: 59000, market_cap_rank: 1 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock', high_24h: 4100, low_24h: 3900, market_cap_rank: 2, gasPrice: 30 },
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
let currentTimeframe = 'D';
let allTokens = mockTokens;
let sortedTokens = [...mockTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
let isChartDocked = false;
let selectedTokenLi = null;
let isMockData = false;
let isDebugMode = false;
let gasHistory = [];

// --- Utility Functions ---

// Fetch with retry and detailed logging
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DEBUG] Fetching ${url} (Attempt ${i + 1}/${retries})`);
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        timeout: 10000
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log(`[DEBUG] Fetch successful for ${url}, response structure:`, { length: data.length, firstItem: data[0] || data.data?.[0], raw: data });
      return Array.isArray(data) ? data : (data.data || []);
    } catch (error) {
      console.error(`[ERROR] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message, error.stack);
      if (i === retries - 1) {
        console.error(`[ERROR] All retries failed for ${url}. Falling back to mock data.`);
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
  return data.map(token => {
    const processedToken = Array.isArray(token) ? token[0] : token;
    return {
      id: String(processedToken.id || processedToken.slug || '').replace(/[^a-zA-Z0-9-]/g, ''),
      name: String(processedToken.name || 'Unknown').substring(0, 50),
      symbol: String(processedToken.symbol || '').toUpperCase().substring(0, 10),
      current_price: Number(processedToken.current_price || processedToken.quote?.USD?.price || 0),
      total_volume: Number(processedToken.total_volume || processedToken.quote?.USD?.volume_24h || 0),
      price_change_percentage_24h: Number(processedToken.price_change_percentage_24h || processedToken.quote?.USD?.percent_change_24h || 0),
      market_cap: Number(processedToken.market_cap || processedToken.quote?.USD?.market_cap || 0),
      circulating_supply: Number(processedToken.circulating_supply || 0),
      source: String(processedToken.source || 'Unknown'),
      high_24h: Number(processedToken.high_24h || 0),
      low_24h: Number(processedToken.low_24h || 0),
      market_cap_rank: Number(processedToken.market_cap_rank || processedToken.cmc_rank || 0),
      gasPrice: Number(processedToken.gasPrice || 0)
    };
  }).filter(token => token.current_price > 0);
}

// Render ETH gas fee heatmap
async function renderGasHeatmap() {
  const canvas = document.getElementById('gas-heatmap-canvas');
  const ctx = canvas?.getContext('2d');
  const gasList = document.getElementById('gas-heatmap-list');
  const loader = document.getElementById('loader-gas');
  if (!canvas || !ctx || !gasList || !loader) {
    console.error('[ERROR] Gas heatmap elements not found:', { canvas, ctx, gasList, loader });
    return;
  }

  // Ensure canvas is visible and sized correctly
  canvas.style.display = 'block';
  canvas.width = canvas.offsetWidth || 300; // Fallback to 300px if offsetWidth is 0
  canvas.height = 300;
  console.log('[DEBUG] Canvas initialized:', { width: canvas.width, height: canvas.height });

  const maxHistory = 50;

  const updateHeatmap = async () => {
    console.log('[DEBUG] Updating gas heatmap');
    const data = isMockData ? mockTokens : await fetchWithRetry(`${BACKEND_URL}/api/crypto`);
    if (!data || data.length === 0) {
      console.error('[ERROR] No data for gas heatmap');
      loader.textContent = '> Failed to load gas prices';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff0000';
      ctx.font = '14px Fira Code';
      ctx.fillText('No data available', 10, canvas.height / 2);
      return;
    }

    const ethToken = data.find(token => token.symbol === 'ETH');
    if (!ethToken || !ethToken.gasPrice) {
      console.warn('[WARN] No gas price data for ETH');
      loader.textContent = '> No gas price data';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff0000';
      ctx.font = '14px Fira Code';
      ctx.fillText('No gas price data', 10, canvas.height / 2);
      return;
    }

    const gasData = {
      gasPrice: ethToken.gasPrice,
      timestamp: new Date().getTime()
    };
    gasHistory.push(gasData);
    if (gasHistory.length > maxHistory) gasHistory.shift();

    console.log('[DEBUG] Gas history updated:', { length: gasHistory.length, latest: gasData });

    // Update list
    gasList.innerHTML = gasHistory.slice(-5).reverse().map(data => `
      <li class="p-2 rounded bg-black bg-opacity-50 glow-blue">
        <div>Gas Price: ${data.gasPrice} Gwei</div>
        <div class="metric">Time: ${new Date(data.timestamp).toLocaleTimeString()}</div>
      </li>
    `).join('');

    // Render heatmap
    const maxGas = Math.max(...gasHistory.map(d => d.gasPrice), 100);
    const cellWidth = canvas.width / maxHistory;
    const cellHeight = canvas.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gasHistory.forEach((data, i) => {
      const intensity = Math.min(data.gasPrice / maxGas, 1);
      ctx.fillStyle = `rgba(0, 255, 0, ${intensity * 0.8})`;
      ctx.fillRect(i * cellWidth, 0, cellWidth, cellHeight);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
      ctx.strokeRect(i * cellWidth, 0, cellWidth, cellHeight);
    });

    loader.style.display = 'none';
    console.log('[DEBUG] Heatmap rendered successfully');
  };

  // Initial render
  try {
    await updateHeatmap();
  } catch (error) {
    console.error('[ERROR] Initial heatmap render failed:', error);
    loader.textContent = '> Error rendering heatmap';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff0000';
    ctx.font = '14px Fira Code';
    ctx.fillText('Error rendering heatmap', 10, canvas.height / 2);
  }

  // Periodic update
  setInterval(async () => {
    try {
      await updateHeatmap();
    } catch (error) {
      console.error('[ERROR] Heatmap update failed:', error);
      loader.textContent = '> Error updating heatmap';
    }
  }, 60000);
}

// --- DOM Manipulation Functions ---

// Update token list with enhanced visuals
function updateTokenList(tokens) {
  const tokenList = document.getElementById('token-list');
  const loaderTokens = document.getElementById('loader-tokens');
  if (!tokenList || !loaderTokens) {
    console.error('[ERROR] Token list or loader not found');
    return;
  }
  tokenList.innerHTML = '';
  loaderTokens.style.display = 'none';
  console.log('[DEBUG] Updating token list with:', tokens.slice(0, 2));
  tokens.forEach((token, index) => {
    const opacity = 30 + (index / tokens.length) * 40;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const li = document.createElement('li');
    li.className = `gradient-bg p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} z-10`;
    li.setAttribute('data-tooltip', '[Click to toggle chart] ❄️');
    li.setAttribute('data-symbol', `BINANCE:${token.symbol}USDT`);
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
      ${token.symbol === 'ETH' && token.gasPrice ? `<br>> Gas Price: ${token.gasPrice} Gwei` : ''}
    `;
    li.addEventListener('click', () => selectToken(token));
    tokenList.appendChild(li);
  });
}

// Update live price, ticker, and top pairs
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
    tickerMarqueeHeader.innerHTML = marqueeContent.repeat(3);
    tickerMarqueeHeader.style.animationDuration = `${Math.max(60, tokens.length * 5)}s`;

    topPairs.innerHTML = '';
    const usdtPairs = tokens.filter(token => token.symbol && token.symbol !== 'USDT').slice(0, 5).map(token => `${token.symbol}/USDT (#${token.market_cap_rank})`);
    usdtPairs.forEach(pair => {
      const li = document.createElement('li');
      li.className = 'gradient-bg p-1 rounded-md text-sm glow-blue';
      li.innerHTML = `> 🧊 ${pair}`;
      topPairs.appendChild(li);
    });
  } else {
    console.warn('[WARN] No tokens to update live data with');
  }
}

// Update top/bottom performers
function updateProfitPairs(tokens) {
  const profitPairs = document.getElementById('profit-pairs');
  if (!profitPairs) {
    console.error('[ERROR] Profit pairs element not found');
    return;
  }
  profitPairs.innerHTML = '';
  if (tokens.length === 0) {
    console.warn('[WARN] No tokens to update profit pairs with');
    return;
  }
  
  const topPerformers = tokens.slice(0, 3);
  const bottomPerformers = tokens.slice(-3);

  topPerformers.forEach(token => {
    const li = document.createElement('li');
    li.className = 'gradient-bg p-1 rounded-md text-sm top-pair';
    li.innerHTML = `
      > 🤑 ${token.name} (${token.symbol}): ${token.price_change_percentage_24h.toFixed(2)}%
      <br>
      > Price: $${token.current_price.toLocaleString()}
      <br>
      > 24h High: $${token.high_24h.toLocaleString()}
      <br>
      > 24h Low: $${token.low_24h.toLocaleString()}
    `;
    profitPairs.appendChild(li);
  });

  bottomPerformers.forEach(token => {
    const li = document.createElement('li');
    li.className = 'gradient-bg p-1 rounded-md text-sm bottom-pair';
    li.innerHTML = `
      > 🤮 ${token.name} (${token.symbol}): ${token.price_change_percentage_24h.toFixed(2)}%
      <br>
      > Price: $${token.current_price.toLocaleString()}
      <br>
      > 24h High: $${token.high_24h.toLocaleString()}
      <br>
      > 24h Low: $${token.low_24h.toLocaleString()}
    `;
    profitPairs.appendChild(li);
  });
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

// TradingView initialization
function updateChart(symbol) {
  const containerId = isChartDocked ? 'chart-container-header' : 'chart-container-modal';
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[ERROR] Chart container ${containerId} not found`);
    return;
  }
  container.innerHTML = '<div class="loader text-center text-green-400 text-sm">> Loading Chart... ❄️</div>';
  try {
    if (typeof TradingView === 'undefined') {
      throw new Error('TradingView script not loaded');
    }
    new TradingView.widget({
      container_id: containerId,
      width: '100%',
      height: '100%',
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
    setTimeout(() => updateChart('BINANCE:BTCUSDT'), 2000);
  }
}

// Toggle mock data mode
function toggleMockData() {
  isMockData = !isMockData;
  const toggleDataMode = document.getElementById('toggle-data-source');
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
  const profitPairs = document.getElementById('profit-pairs');
  const chartModal = document.getElementById('chart-modal');
  const toggleStickyHeader = document.getElementById('toggle-sticky-header');
  const toggleStickyModal = document.getElementById('toggle-sticky-modal');
  const toggleDataMode = document.getElementById('toggle-data-source');
  const toggleDebug = document.getElementById('toggle-debug');

  if (!tokenList || !loaderTokens || !livePriceHeader || !tickerMarqueeHeader || !topPairs || !profitPairs || !chartModal || !toggleStickyHeader || !toggleStickyModal || !toggleDataMode || !toggleDebug) {
    console.error('[ERROR] One or more DOM elements not found:', { tokenList, loaderTokens, livePriceHeader, tickerMarqueeHeader, topPairs, profitPairs, chartModal, toggleStickyHeader, toggleStickyModal, toggleDataMode, toggleDebug });
