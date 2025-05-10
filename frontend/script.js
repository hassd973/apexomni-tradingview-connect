// === Ice King Dashboard Script ===
// Author: Grok 3 @ xAI
// Purpose: Fetch and display low-volume token data with a live price chart
// Features: Terminal-style UI, robust error handling, sticky chart toggle

// --- Constants and Configuration ---
const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINGECKO_CHART_API = 'https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={days}';
const COINGECKO_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids={id}&vs_currencies=usd';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=100&convert=USD';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = 'https://telemetry.betterstack.com/api/v2/query/live-tail';

// Intervals (ms) to balance API rate limits
const POLLING_INTERVAL = 15000; // General polling
const PRICE_UPDATE_INTERVAL = 15000; // Live price updates
const TOKEN_REFRESH_INTERVAL = 60000; // Token data refresh
const MARQUEE_UPDATE_INTERVAL = 20000; // Marquee updates

const CMC_API_KEY = 'bef090eb-323d-4ae8-86dd-266236262f19';

// --- Mock Data for Fallback ---
const mockTokens = [
  { id: 'floki', name: 'FLOKI', symbol: 'FLOKI', total_volume: 4500000, current_price: 0.00015, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 10000000000000, source: 'Mock', score: 52.6 },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', total_volume: 3000000, current_price: 0.000013, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 589000000000000, source: 'Mock', score: 48.9 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', total_volume: 135674.745, current_price: 0.01962, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'CryptoCompare', score: 70.6 }
];

const mockChartData = {
  prices: Array.from({ length: 7 }, (_, i) => [
    Date.now() - (6 - i) * 24 * 60 * 60 * 1000,
    0.00015 + (Math.random() - 0.5) * 0.00002
  ])
};

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
let priceChart = null;
let currentToken = null;
let compareToken = null;
let currentTimeframe = 1; // Default to 1 day
let allTokens = [];
let sortedTokens = [];
let isChartLocked = false;

// --- Utility Functions ---

// Fetch with retry mechanism to handle API failures
async function fetchWithRetry(url, retries = 3, delay = 1000, options = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) {
        console.error(`[ERROR] Fetch failed after ${retries} retries for ${url}:`, error);
        throw error;
      }
      console.warn(`[WARN] Retrying fetch (${i + 1}/${retries}) for ${url}:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Fetch live price from CoinGecko
async function fetchLivePrice(tokenId) {
  if (!tokenId) {
    console.error('[ERROR] Token ID is undefined for live price fetch');
    return 'N/A';
  }
  try {
    const url = COINGECKO_PRICE_API.replace('{id}', encodeURIComponent(tokenId));
    const data = await fetchWithRetry(url);
    const price = data[tokenId]?.usd;
    if (!price) throw new Error('Price not found in response');
    console.log(`[INFO] Fetched live price for ${tokenId}: $${price}`);
    return price;
  } catch (error) {
    console.error(`[ERROR] Failed to fetch live price for ${tokenId}:`, error.message);
    return 'N/A';
  }
}

// Update live price and chart data
async function updateLivePrice() {
  if (!currentToken || !priceChart) {
    console.warn('[WARN] No current token or chart to update live price');
    return;
  }

  const livePriceElements = [
    document.getElementById('live-price-header'),
    document.getElementById('live-price-modal')
  ];
  const tickerMarquees = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];

  const price = await fetchLivePrice(currentToken.id);
  livePriceElements.forEach(element => {
    if (element) {
      element.textContent = `> Live Price: $${price !== 'N/A' ? price.toLocaleString() : 'N/A'}`;
    }
  });

  if (price !== 'N/A' && priceChart) {
    const now = new Date();
    priceChart.data.labels.push(now.toLocaleString());
    priceChart.data.datasets[0].data.push(price);

    // Keep chart data manageable
    if (priceChart.data.labels.length > 50) {
      priceChart.data.labels.shift();
      priceChart.data.datasets[0].data.shift();
    }

    priceChart.update('none');
    console.log(`[INFO] Updated chart with new price for ${currentToken.symbol}: $${price}`);

    tickerMarquees.forEach(marquee => {
      if (marquee) {
        marquee.innerHTML = `<span class="glow-green">[${currentToken.symbol}: $${price.toLocaleString()}]</span>`;
      }
    });
  }

  if (compareToken && priceChart && priceChart.data.datasets[1]) {
    const comparePrice = await fetchLivePrice(compareToken.id);
    if (comparePrice !== 'N/A') {
      priceChart.data.datasets[1].data.push(comparePrice);
      if (priceChart.data.datasets[1].data.length > 50) {
        priceChart.data.datasets[1].data.shift();
      }
      priceChart.update('none');
      console.log(`[INFO] Updated comparison chart for ${compareToken.symbol}: $${comparePrice}`);
    }
  }
}

// Fetch logs for alerts
async function fetchLogs(sourceId) {
  const url = BETTERSTACK_API;
  const options = {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer WGdCT5KhHtg4kiGWAbdXRaSL'
    },
    body: new URLSearchParams({
      source_ids: sourceId,
      query: 'level=info'
    })
  };
  try {
    const data = await fetchWithRetry(url, 3, 1000, options);
    console.log('[INFO] Fetched logs:', data);
    return data;
  } catch (error) {
    console.error('[ERROR] Failed to fetch logs:', error.message);
    return [];
  }
}

// Update alerts section with logs
function updateAlertsWithLogs(sourceId) {
  const alertList = document.getElementById('alert-list');
  fetchLogs(sourceId).then(logs => {
    alertList.innerHTML = '';
    logs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'bg-gray-700/40 p-2 rounded-md shadow hover-glow transition fade-in';
      const timestamp = log.timestamp || new Date().toISOString();
      li.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-medium truncate text-gray-200">[📜 ${log.message || 'No message'}]</span>
          <span class="text-xs text-gray-400">[${new Date(timestamp).toLocaleTimeString()}]</span>
        </div>`;
      alertList.prepend(li);
    });
    while (alertList.children.length > 20) {
      alertList.removeChild(alertList.lastChild);
    }
    console.log('[INFO] Updated alerts with new logs');
  });
}

// Fetch low-volume tokens from multiple sources
async function fetchLowVolumeTokens() {
  console.log('[INFO] Fetching low-volume tokens...');
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  const marqueeElements = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];
  const compareDropdowns = [
    document.getElementById('compare-token-header'),
    document.getElementById('compare-token-modal')
  ];
  let tokens = [];
  let selectedTokenLi = null;

  // Fetch from CoinGecko
  try {
    const cgResponse = await fetchWithRetry(COINGECKO_API);
    console.log('[INFO] CoinGecko data fetched:', cgResponse);
    tokens.push(...cgResponse.filter(token => token.total_volume < 5_000_000).map(token => ({
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
    })));
  } catch (error) {
    console.error('[ERROR] CoinGecko fetch failed:', error.message);
  }

  // Fetch from CoinMarketCap
  try {
    const cmcResponse = await fetchWithRetry(COINMARKETCAP_API, 3, 2000, {
      headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY }
    });
    console.log('[INFO] CoinMarketCap data fetched:', cmcResponse);
    tokens.push(...cmcResponse.data.filter(token => token.quote.USD.volume_24h < 5_000_000).map(token => ({
      id: token.slug,
      name: token.name,
      symbol: token.symbol.toUpperCase(),
      total_volume: token.quote.USD.volume_24h,
      current_price: token.quote.USD.price,
      price_change_percentage_24h: token.quote.USD.percent_change_24h,
      market_cap: token.quote.USD.market_cap,
      circulating_supply: token.circulating_supply,
      source: 'CoinMarketCap',
      score: Math.min(100, Math.max(0, (token.quote.USD.percent_change_24h + 100) / 2))
    })));
  } catch (error) {
    console.error('[ERROR] CoinMarketCap fetch failed:', error.message);
  }

  // Fetch from CryptoCompare
  try {
    const ccResponse = await fetchWithRetry(CRYPTOCOMPARE_API);
    console.log('[INFO] CryptoCompare data fetched:', ccResponse);
    tokens.push(...ccResponse.Data.filter(token => token.RAW?.USD?.VOLUME24HOURTO < 5_000_000).map(token => ({
      id: token.CoinInfo.Name.toLowerCase(),
      name: token.CoinInfo.FullName,
      symbol: token.CoinInfo.Name.toUpperCase(),
      total_volume: token.RAW?.USD?.VOLUME24HOURTO || 0,
      current_price: token.RAW?.USD?.PRICE || 0,
      price_change_percentage_24h: token.RAW?.USD?.CHANGEPCT24HOUR || 0,
      market_cap: token.RAW?.USD?.MKTCAP || 0,
      circulating_supply: token.RAW?.USD?.SUPPLY || 0,
      source: 'CryptoCompare',
      score: Math.min(100, Math.max(0, ((token.RAW?.USD?.CHANGEPCT24HOUR || 0) + 100) / 2))
    })));
  } catch (error) {
    console.error('[ERROR] CryptoCompare fetch failed:', error.message);
  }

  // Fallback to mock data if all APIs fail
  if (tokens.length === 0) {
    console.warn('[WARN] No token data fetched. Falling back to mock data.');
    tokens = mockTokens;
  }

  // Remove duplicates based on symbol
  const uniqueTokens = [];
  const seenSymbols = new Set();
  for (const token of tokens) {
    if (!seenSymbols.has(token.symbol)) {
      seenSymbols.add(token.symbol);
      uniqueTokens.push(token);
    }
  }

  allTokens = uniqueTokens;
  sortedTokens = [...uniqueTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

  // Update token list UI
  tokenList.innerHTML = '';
  sortedTokens.forEach((token, index) => {
    const li = document.createElement('li');
    const opacity = 30 + (index / sortedTokens.length) * 40;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
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
      if (selectedTokenLi) {
        selectedTokenLi.classList.remove('selected-token');
      }
      li.classList.add('selected-token');
      selectedTokenLi = li;
      currentToken = token;
      showPriceChart(token, compareToken, currentTimeframe, isChartLocked ? 'modal' : 'header');
      updateLivePrice();
      console.log(`[INFO] Selected token: ${token.symbol}`);
    });
    tokenList.appendChild(li);
  });

  // Update top pairs
  const topTokens = sortedTokens.slice(0, 5).map(token => token.symbol);
  topPairs.innerHTML = topTokens.map((pair, index) => {
    const token = sortedTokens[index];
    const opacity = 20 + (index / 4) * 30;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    return `<li class="px-2 py-1 rounded ${bgColor} hover-glow transition ${glowClass} ${hoverClass}">[${pair}/USDT]</li>`;
  }).join('');

  // Update comparison dropdowns
  compareDropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.innerHTML = '<option value="">[Compare with...]</option>';
      sortedTokens.forEach(token => {
        const option = document.createElement('option');
        option.value = token.id;
        option.textContent = `[${token.symbol}]`;
        dropdown.appendChild(option);
      });
    }
  });

  loader.style.display = 'none';
  console.log('[INFO] Low-volume tokens updated successfully');
}

// Show price chart for selected token
async function showPriceChart(token, compareToken, days, context = 'header') {
  console.log(`[INFO] Showing price chart for ${token.symbol} (${days} days) in ${context} context`);
  const chartCanvas = context === 'header' ? document.getElementById('chart-canvas-header') : document.getElementById('chart-canvas-modal');
  const chartTitle = context === 'header' ? document.getElementById('chart-title-header') : document.getElementById('chart-title-modal');

  if (!chartCanvas) {
    console.error(`[ERROR] Chart canvas not found for ${context}`);
    return;
  }

  if (priceChart) {
    priceChart.destroy();
    console.log('[INFO] Destroyed previous chart instance');
  }

  let historicalData = [];
  try {
    const url = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(token.id)).replace('{days}', days);
    const data = await fetchWithRetry(url);
    historicalData = data.prices;
    console.log(`[INFO] Fetched historical data for ${token.symbol}:`, historicalData);
  } catch (error) {
    console.error(`[ERROR] Failed to fetch historical data for ${token.symbol}:`, error.message);
    historicalData = mockChartData.prices;
    console.warn('[WARN] Using mock chart data as fallback');
  }

  const labels = historicalData.map(item => new Date(item[0]).toLocaleString());
  const prices = historicalData.map(item => item[1]);

  const datasets = [{
    label: `${token.symbol} Price`,
    data: prices,
    borderColor: '#00ff00',
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    fill: true,
    tension: 0.4
  }];

  if (compareToken) {
    try {
      const compareUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(compareToken.id)).replace('{days}', days);
      const compareData = await fetchWithRetry(compareUrl);
      const comparePrices = compareData.prices.map(item => item[1]);
      datasets.push({
        label: `${compareToken.symbol} Price`,
        data: comparePrices,
        borderColor: '#ff0000',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        fill: true,
        tension: 0.4
      });
      console.log(`[INFO] Added comparison data for ${compareToken.symbol}`);
    } catch (error) {
      console.error(`[ERROR] Failed to fetch comparison data for ${compareToken.symbol}:`, error.message);
    }
  }

  priceChart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: true, title: { display: true, text: 'Time', color: '#00ff00' }, ticks: { color: '#00ff00' } },
        y: { display: true, title: { display: true, text: 'Price (USD)', color: '#00ff00' }, ticks: { color: '#00ff00' } }
      },
      plugins: {
        legend: { labels: { color: '#00ff00' } }
      }
    }
  });

  chartTitle.textContent = `> ${token.symbol} Price Chart${compareToken ? ` vs ${compareToken.symbol}` : ''}`;
  console.log(`[INFO] Price chart rendered for ${token.symbol}`);
}

// Update marquee with winners, losers, and puns
function updateMarquee() {
  const marqueeElements = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];

  function getUniquePun() {
    if (usedPuns.length === iceKingPuns.length) {
      usedPuns = [];
    }
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
    if (element) {
      element.innerHTML = doubledItems.join('');
    }
  });
  console.log('[INFO] Marquee updated with winners, losers, and pun');
}

// Initialize the dashboard
function initializeDashboard() {
  console.log('[INFO] Initializing Ice King Dashboard...');

  // Fetch initial token data
  fetchLowVolumeTokens();
  setInterval(fetchLowVolumeTokens, TOKEN_REFRESH_INTERVAL);

  // Update live prices
  setInterval(updateLivePrice, PRICE_UPDATE_INTERVAL);

  // Update marquee
  updateMarquee();
  setInterval(updateMarquee, MARQUEE_UPDATE_INTERVAL);

  // Update alerts
  updateAlertsWithLogs('source-id');
  setInterval(() => updateAlertsWithLogs('source-id'), POLLING_INTERVAL);

  // Setup timeframe buttons
  const timeframes = ['1min', '5min', '15min', '1hr', '4hr', '1d'];
  const timeframeValues = { '1min': 1/1440, '5min': 5/1440, '15min': 15/1440, '1hr': 1/24, '4hr': 4/24, '1d': 1 };

  ['header', 'modal'].forEach(context => {
    timeframes.forEach(tf => {
      const btn = document.getElementById(`${context}-timeframe-${tf}`);
      if (btn) {
        btn.addEventListener('click', () => {
          timeframes.forEach(t => {
            document.getElementById(`${context}-timeframe-${t}`).classList.remove('active');
          });
          btn.classList.add('active');
          currentTimeframe = timeframeValues[tf];
          if (currentToken) {
            showPriceChart(currentToken, compareToken, currentTimeframe, context);
          }
          console.log(`[INFO] Timeframe changed to ${tf} (${currentTimeframe} days) in ${context}`);
        });
      }
    });
  });

  // Setup comparison dropdowns
  const compareDropdowns = [
    document.getElementById('compare-token-header'),
    document.getElementById('compare-token-modal')
  ];
  compareDropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.addEventListener('change', () => {
        const selectedId = dropdown.value;
        compareToken = selectedId ? allTokens.find(token => token.id === selectedId) : null;
        const context = dropdown.id.includes('header') ? 'header' : 'modal';
        if (currentToken) {
          showPriceChart(currentToken, compareToken, currentTimeframe, context);
        }
        console.log(`[INFO] Comparison token changed to ${compareToken?.symbol || 'None'} in ${context}`);
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
    if (isChartLocked && currentToken) {
      showPriceChart(currentToken, compareToken, currentTimeframe, 'modal');
    }
    console.log(`[INFO] Chart lock toggled: ${isChartLocked ? 'Locked' : 'Unlocked'}`);
  };

  toggleStickyBtnHeader.addEventListener('click', toggleChartLock);
  toggleStickyBtnModal.addEventListener('click', toggleChartLock);

  chartModal.addEventListener('click', (e) => {
    if (e.target === chartModal) {
      toggleChartLock();
    }
  });

  console.log('[INFO] Dashboard initialization complete');
}

// Start the dashboard
document.addEventListener('DOMContentLoaded', initializeDashboard);
