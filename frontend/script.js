const BACKEND_URL = 'https://apexomni-backend-fppm.onrender.com';
const TOKEN_REFRESH_INTERVAL = 60000; // 1 minute
const LOG_REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Mock Data (Fallback)
const mockTokens = [
  { id: 'floki-inu', name: 'FLOKI', symbol: 'FLOKI', total_volume: 4500000, current_price: 0.00015, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 10000000000000, source: 'Mock', score: 52.6 },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', total_volume: 3000000, current_price: 0.000013, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 589000000000000, source: 'Mock', score: 48.9 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', total_volume: 135674.745, current_price: 0.01962, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', score: 70.6 }
];

// Ice King Puns for Marquee
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

// Global State
let usedPuns = [];
let currentToken = null;
let currentTimeframe = '1D';
let allTokens = [];
let sortedTokens = [];
let isChartLocked = false;
let selectedTokenLi = null;

// Utility Functions
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DEBUG] Fetching ${url} (Attempt ${i + 1}/${retries})`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log(`[DEBUG] Fetch successful for ${url}`);
      return data;
    } catch (error) {
      console.error(`[ERROR] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
      if (i === retries - 1) {
        console.error(`[ERROR] All retries failed for ${url}`);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function sanitizeTokenData(data) {
  if (!Array.isArray(data)) {
    console.error('[ERROR] Invalid token data format, expected array:', data);
    return [];
  }
  const sanitized = data.map(token => ({
    id: String(token.id || '').replace(/[^a-zA-Z0-9-]/g, ''),
    name: String(token.name || 'Unknown').substring(0, 50),
    symbol: String(token.symbol || '').toUpperCase().substring(0, 10),
    total_volume: Number(token.total_volume) || 0,
    current_price: Number(token.current_price) || 0,
    price_change_percentage_24h: Number(token.price_change_percentage_24h) || 0,
    market_cap: Number(token.market_cap) || 0,
    circulating_supply: Number(token.circulating_supply) || 0,
    source: String(token.source || 'CoinMarketCap'),
    score: Math.min(100, Math.max(0, (Number(token.price_change_percentage_24h) + 100) / 2)) || 0
  })).filter(token => token.symbol && token.current_price > 0);
  console.log('[DEBUG] Sanitized token data:', sanitized);
  return sanitized;
}

function sanitizeLogData(logs) {
  if (!Array.isArray(logs)) {
    console.error('[ERROR] Invalid log data format, expected array:', logs);
    return [];
  }
  const sanitized = logs.map(log => ({
    timestamp: log.dt || new Date().toISOString(),
    message: String(log.message || log.body || 'No message').substring(0, 200),
    level: String(log.level || 'info').toLowerCase()
  }));
  console.log('[DEBUG] Sanitized log data:', sanitized);
  return sanitized;
}

function cacheData(data, type = 'tokens') {
  localStorage.setItem(`${type}Data`, JSON.stringify(data));
  localStorage.setItem(`${type}LastUpdate`, Date.now());
  console.log(`[DEBUG] Cached ${type} data`);
}

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

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

async function fetchTokenData() {
  console.log('[DEBUG] Fetching token data from backend');
  const symbols = 'BTC,ETH,BNB,FLOKI,SHIB,PEOPLE';
  const url = `${BACKEND_URL}/token-stats?symbols=${symbols}`;
  const data = await fetchWithRetry(url);
  if (data && Array.isArray(data)) {
    console.log('[DEBUG] Received token data:', data);
    return sanitizeTokenData(data);
  }
  console.warn('[WARN] No valid backend token data, using mock data');
  alert('Using mock token data due to backend failure. Check console for errors.');
  return mockTokens;
}

async function fetchLogs() {
  console.log('[DEBUG] Fetching logs from backend');
  const url = `${BACKEND_URL}/logs?query=level:info&batch=50`;
  const data = await fetchWithRetry(url);
  if (data && data.logs && Array.isArray(data.logs)) {
    console.log('[DEBUG] Received log data:', data.logs);
    return sanitizeLogData(data.logs);
  }
  console.warn('[WARN] No valid log data, returning empty array');
  alert('No logs available due to backend failure. Check console for errors.');
  return [];
}

async function fetchTopTokens() {
  console.log('[DEBUG] Fetching top tokens from backend');
  const url = `${BACKEND_URL}/top-tokens`;
  const data = await fetchWithRetry(url);
  if (data && Array.isArray(data)) {
    console.log('[DEBUG] Received top tokens:', data);
    return data;
  }
  console.warn('[WARN] No valid top tokens data, returning empty array');
  return [];
}

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
  let tokens = loadCachedData('tokens');
  if (!tokens) {
    tokens = await fetchTokenData();
    cacheData(tokens, 'tokens');
  }

  allTokens = tokens;
  sortedTokens = [...tokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

  tokenList.innerHTML = sortedTokens.map((token, index) => {
    const opacity = 30 + (index / sortedTokens.length) * 40;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    const priceChange = token.price_change_percentage_24h;
    const priceChangeEmoji = priceChange >= 0 ? '🤑' : '🤮';
    const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';
    return `
      <li class="gradient-bg p-2 rounded cursor-pointer hover-glow ${bgColor} ${glowClass} ${hoverClass} ${token.symbol === (currentToken?.symbol || '') ? 'selected-token' : ''}" data-token="${token.symbol}" data-tooltip="Click to view chart">
        <div class="flex flex-col space-y-1">
          <div class="flex justify-between">
            <span class="font-medium truncate">[🍀 ${token.name} (${token.symbol}) Score:${token.score.toFixed(1)}]</span>
            <span class="text-xs">[Vol: ${formatPrice(token.total_volume)}]</span>
          </div>
          <div class="text-xs sm:text-sm text-gray-500">
            <p>Price: ${formatPrice(token.current_price)}</p>
            <p class="${priceChangeColor}">24h: ${formatPercentage(priceChange)} ${priceChangeEmoji}</p>
            <p>Market Cap: ${formatPrice(token.market_cap)}</p>
            <p>Supply: ${token.circulating_supply.toLocaleString()} ${token.symbol}</p>
            <p>Source: ${token.source}</p>
          </div>
        </div>
      </li>`;
  }).join('');

  topPairs.innerHTML = sortedTokens.slice(0, 5).map((token, index) => {
    const opacity = 20 + (index / 4) * 30;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    return `<li class="px-2 py-1 rounded ${bgColor} hover-glow ${glowClass} ${hoverClass}">[${token.symbol}/USDT]</li>`;
  }).join('');

  if (!currentToken && allTokens.length > 0) {
    currentToken = allTokens[0];
    showPriceChart(currentToken, currentTimeframe, 'header');
    selectedTokenLi = tokenList.querySelector(`[data-token="${currentToken.symbol}"]`);
    if (selectedTokenLi) selectedTokenLi.classList.add('selected-token');
  }

  document.querySelectorAll('#token-list li').forEach(item => {
    item.addEventListener('click', () => {
      if (selectedTokenLi) selectedTokenLi.classList.remove('selected-token');
      item.classList.add('selected-token');
      selectedTokenLi = item;
      const token = allTokens.find(t => t.symbol === item.dataset.token);
      if (token) {
        currentToken = token;
        showPriceChart(token, currentTimeframe, isChartLocked ? 'modal' : 'header');
      }
    });
  });

  loader.style.display = 'none';
  updateMarquee();
}

async function updateLogs() {
  console.log('[DEBUG] Entering updateLogs');
  const logList = document.getElementById('log-list');
  const loader = document.getElementById('loader-logs');

  if (!logList || !loader) {
    console.error('[ERROR] DOM elements missing: logList=', logList, 'loader=', loader);
    return;
  }

  loader.style.display = 'flex';
  let logs = loadCachedData('logs');
  if (!logs) {
    logs = await fetchLogs();
    cacheData(logs, 'logs');
  }

  logList.innerHTML = logs.map(log => {
    const levelColor = log.level === 'error' ? 'text-red-400 glow-red' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400 glow-green';
    return `
      <li class="gradient-bg p-2 rounded ${levelColor}">
        <div class="text-xs sm:text-sm text-gray-500">[${new Date(log.timestamp).toLocaleString()}] ${log.level.toUpperCase()}</div>
        <div class="text-sm sm:text-base">${log.message}</div>
      </li>`;
  }).join('');

  loader.style.display = 'none';
}

async function initializeChatbot() {
  const chatList = document.getElementById('chat-list');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const loaderChat = document.getElementById('loader-chat');

  if (!chatList || !chatInput || !chatSend || !loaderChat) {
    console.error('[ERROR] Chatbot DOM elements missing:', chatList, chatInput, chatSend, loaderChat);
    return;
  }

  async function addMessage(message, isUser = false) {
    const li = document.createElement('li');
    li.className = 'gradient-bg p-2 rounded';
    li.innerHTML = `
      <div class="text-xs sm:text-sm text-gray-500">[${new Date().toLocaleString()}] ${isUser ? 'User' : 'Grok'}</div>
      <div class="text-sm sm:text-base">${message}</div>
    `;
    chatList.appendChild(li);
    chatList.scrollTop = chatList.scrollHeight;
  }

  async function handleChat() {
    const query = chatInput.value.trim();
    if (!query) return;
    loaderChat.style.display = 'flex';
    await addMessage(query, true);
    chatInput.value = '';

    if (query.toLowerCase().includes('top rising tokens') || query.toLowerCase().includes('trade today')) {
      try {
        const data = await fetchTopTokens();
        if (data.length === 0) {
          await addMessage('No rising tokens found at the moment.');
        } else {
          const message = `
            Top rising tokens to trade today (based on 24h price change):<br>
            ${data.map((token, i) => `
              ${i + 1}. ${token.name} (${token.symbol})<br>
                - 24h Change: ${formatPercentage(token.price_change_percentage_24h)}<br>
                - Volume (24h): ${formatPrice(token.volume_24h)}<br>
                - Liquidity Ratio: ${(token.liquidity_ratio * 100).toFixed(2)}% (Volume/Market Cap)<br>
                - Source: ${token.source}
            `).join('<br>')}
          `;
          await addMessage(message);
        }
      } catch (error) {
        await addMessage('Failed to fetch top tokens. Please try again.');
      }
    } else {
      await addMessage('I can help with top rising tokens! Ask: "What are the top rising tokens to trade today?"');
    }
    loaderChat.style.display = 'none';
  }

  chatSend.addEventListener('click', handleChat);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  });

  loaderChat.style.display = 'none';
  await addMessage('Ask me: "What are the top rising tokens to trade today?"');
}

function showPriceChart(token, timeframe, context = 'header') {
  console.log(`[DEBUG] Showing price chart for ${token.symbol} (Timeframe: ${timeframe}) in ${context} context`);
  const chartContainer = document.getElementById(`chart-container-${context}`);
  const chartTitle = document.getElementById(`chart-title-${context}`);
  const livePriceElement = document.getElementById(`live-price-${context}`);

  if (!chartContainer || !chartTitle || !livePriceElement) {
    console.error(`[ERROR] Missing DOM element for ${context} chart: container=${chartContainer}, title=${chartTitle}, price=${livePriceElement}`);
    return;
  }

  chartContainer.innerHTML = '';
  const symbolMap = {
    'FLOKI': 'BINANCE:FLOKIUSDT',
    'SHIB': 'BINANCE:SHIBUSDT',
    'PEOPLE': 'BINANCE:PEOPLEUSDT',
    'BTC': 'BINANCE:BTCUSDT',
    'ETH': 'BINANCE:ETHUSDT',
    'BNB': 'BINANCE:BNBUSDT'
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
  chartContainer.innerHTML = `<div id="${containerId}" class="tradingview-widget-container" style="height: 100%; width: 100%;"></div>`;

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

  chartTitle.textContent = `> ${token.symbol}/USDT [${timeframe.toUpperCase()}]`;
  livePriceElement.textContent = `> Live Price: ${formatPrice(token.current_price)} (${formatPercentage(token.price_change_percentage_24h)})`;
}

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
    ...winners.map(t => `<span class="glow-green">[🏆 ${t.symbol}: +${formatPercentage(t.price_change_percentage_24h)}]</span>`),
    `<span class="glow-purple">[${currentPun}]</span>`,
    ...losers.map(t => `<span class="glow-red">[📉 ${t.symbol}: ${formatPercentage(t.price_change_percentage_24h)}]</span>`)
  ];
  const doubledItems = [...marqueeItems, ...marqueeItems];
  marqueeElements.forEach(element => {
    element.innerHTML = doubledItems.join('');
  });
}

function initializeDashboard() {
  console.log('[DEBUG] Initializing Ice King Dashboard...');
  updateTokens();
  setInterval(updateTokens, TOKEN_REFRESH_INTERVAL);
  updateLogs();
  setInterval(updateLogs, LOG_REFRESH_INTERVAL);
  initializeChatbot();

  const timeframes = ['1min', '5min', '15min', '1hr', '4hr', '1D'];
  ['header', 'modal'].forEach(context => {
    timeframes.forEach(tf => {
      const btn = document.getElementById(`${context}-timeframe-${tf}`);
      if (btn) {
        btn.addEventListener('click', () => {
          timeframes.forEach(t => {
            const b = document.getElementById(`${context}-timeframe-${t}`);
            if (b) b.classList.remove('active');
          });
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
    if (isChartLocked && currentToken) showPriceChart(currentToken, currentTimeframe, 'modal');
    console.log(`[DEBUG] Chart lock toggled: ${isChartLocked ? 'Locked' : 'Unlocked'}`);
  };

  toggleStickyBtnHeader.addEventListener('click', toggleChartLock);
  toggleStickyBtnModal.addEventListener('click', toggleChartLock);
  chartModal.addEventListener('click', (e) => {
    if (e.target === chartModal) toggleChartLock();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[DEBUG] DOMContentLoaded event fired');
  initializeDashboard();
});
