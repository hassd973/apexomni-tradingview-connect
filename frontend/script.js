const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINGECKO_CHART_API = 'https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days=7';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=100&convert=USD';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = '/proxy/live-tail'; // Use proxy endpoint
const BETTERSTACK_TOKEN = 'WGdCT5KhHtg4kiGWAbdXRaSL';
const SOURCE_ID = '1303816';
const POLLING_INTERVAL = 15000;

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

// Global Chart.js instance
let priceChart = null;

// Retry fetch with delay
async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Retrying fetch (${i + 1}/${retries})...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Fetch low-volume tokens, rank by performance, and update marquee with puns
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  const marquee = document.getElementById('ticker-marquee');
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

  // Sort tokens by performance (price_change_percentage_24h)
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
    li.className = `p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} ${hoverClass}`;
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
      showPriceChart(token);
    });
    tokenList.appendChild(li);
  });

  if (sortedTokens.length === 0) {
    tokenList.innerHTML = '<p class="text-gray-400 text-xs">No tokens under $5M volume.</p>';
  }

  // Populate top pairs
  const topTokens = sortedTokens.slice(0, 5).map(token => token.symbol);
  topPairs.innerHTML = topTokens.map((pair, index) => {
    const token = sortedTokens[index];
    const opacity = 20 + (index / 4) * 30;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    return `<li class="px-2 py-1 rounded ${bgColor} hover-glow transition ${glowClass} ${hoverClass}">${pair}/USDT</li>`;
  }).join('');

  // Populate marquee with top 3 winners, Ice King puns, and top 3 losers
  let punIndex = 0;
  function updateMarquee() {
    const winners = sortedTokens.filter(t => t.price_change_percentage_24h > 0).slice(0, 3);
    const losers = sortedTokens.filter(t => t.price_change_percentage_24h < 0).slice(-3);
    const currentPun = iceKingPuns[punIndex];
    punIndex = (punIndex + 1) % iceKingPuns.length;
    const marqueeItems = [
      ...winners.map(t => `<span class="glow-green text-green-400">🏆 ${t.symbol}: +${t.price_change_percentage_24h.toFixed(2)}%</span>`),
      `<span class="glow-purple text-purple-400">${currentPun}</span>`,
      ...losers.map(t => `<span class="glow-red text-red-400">📉 ${t.symbol}: ${t.price_change_percentage_24h.toFixed(2)}%</span>`)
    ];
    marquee.innerHTML = marqueeItems.join('');
    setTimeout(updateMarquee, 30000); // Rotate pun after each marquee cycle (30s)
  }
  updateMarquee();

  if (sortedTokens.length > 0) {
    const firstTokenLi = tokenList.children[0];
    firstTokenLi.classList.add('selected-token');
    selectedTokenLi = firstTokenLi;
    showPriceChart(sortedTokens[0]);
  }

  loader.style.display = 'none';
}

// Show Price Chart using Chart.js with CoinGecko data
async function showPriceChart(token) {
  const chartContainer = document.getElementById('chart-container');
  const chartTitle = document.getElementById('chart-title');
  chartTitle.textContent = `${token.name} (${token.symbol}/USDT)`;

  // Update chart title hover effect based on performance
  chartTitle.onmouseover = () => {
    chartTitle.style.color = token.price_change_percentage_24h >= 0 ? 'rgba(74, 222, 128, 0.8)' : 'rgba(248, 113, 113, 0.8)';
    chartTitle.style.opacity = '0.75';
  };
  chartTitle.onmouseout = () => {
    chartTitle.style.color = '';
    chartTitle.style.opacity = '1';
  };

  // Clear and destroy existing chart if it exists
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  // Remove existing canvas and create a new one
  let chartCanvas = document.getElementById('chart-canvas');
  if (chartCanvas) {
    chartCanvas.remove();
  }
  chartCanvas = document.createElement('canvas');
  chartCanvas.id = 'chart-canvas';
  chartCanvas.style.width = '100%';
  chartCanvas.style.height = '100%';
  chartContainer.appendChild(chartCanvas);

  // Ensure canvas is in DOM before proceeding
  if (!chartCanvas || !chartCanvas.getContext) {
    console.error('Canvas creation failed');
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Failed to create chart canvas.</div>';
    return;
  }

  try {
    // Fetch historical price data from CoinGecko with retry
    const chartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(token.id));
    let chartData;
    try {
      chartData = await fetchWithRetry(chartUrl);
      console.log(`Chart data for ${token.id}:`, chartData);
    } catch (error) {
      console.warn(`Failed to fetch chart data for ${token.id}. Using mock data.`, error);
      chartData = mockChartData;
    }

    if (!chartData.prices || !Array.isArray(chartData.prices)) {
      throw new Error('Invalid chart data format: prices array missing');
    }

    const prices = chartData.prices; // Array of [timestamp, price]
    const labels = prices.map(price => new Date(price[0]).toLocaleDateString());
    const data = prices.map(price => price[1]);

    // Create new Chart.js chart
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    priceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${token.symbol}/USD Price`,
          data: data,
          borderColor: '#9333ea',
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Date',
              color: '#d1d4dc'
            },
            ticks: {
              color: '#d1d4dc',
              maxTicksLimit: 7
            },
            grid: {
              color: 'rgba(59, 130, 246, 0.1)'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Price (USD)',
              color: '#d1d4dc'
            },
            ticks: {
              color: '#d1d4dc',
              callback: function(value) {
                return '$' + value.toFixed(6);
              }
            },
            grid: {
              color: 'rgba(59, 130, 246, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#d1d4dc'
            }
          }
        },
        elements: {
          line: {
            borderWidth: 2
          }
        }
      }
    });
    console.log(`Chart rendered for ${token.id}`);
  } catch (error) {
    console.error('Error rendering chart:', error);
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Failed to load chart data. Try another token or check console.</div>';
  }
}

// Process alert data for display
function processAlert(alert) {
  const li = document.createElement('li');
  li.className = 'bg-gray-700/40 p-2 rounded-md shadow hover-glow transition fade-in';
  const eventType = alert.event || 'unknown';
  const signal = alert.signal || '';
  const market = alert.market || 'N/A';
  const timestamp = alert.timestamp || new Date().toISOString();
  let message = '';
  let emoji = '✅';
  if (eventType.includes('entry')) {
    emoji = eventType.includes('long') ? '🚀' : '🧪';
    message = `${signal.toUpperCase()} Entry on ${market}`;
  } else if (eventType.includes('exit')) {
    emoji = eventType.includes('protect') ? '🛡️' : '🏁';
    message = `${signal.toUpperCase()} Exit on ${market}`;
  } else if (eventType === 'filter_blocked') {
    emoji = '🧊';
    message = `Blocked ${signal.toUpperCase()} on ${market} (${alert.filter})`;
  } else {
    message = `${eventType} on ${market}`;
  }
  li.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-medium truncate text-gray-200">${emoji} ${message}</span>
      <span class="text-xs text-gray-400">${new Date(timestamp).toLocaleTimeString()}</span>
    </div>`;
  return li;
}

// Mock alert generator
function generateMockAlerts() {
  const alerts = [];
  const events = ['long_entry', 'short_entry', 'exit', 'protect_exit', 'filter_blocked'];
  const markets = ['BTC-USDT', 'ETH-USDT', 'FLOKI-USDT'];
  for (let i = 0; i < 10; i++) {
    const event = events[Math.floor(Math.random() * events.length)];
    alerts.push({
      type: 'debug',
      event: event,
      signal: event.includes('entry') ? 'buy' : 'sell',
      market: markets[Math.floor(Math.random() * markets.length)],
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 10).toISOString(),
      filter: event === 'filter_blocked' ? 'low_volume' : undefined
    });
  }
  return alerts;
}

// Fetch logs from Better Stack Live Tail API or use mock data
async function initLogStream() {
  const wsStatus = document.getElementById('ws-status');
  const alertList = document.getElementById('alert-list');
  const toggleLive = document.getElementById('toggle-live');
  let isLive = false;
  let nextUrl = null;

  async function fetchLogs() {
    try {
      const url = nextUrl || `${BETTERSTACK_API}?source_ids=${SOURCE_ID}&query=type%3Ddebug&batch=50&from=${new Date(Date.now() - 30 * 60 * 1000).toISOString()}&to=${new Date().toISOString()}&order=newest_first`;
      console.log('Fetching logs from:', url);
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected response format: ${contentType}`);
      }

      const data = await response.json();
      console.log('Response data:', data);
      nextUrl = data.pagination?.next || null;
      console.log('Next URL:', nextUrl);

      const logs = data.rows || [];
      if (logs.length > 0) {
        logs.forEach((log, index) => {
          try {
            console.log(`Processing log ${index}:`, log);
            const alert = typeof log.message === 'string' ? JSON.parse(log.message) : log.message;
            console.log(`Parsed alert ${index}:`, alert);
            if (alert.type === 'debug' && alert.event) {
              const li = processAlert(alert);
              alertList.prepend(li);
              while (alertList.children.length > 20) {
                alertList.removeChild(alertList.lastChild);
              }
            }
          } catch (error) {
            console.warn(`Invalid log format at index ${index}:`, error);
          }
        });
        wsStatus.textContent = 'Live logs active';
        wsStatus.className = 'mb-2 text-green-400 text-xs sm:text-sm';
      } else {
        wsStatus.textContent = 'No new logs...';
        wsStatus.className = 'mb-2 text-gray-400 text-xs sm:text-sm';
      }
    } catch (error) {
      console.error('Log fetch error:', error);
      wsStatus.textContent = `Error: ${error.message}. Using mock data.`;
      wsStatus.className = 'mb-2 text-red-400 text-xs sm:text-sm';
      if (!isLive) generateMockAlerts().forEach(alert => alertList.prepend(processAlert(alert)));
    }
  }

  toggleLive.addEventListener('click', () => {
    isLive = !isLive;
    toggleLive.textContent = `${isLive ? 'Live' : 'Mock'} (Toggle ${isLive ? 'Mock' : 'Live'})`;
    alertList.innerHTML = '';
    nextUrl = null;
    fetchLogs();
  });

  wsStatus.textContent = 'Starting with mock data...';
  wsStatus.className = 'mb-2 text-yellow-400 text-xs sm:text-sm';
  fetchLogs();
  setInterval(fetchLogs, POLLING_INTERVAL);
}

fetchLowVolumeTokens();
initLogStream();
