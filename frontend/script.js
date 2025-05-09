const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINGECKO_CHART_API = 'https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={days}';
const COINGECKO_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids={id}&vs_currencies=usd';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=100&convert=USD';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = 'https://telemetry.betterstack.com/api/v2/query/live-tail';
const POLLING_INTERVAL = 15000;
const PRICE_UPDATE_INTERVAL = 10000;

// Mock token data for fallback, including ConstitutionDAO
const mockTokens = [
  { id: 'floki', name: 'FLOKI', symbol: 'FLOKI', total_volume: 4500000, current_price: 0.00015, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 10000000000000, source: 'Mock', score: 52.6 },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', total_volume: 3000000, current_price: 0.000013, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 589000000000000, source: 'Mock', score: 48.9 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', total_volume: 135674.745, current_price: 0.01962, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'CryptoCompare', score: 70.6 }
];

// Mock historical data for chart fallback
const mockChartData = {
  prices: Array.from({ length: 7 }, (_, i) => [
    Date.now() - (6 - i) * 24 * 60 * 60 * 1000,
    0.00015 + (Math.random() - 0.5) * 0.00002
  ])
};

// Ice King puns for marquee
const iceKingPuns = [
  "I’m chilling like the Ice King! ❄️👑",
  "Penguins are my royal guards! 🐧🧊",
  "Time to freeze the market! ❄️😂",
  "Ice to meet you, traders! 🧊🐧",
  "I’m the coolest king around! 👑❄️",
  "Penguin power activate! 🐧🧊😂"
];

// Global Chart.js instance and state
let priceChart = null;
let currentToken = null;
let compareToken = null;
let currentTimeframe = 1;
let allTokens = [];

// Retry fetch with delay
async function fetchWithRetry(url, retries = 3, delay = 1000, options = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Retrying fetch (${i + 1}/${retries})...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Fetch live price for a token
async function fetchLivePrice(tokenId) {
  try {
    const url = COINGECKO_PRICE_API.replace('{id}', encodeURIComponent(tokenId));
    const data = await fetchWithRetry(url);
    return data[tokenId]?.usd || 'N/A';
  } catch (error) {
    console.error(`Error fetching live price for ${tokenId}:`, error);
    return 'N/A';
  }
}

// Update live price display
async function updateLivePrice() {
  if (!currentToken) return;
  const livePriceElements = [
    document.getElementById('live-price-header'),
    document.getElementById('live-price-modal')
  ];
  const price = await fetchLivePrice(currentToken.id);
  livePriceElements.forEach(element => {
    if (element) element.textContent = `Live Price: $${price !== 'N/A' ? price.toLocaleString() : 'N/A'}`;
  });
}

// Fetch logs from Betterstack API
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
    return data;
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}

// Update alerts with fetched logs
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
          <span class="font-medium truncate text-gray-200">📜 ${log.message || 'No message'}</span>
          <span class="text-xs text-gray-400">${new Date(timestamp).toLocaleTimeString()}</span>
        </div>`;
      alertList.prepend(li);
    });
    while (alertList.children.length > 20) {
      alertList.removeChild(alertList.lastChild);
    }
  });
}

// Fetch low-volume tokens, rank by performance, and update marquee with puns
async function fetchLowVolumeTokens() {
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

  try {
    const cgResponse = await fetch(COINGECKO_API);
    if (!cgResponse.ok) throw new Error(`CoinGecko HTTP ${cgResponse.status}`);
    const cgData = await cgResponse.json();
    console.log('CoinGecko data:', cgData);
    tokens.push(...cgData.filter(token => token.total_volume < 5_000_000).map(token => ({
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
    console.error('CoinGecko error:', error);
  }

  try {
    const cmcResponse = await fetch(COINMARKETCAP_API, {
      headers: { 'X-CMC_PRO_API_KEY': 'bef090eb-323d-4ae8-86dd-266236262f19' }
    });
    if (!cmcResponse.ok) throw new Error(`CoinMarketCap HTTP ${cmcResponse.status}`);
    const cmcData = await cmcResponse.json();
    console.log('CoinMarketCap data:', cmcData);
    tokens.push(...cmcData.data.filter(token => token.quote.USD.volume_24h < 5_000_000).map(token => ({
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
    console.error('CoinMarketCap error:', error);
  }

  try {
    const ccResponse = await fetch(CRYPTOCOMPARE_API);
    if (!ccResponse.ok) throw new Error(`CryptoCompare HTTP ${ccResponse.status}`);
    const ccData = await ccResponse.json();
    console.log('CryptoCompare data:', ccData);
    tokens.push(...ccData.Data.filter(token => token.RAW?.USD?.VOLUME24HOURTO < 5_000_000).map(token => ({
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
    console.error('CryptoCompare error:', error);
  }

  if (tokens.length === 0) {
    console.warn('No token data fetched. Using mock data.');
    tokens = mockTokens;
  }

  const uniqueTokens = [];
  const seenSymbols = new Set();
  for (const token of tokens) {
    if (!seenSymbols.has(token.symbol)) {
      seenSymbols.add(token.symbol);
      uniqueTokens.push(token);
    }
  }

  allTokens = uniqueTokens;

  const sortedTokens = [...uniqueTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  tokenList.innerHTML = '';
  sortedTokens.forEach((token, index) => {
    const li = document.createElement('li');
    const opacity = 30 + (index / sortedTokens.length) * 40;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    const tooltipBg = token.price_change_percentage_24h >= 0 ? 'rgba(74, 222, 128, 0.9)' : 'rgba(248, 113, 113, 0.9)';
    const tooltipGlow = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    li.className = `p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} ${hoverClass} z-20`;
    li.setAttribute('data-tooltip', 'Click to toggle chart');
    li.setAttribute('style', `--tooltip-bg: ${tooltipBg}; --tooltip-glow: ${tooltipGlow};`);
    const priceChange = token.price_change_percentage_24h;
    const priceChangeEmoji = priceChange >= 0 ? '🤑' : '🤮';
    const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';
    li.innerHTML = `
      <div class="flex flex-col space-y-1">
        <div class="flex items-center justify-between">
          <span class="font-medium truncate">🍀 ${token.name} (${token.symbol}) [${token.score.toFixed(1)}]</span>
          <span class="text-xs">Vol: $${token.total_volume.toLocaleString()}</span>
        </div>
        <div class="text-xs">
          <p>Price: $${token.current_price.toLocaleString()}</p>
          <p class="${priceChangeColor}">24h: ${priceChange.toFixed(2)}% ${priceChangeEmoji}</p>
          <p>Market Cap: $${token.market_cap.toLocaleString()}</p>
          <p>Circulating Supply: ${token.circulating_supply.toLocaleString()} ${token.symbol}</p>
          <p>Source: ${token.source}</p>
        </div>
      </div>`;
    li.addEventListener('click', () => {
      if (selectedTokenLi) {
        selectedTokenLi.classList.remove('selected-token');
      }
      li.classList.add('selected-token');
      selectedTokenLi = li;
      currentToken = token;
      showPriceChart(token, compareToken, currentTimeframe, document.getElementById('chart-modal').classList.contains('active') ? 'modal' : 'header');
      updateLivePrice();
    });
    tokenList.appendChild(li);
  });

  if (sortedTokens.length === 0) {
    tokenList.innerHTML = '<p class="text-gray-400 text-xs">No tokens under $5M volume.</p>';
  }

  const topTokens = sortedTokens.slice(0, 5).map(token => token.symbol);
  topPairs.innerHTML = topTokens.map((pair, index) => {
    const token = sortedTokens[index];
    const opacity = 20 + (index / 4) * 30;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    return `<li class="px-2 py-1 rounded ${bgColor} hover-glow transition ${glowClass} ${hoverClass}">${pair}/USDT</li>`;
  }).join('');

  let punIndex = 0;
  function updateMarquee() {
    const winners = sortedTokens.filter(t => t.price_change_percentage_24h > 0).slice(0, 3);
    const losers = sortedTokens.filter(t => t.price_change_percentage_24h < 0).slice(-3);
    const currentPun = iceKingPuns[punIndex];
    punIndex = (punIndex + 1) % iceKingPuns.length;
    const marqueeItems = [
      ...winners.map(t => `<span class="glow-green text-green-400">${t.symbol}: +${t.price_change_percentage_24h.toFixed(2)}%</span>`),
      ...losers.map(t => `<span class="glow-red text-red-400">${t.symbol}: ${t.price_change_percentage_24h.toFixed(2)}%</span>`),
      `<span class="glow-blue">${currentPun}</span>`
    ];
    marqueeElements.forEach(element => {
      if (element) element.innerHTML = marqueeItems.join('');
    });
  }
  updateMarquee();
  setInterval(updateMarquee, 5000);

  compareDropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.innerHTML = '<option value="">Compare with...</option>' + allTokens.map(t => `<option value="${t.id}">${t.name} (${t.symbol})</option>`).join('');
      dropdown.addEventListener('change', (e) => {
        compareToken = allTokens.find(t => t.id === e.target.value) || null;
        showPriceChart(currentToken, compareToken, currentTimeframe, document.getElementById('chart-modal').classList.contains('active') ? 'modal' : 'header');
      });
    }
  });

  loader.style.display = 'none';
}

// Fetch chart data and display it
async function fetchChartData(tokenId, days) {
  try {
    const url = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(tokenId)).replace('{days}', days);
    const data = await fetchWithRetry(url);
    return data.prices || mockChartData.prices;
  } catch (error) {
    console.error(`Error fetching chart data for ${tokenId}:`, error);
    return mockChartData.prices;
  }
}

// Show price chart
async function showPriceChart(token, compareTokenId, days, containerType) {
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  const chartCanvas = containerType === 'modal' ? document.getElementById('chart-canvas-modal') : document.getElementById('chart-canvas-header');
  const chartTitle = containerType === 'modal' ? document.getElementById('chart-title-modal') : document.getElementById('chart-title-header');
  const livePrice = containerType === 'modal' ? document.getElementById('live-price-modal') : document.getElementById('live-price-header');
  const tickerMarquee = containerType === 'modal' ? document.getElementById('ticker-marquee-modal') : document.getElementById('ticker-marquee-header');

  if (!chartCanvas || !chartTitle || !livePrice || !tickerMarquee || !token) return;

  const data = await fetchChartData(token.id, days);
  const labels = data.map(d => new Date(d[0]).toLocaleDateString());
  const prices = data.map(d => d[1]);

  let compareData = [];
  if (compareTokenId) {
    const compareChartData = await fetchChartData(compareTokenId, days);
    compareData = compareChartData.map(d => d[1]);
  }

  priceChart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${token.name} (${token.symbol})`,
          data: prices,
          borderColor: 'rgba(0, 255, 0, 1)',
          backgroundColor: 'rgba(0, 255, 0, 0.2)',
          fill: true,
          tension: 0.1
        },
        ...(compareTokenId ? [{
          label: `${compareTokenId.name} (${compareTokenId.symbol})`,
          data: compareData,
          borderColor: 'rgba(147, 51, 234, 1)',
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
          fill: true,
          tension: 0.1
        }] : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Price (USD)' }, beginAtZero: false }
      },
      plugins: {
        legend: { labels: { color: '#00ff00' } }
      }
    }
  });

  chartTitle.textContent = `${token.name} (${token.symbol}) - ${days}D Chart`;
  updateLivePrice();
  tickerMarquee.innerHTML = `<span class="glow-green">${token.symbol}: $${prices[prices.length - 1].toLocaleString()}</span>`;
}

// Reinitialize chart based on container type
window.reinitializeChart = function(containerType) {
  if (currentToken) {
    showPriceChart(currentToken, compareToken, currentTimeframe, containerType);
  }
};

// Setup timeframe controls
function setupChartControls(containerType) {
  const timeframes = {
    '1min': 1 / (24 * 60),
    '5min': 5 / (24 * 60),
    '15min': 15 / (24 * 60),
    '1hr': 1 / 24,
    '4hr': 4 / 24,
    '1d': 1
  };

  const prefix = containerType === 'modal' ? 'modal-' : 'header-';
  Object.entries(timeframes).forEach(([id, days]) => {
    const button = document.getElementById(`${prefix}timeframe-${id}`);
    if (button) {
      button.addEventListener('click', () => {
        currentTimeframe = days;
        document.querySelectorAll(`[id^="${prefix}timeframe-"]`).forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        if (currentToken) {
          showPriceChart(currentToken, compareToken, currentTimeframe, containerType);
        }
      });
    }
  });
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
  setupChartControls('header');
  setupChartControls('modal');
  await fetchLowVolumeTokens();
  updateAlertsWithLogs('source_123');
  setInterval(() => fetchLowVolumeTokens(), POLLING_INTERVAL);
  setInterval(updateLivePrice, PRICE_UPDATE_INTERVAL);
});
