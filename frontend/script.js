// === Ice King Dashboard Script ===
// Author: Grok 3 @ xAI
// Purpose: Display token data with TradingView chart
// Features: Terminal-style UI, sticky chart toggle, mock/live data toggle

// --- Constants and Configuration ---
const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const TOKEN_REFRESH_INTERVAL = 60000;

// --- Mock Data ---
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
let useMockData = true; // Default to mock data
let selectedTokenLi = null;

// --- Utility Functions ---

// Fetch with retry
async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.json();
    } catch (error) {
      console.error(`[ERROR] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
      if (i === retries - 1) return null;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Update tokens
async function updateTokens() {
  console.log('[INFO] Updating tokens (Mock Data:', useMockData, ')');
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  const compareDropdowns = [
    document.getElementById('compare-token-header'),
    document.getElementById('compare-token-modal')
  ];

  if (!tokenList || !loader || !topPairs) {
    console.error('[ERROR] DOM elements missing: tokenList=', tokenList, 'loader=', loader, 'topPairs=', topPairs);
    return;
  }

  let tokens = [];
  if (useMockData) {
    tokens = mockTokens;
    console.log('[INFO] Using mock data:', tokens);
  } else {
    const data = await fetchWithRetry(COINGECKO_API);
    if (data) {
      tokens = data.filter(token => token.total_volume < 5_000_000).map(token => ({
        id: token.id,
        name: token.name,
        symbol: token.symbol.toUpperCase(),
        total_volume: token.total_volume,
        current_price: token.current_price,
        price_change_percentage_24h: token.price_change_percentage_24h,
        market_cap: token.market_cap,
        circulating_supply: token.circulating_supply,
        source: 'CoinGecko',
        score: Math.min(100, Math.max(0, (token.price_change_percentage_24h + 100) / 2))
      }));
      console.log('[INFO] Fetched real data:', tokens);
    }
    if (tokens.length === 0) {
      console.warn('[WARN] No real data fetched, falling back to mock data');
      tokens = mockTokens;
    }
  }

  allTokens = tokens;
  sortedTokens = [...tokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

  // Render token list
  tokenList.innerHTML = '';
  sortedTokens.forEach((token, index) => {
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
      console.log(`[INFO] Selected token: ${token.symbol}`);
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

  // Update comparison dropdowns
  compareDropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.innerHTML = '<option value="">[Compare with...]</option>';
      allTokens.forEach(token => {
        const option = document.createElement('option');
        option.value = token.id;
        option.textContent = `[${token.symbol}]`;
        dropdown.appendChild(option);
      });
    }
  });

  // Default token and chart
  if (!currentToken && allTokens.length > 0) {
    currentToken = allTokens[0];
    showPriceChart(currentToken, currentTimeframe, 'header');
    console.log(`[INFO] Defaulted to token: ${currentToken.symbol}`);
  }

  loader.style.display = 'none';
  console.log('[INFO] Tokens updated');
}

// Show price chart using TradingView
function showPriceChart(token, timeframe, context = 'header') {
  console.log(`[INFO] Showing price chart for ${token.symbol} (Timeframe: ${timeframe}) in ${context} context`);
  const chartContainer = context === 'header' ? document.getElementById('chart-container-header') : document.getElementById('chart-container-modal');
  const chartTitle = context === 'header' ? document.getElementById('chart-title-header') : document.getElementById('chart-title-modal');
  const livePriceElement = context === 'header' ? document.getElementById('live-price-header') : document.getElementById('live-price-modal');

  if (!chartContainer || !chartTitle || !livePriceElement) {
    console.error(`[ERROR] Missing DOM element for ${context} chart`);
    return;
  }

  // Clear previous chart
  chartContainer.innerHTML = '';

  // Map token symbol to TradingView-compatible symbol
  const symbolMap = {
    'FLOKI': 'BINANCE:FLOKIUSDT',
    'SHIB': 'BINANCE:SHIBUSDT',
    'PEOPLE': 'BINANCE:PEOPLEUSDT'
  };
  const tvSymbol = symbolMap[token.symbol] || 'BINANCE:BTCUSDT'; // Fallback to BTC if not found

  // Map timeframe to TradingView intervals
  const timeframeMap = {
    '1min': '1',
    '5min': '5',
    '15min': '15',
    '1hr': '60',
    '4hr': '240',
    '1D': 'D'
  };
  const interval = timeframeMap[timeframe] || 'D';

  // Create a unique container ID
  const containerId = `tradingview_${context}_${Date.now()}`;
  chartContainer.innerHTML = `<div id="${containerId}" style="height: 100%; width: 100%;"></div>`;

  // Initialize TradingView widget
  new TradingView.widget({
    "container_id": containerId,
    "width": "100%",
    "height": "100%",
    "symbol": tvSymbol,
    "interval": interval,
    "timezone": "Etc/UTC",
    "theme": "dark",
    "style": "1", // Candlestick chart
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

  chartTitle.textContent = `> ${token.symbol} Price Chart`;
  livePriceElement.textContent = `> Live Price: $${token.current_price.toLocaleString()}`;
  console.log('[INFO] TradingView chart rendered');
}

// Update marquee
function updateMarquee() {
  const marqueeElements = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];

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
    if (element) element.innerHTML = doubledItems.join('');
  });
  console.log('[INFO] Marquee updated');
}

// Initialize dashboard
function initializeDashboard() {
  console.log('[INFO] Initializing Ice King Dashboard...');

  // Initial token setup
  updateTokens();
  setInterval(updateTokens, TOKEN_REFRESH_INTERVAL);

  // Start marquee
  updateMarquee();
  setInterval(updateMarquee, 20000);

  // Setup timeframe buttons
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
          console.log(`[INFO] Timeframe changed to ${tf} in ${context}`);
        });
      }
    });
  });

  // Setup comparison dropdowns (basic for now)
  const compareDropdowns = [
    document.getElementById('compare-token-header'),
    document.getElementById('compare-token-modal')
  ];
  compareDropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.addEventListener('change', () => {
        console.log('[INFO] Comparison feature not implemented yet');
      });
    }
  });

  // Setup sticky lock chart toggle
  const toggleStickyBtnHeader = document.getElementById('toggle-sticky-header');
  const toggleStickyBtnModal = document.getElementById('toggle-sticky-modal');
  const chartModal = document.getElementById('chart-modal');

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
    console.log(`[INFO] Chart lock toggled: ${isChartLocked ? 'Locked' : 'Unlocked'}`);
  };

  toggleStickyBtnHeader.addEventListener('click', toggleChartLock);
  toggleStickyBtnModal.addEventListener('click', toggleChartLock);
  chartModal.addEventListener('click', (e) => {
    if (e.target === chartModal) toggleChartLock();
  });

  // Setup mock data toggle
  const toggleDataBtn = document.getElementById('toggle-data');
  toggleDataBtn.addEventListener('click', () => {
    useMockData = !useMockData;
    toggleDataBtn.textContent = `[Toggle Mock Data: ${useMockData ? 'ON' : 'OFF'}]`;
    toggleDataBtn.classList.toggle('bg-green-500', useMockData);
    toggleDataBtn.classList.toggle('bg-blue-500', !useMockData);
    toggleDataBtn.classList.toggle('hover:bg-green-600', useMockData);
    toggleDataBtn.classList.toggle('hover:bg-blue-600', !useMockData);
    updateTokens(); // Refresh data
    console.log(`[INFO] Mock data toggled: ${useMockData ? 'Enabled' : 'Disabled'}`);
  });

  console.log('[INFO] Dashboard initialization complete');
}

// Start the dashboard
document.addEventListener('DOMContentLoaded', initializeDashboard);
