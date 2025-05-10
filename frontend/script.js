// === Ice King Dashboard Script ===
// Author: Grok 3 @ xAI
// Purpose: Display real and mock token data with TradingView chart
// Features: Terminal-style UI, sticky chart toggle, real data with fallback

// --- Constants and Configuration ---
const BINANCE_API = 'https://api.binance.com/api/v3';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/'; // Public proxy, use with caution
const TOKEN_REFRESH_INTERVAL = 60000; // 1 minute
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// --- Mock Data (Fallback) ---
const mockTokens = [
  { id: 'floki-inu', name: 'FLOKI', symbol: 'FLOKI', total_volume: 4500000, current_price: 0.00015, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 10000000000000, source: 'Mock', score: 52.6 },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', total_volume: 3000000, current_price: 0.000013, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 589000000000000, source: 'Mock', score: 48.9 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', total_volume: 135674.745, current_price: 0.01962, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', score: 70.6 }
];

// --- Ice King Puns for Marquee ---
const iceKingPuns = [
  "I’m chilling like the Ice King! ❄️👑",
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
let isChartLocked = false;
let selectedTokenLi = null;

// --- Utility Functions ---

// Fetch with retry and proxy
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${CORS_PROXY}${url}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`[ERROR] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
      if (i === retries - 1) return null;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Validate and sanitize token data
function sanitizeTokenData(data) {
  if (!Array.isArray(data)) return [];
  return data.map(token => {
    return {
      id: String(token.id || '').replace(/[^a-zA-Z0-9-]/g, ''),
      name: String(token.name || 'Unknown').substring(0, 50),
      symbol: String(token.symbol || '').toUpperCase().substring(0, 10),
      total_volume: Number(token.total_volume) || 0,
      current_price: Number(token.current_price) || 0,
      price_change_percentage_24h: Number(token.price_change_percentage_24h) || 0,
      market_cap: Number(token.market_cap) || 0,
      circulating_supply: Number(token.circulating_supply) || 0,
      source: String(token.source || 'Unknown'),
      score: Math.min(100, Math.max(0, (Number(token.price_change_percentage_24h) + 100) / 2)) || 0
    };
  }).filter(token => token.symbol && token.current_price > 0);
}

// Fetch all available pairs from Binance
async function fetchBinancePairs() {
  console.log('[DEBUG] Fetching Binance pairs');
  try {
    const response = await fetchWithRetry(`${BINANCE_API}/exchangeInfo`);
    if (response && response.symbols) {
      return response.symbols
        .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .map(s => s.symbol)
        .slice(0, 250); // Limit to 250 pairs to manage load
    }
    return [];
  } catch (error) {
    console.error('[ERROR] Failed to fetch Binance pairs:', error);
    return [];
  }
}

// Fetch token data for given pairs
async function fetchTokenData(pairs) {
  console.log('[DEBUG] Fetching token data for pairs:', pairs.length);
  const batchSize = 10; // Respect rate limits
  let allData = [];

  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    const tickerUrl = `${BINANCE_API}/ticker/24hr?symbols=[${JSON.stringify(batch)}]`;
    const data = await fetchWithRetry(tickerUrl);
    if (data) {
      allData = allData.concat(data.map(ticker => ({
        id: ticker.symbol.replace('USDT', '').toLowerCase(),
        name: ticker.symbol.replace('USDT', ''),
        symbol: ticker.symbol.replace('USDT', ''),
        total_volume: Number(ticker.volume) * Number(ticker.lastPrice),
        current_price: Number(ticker.lastPrice),
        price_change_percentage_24h: Number(ticker.priceChangePercent),
        market_cap: 0, // Binance doesn't provide this directly, estimate later
        circulating_supply: 0, // Requires external data
        source: 'Binance'
      })));
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit delay
  }

  // Fallback to CoinGecko if data is insufficient
  if (allData.length < pairs.length / 2) {
    console.warn('[WARN] Insufficient Binance data, falling back to CoinGecko');
    const coinGeckoData = await fetchWithRetry(COINGECKO_API);
    if (coinGeckoData) {
      allData = allData.concat(sanitizeTokenData(coinGeckoData));
    }
  }

  return allData;
}

// Cache data
function cacheData(data) {
  localStorage.setItem('tokenData', JSON.stringify(data));
  localStorage.setItem('lastUpdate', Date.now());
}

// Load cached data
function loadCachedData() {
  const cached = localStorage.getItem('tokenData');
  const lastUpdate = localStorage.getItem('lastUpdate');
  if (cached && lastUpdate && (Date.now() - lastUpdate < 5 * 60 * 1000)) { // 5-minute cache
    console.log('[DEBUG] Using cached data');
    return JSON.parse(cached);
  }
  return null;
}

// Update tokens
async function updateTokens() {
  console.log('[DEBUG] Entering updateTokens');
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');

  if (!tokenList || !loader || !topPairs) {
    console.error('[ERROR] DOM elements missing: tokenList=', tokenList, 'loader=', loader, 'topPairs=', topPairs);
    return;
  }

  loader.style.display = 'flex';
  console.log('[DEBUG] DOM elements found, starting data fetch');

  let tokens = loadCachedData();
  if (!tokens) {
    const pairs = await fetchBinancePairs();
    if (pairs.length > 0) {
      tokens = await fetchTokenData(pairs);
      tokens = sanitizeTokenData(tokens);
      cacheData(tokens);
    }
  }

  if (!tokens || tokens.length === 0) {
    console.warn('[WARN] No real data, using mock data');
    tokens = mockTokens;
  }

  allTokens = tokens;
  sortedTokens = [...tokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

  // Render token list
  tokenList.innerHTML = '';
  sortedTokens.forEach((token, index) => {
    console.log('[DEBUG] Rendering token:', token.symbol);
    const opacity = 30 + (index / sortedTokens.length) * 40;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    const li = document.createElement('li');
    li.className = `p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} ${hoverClass} z-20`;
    li.setAttribute('data-tooltip', '[Click to toggle chart]');
    const priceChange = token.price_change_percentage_24h;
    const priceChangeEmoji = priceChange >= 0 ? '🤑' : '🤮';
    const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';
    li.innerHTML = `
      <div class="flex flex-col space-y-1">
        <div class="flex items-center justify-between">
          <span class="font-medium truncate">[🍀 ${token.name} (${token.symbol}) Score:${token.score.toFixed(1)}]</span>
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
      showPriceChart(token, currentTimeframe, isChartLocked ? 'modal' : 'header');
      console.log(`[DEBUG] Selected token: ${token.symbol}`);
    });
    tokenList.appendChild(li);
  });

  // Render top pairs
  topPairs.innerHTML = sortedTokens.slice(0, 5).map((token, index) => {
    const opacity = 20 + (index / 4) * 30;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    return `<li class="px-2 py-1 rounded ${bgColor} hover-glow transition ${glowClass} ${hoverClass}">[${token.symbol}/USDT]</li>`;
  }).join('');

  // Default token and chart
  if (!currentToken && allTokens.length > 0) {
    currentToken = allTokens[0];
    showPriceChart(currentToken, currentTimeframe, 'header');
    console.log(`[DEBUG] Defaulted to token: ${currentToken.symbol}`);
  }

  loader.style.display = 'none';
  console.log('[DEBUG] Tokens updated');
}

// Show price chart using TradingView
function showPriceChart(token, timeframe, context = 'header') {
  console.log(`[DEBUG] Showing price chart for ${token.symbol} (Timeframe: ${timeframe}) in ${context} context`);
  const chartContainer = context === 'header' ? document.getElementById('chart-container-header') : document.getElementById('chart-container-modal');
  const chartTitle = context === 'header' ? document.getElementById('chart-title-header') : document.getElementById('chart-title-modal');
  const livePriceElement = context === 'header' ? document.getElementById('live-price-header') : document.getElementById('live-price-modal');

  if (!chartContainer || !chartTitle || !livePriceElement) {
    console.error(`[ERROR] Missing DOM element for ${context} chart: container=${chartContainer}, title=${chartTitle}, price=${livePriceElement}`);
    return;
  }

  chartContainer.innerHTML = '';

  const symbolMap = {
    'FLOKI': 'BINANCE:FLOKIUSDT',
    'SHIB': 'BINANCE:SHIBUSDT',
    'PEOPLE': 'BINANCE:PEOPLEUSDT'
  };
  const tvSymbol = symbolMap[token.symbol] || `BINANCE:${token.symbol}USDT`;

  const timeframeMap = {
    '1min': '1',
    '5min': '5',
    '15min': '15',
    '1hr': '60',
    '4hr': '240',
    '1D': 'D'
  };
  const interval = timeframeMap[timeframe] || 'D';

  const containerId = `tradingview_${context}_${Date.now()}`;
  chartContainer.innerHTML = `<div id="${containerId}" style="height: 100%; width: 100%;"></div>`;

  try {
    new TradingView.widget({
      "container_id": containerId,
      "width": "100%",
      "height": "100%",
      "symbol": tvSymbol,
      "interval": interval,
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "toolbar_bg": "#0a0f14",
      "enable_publishing": false,
      "allow_symbol_change": false,
      "hide_top_toolbar": true,
      "hide_side_toolbar": true,
      "backgroundColor": "#0a0f14",
      "gridLineColor": "rgba(0, 255, 0, 0.1)",
      "overrides": {
        "paneProperties.background": "#0a0f14",
        "paneProperties.gridProperties.color": "rgba(0, 255, 0, 0.1)",
        "mainSeriesProperties.candleStyle.upColor": "#00ff00",
        "mainSeriesProperties.candleStyle.downColor": "#ff0000",
        "mainSeriesProperties.candleStyle.borderUpColor": "#00ff00",
        "mainSeriesProperties.candleStyle.borderDownColor": "#ff0000",
        "mainSeriesProperties.candleStyle.wickUpColor": "#00ff00",
        "mainSeriesProperties.candleStyle.wickDownColor": "#ff0000"
      }
    });
    console.log('[DEBUG] TradingView chart initialized');
  } catch (error) {
    console.error('[ERROR] Failed to initialize TradingView chart:', error);
  }

  chartTitle.textContent = `> ${token.symbol} Price Chart`;
  livePriceElement.textContent = `> Live Price: $${token.current_price.toLocaleString()}`;
  console.log('[DEBUG] Price chart rendered');
}

// Update marquee
function updateMarquee() {
  console.log('[DEBUG] Entering updateMarquee');
  const marqueeElements = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];

  if (!marqueeElements[0] || !marqueeElements[1]) {
    console.error('[ERROR] Marquee elements missing:', marqueeElements);
    return;
  }

  function getUniquePun() {
    if (usedPuns.length === iceKingPuns.length) usedPuns = [];
    const availablePuns = iceKingPuns.filter(pun => !usedPuns.includes(pun));
    const selectedPun = availablePuns[Math.floor(Math.random() * availablePuns.length)];
    usedPuns.push(selectedPun);
    return selectedPun;
  }

  const winners = sortedTokens.filter(t => t.price_change_percentage_24h > 0).slice(0, 3);
  const losers = sortedTokens.filter(t => t.price_change_percentage_24h < 0).slice(-3);
  const currentPun = getUniquePun();
  const marqueeItems = [
    ...winners.map(t => `<span class="glow-green text-green-400">[🏆 ${t.symbol}: +${t.price_change_percentage_24h.toFixed(2)}%]</span>`),
    `<span class="glow-purple text-green-400">[${currentPun}]</span>`,
    ...losers.map(t => `<span class="glow-red text-red-400">[📉 ${t.symbol}: ${t.price_change_percentage_24h.toFixed(2)}%]</span>`)
  ];
  const doubledItems = [...marqueeItems, ...marqueeItems];
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
  updateMarquee();
  setInterval(updateMarquee, 20000);

  const timeframes = ['1min', '5min', '15min', '1hr', '4hr', '1D'];
  ['header', 'modal'].forEach(context => {
    timeframes.forEach(tf => {
      const btn = document.getElementById(`${context}-timeframe-${tf}`);
      if (btn) {
        btn.addEventListener('click', () => {
          timeframes.forEach(t => document.getElementById(`${context}-timeframe-${t}`).classList.remove('active'));
          btn.classList.add('active');
          currentTimeframe = tf;
          if (currentToken) showPriceChart(currentToken, currentTimeframe, context);
          console.log(`[DEBUG] Timeframe changed to ${tf} in ${context}`);
        });
      }
    });
  });

  const toggleStickyBtnHeader = document.getElementById('toggle-sticky-header');
  const toggleStickyBtnModal = document.getElementById('toggle-sticky-modal');
  const chartModal = document.getElementById('chart-modal');

  if (!toggleStickyBtnHeader || !toggleStickyBtnModal || !chartModal) {
    console.error('[ERROR] Sticky toggle elements missing:', toggleStickyBtnHeader, toggleStickyBtnModal, chartModal);
    return;
  }

  const toggleChartLock = () => {
    isChartLocked = !isChartLocked;
    chartModal.classList.toggle('active', isChartLocked);
    toggleStickyBtnHeader.textContent = isChartLocked ? '[Unlock Chart]' : '[Lock Chart]';
    toggleStickyBtnModal.textContent = isChartLocked ? '[Unlock Chart]' : '[Lock Chart]';
    toggleStickyBtnHeader.classList.toggle('bg-green-500', isChartLocked);
    toggleStickyBtnHeader.classList.toggle('bg-blue-500', !isChartLocked);
    toggleStickyBtnModal.classList.toggle('bg-green-500', isChartLocked);
    toggleStickyBtnModal.classList.toggle('bg-blue-500', !isChartLocked);
    toggleStickyBtnHeader.classList.toggle('hover:bg-green-600', isChartLocked);
    toggleStickyBtnHeader.classList.toggle('hover:bg-blue-600', !isChartLocked);
    toggleStickyBtnModal.classList.toggle('hover:bg-green-600', isChartLocked);
    toggleStickyBtnModal.classList.toggle('hover:bg-blue-600', !isChartLocked);
    if (isChartLocked && currentToken) showPriceChart(currentToken, currentTimeframe, 'modal');
    console.log(`[DEBUG] Chart lock toggled: ${isChartLocked ? 'Locked' : 'Unlocked'}`);
  };

  toggleStickyBtnHeader.addEventListener('click', toggleChartLock);
  toggleStickyBtnModal.addEventListener('click', toggleChartLock);
  chartModal.addEventListener('click', (e) => {
    if (e.target === chartModal) toggleChartLock();
  });

  console.log('[DEBUG] Dashboard initialization complete');
}

// Start the dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('[DEBUG] DOMContentLoaded event fired');
  initializeDashboard();
});
