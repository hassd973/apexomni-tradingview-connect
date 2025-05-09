const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=100&convert=USD';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = 'https://telemetry.betterstack.com/api/v2/query/live-tail';
const BETTERSTACK_TOKEN = 'WGdCT5KhHtg4kiGWAbdXRaSL';
const SOURCE_ID = '1303816';
const POLLING_INTERVAL = 10000;
const BINANCE_API = 'https://api.binance.com/api/v3/klines';

// Fetch low-volume tokens and top pairs
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  let tokens = [];
  const volumeThreshold = 5_000_000;

  // CoinGecko
  try {
    const cgResponse = await fetch(COINGECKO_API);
    const cgData = await cgResponse.json();
    tokens.push(...cgData.filter(token => token.total_volume < volumeThreshold).map(token => ({
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

  // CoinMarketCap
  try {
    const cmcResponse = await fetch(COINMARKETCAP_API, {
      headers: { 'X-CMC_PRO_API_KEY': 'bef090eb-323d-4ae8-86dd-266236262f19' }
    });
    const cmcData = await cmcResponse.json();
    tokens.push(...cmcData.data.filter(token => token.quote.USD.volume_24h < volumeThreshold).map(token => ({
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

  // CryptoCompare
  try {
    const ccResponse = await fetch(CRYPTOCOMPARE_API);
    const ccData = await ccResponse.json();
    tokens.push(...ccData.Data.filter(token => token.RAW?.USD?.VOLUME24HOURTO < volumeThreshold).map(token => ({
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

  // Deduplicate
  const uniqueTokens = [];
  const seenSymbols = new Set();
  for (const token of tokens) {
    if (!seenSymbols.has(token.symbol)) {
      seenSymbols.add(token.symbol);
      uniqueTokens.push(token);
    }
  }

  // Sort by performance and render
  const sortedTokens = [...uniqueTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  tokenList.innerHTML = '';
  sortedTokens.forEach((token, index) => {
    const li = document.createElement('li');
    const opacity = 50 + (index / sortedTokens.length) * 50;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    li.className = `p-4 rounded-md shadow hover:bg-gray-700 transition cursor-pointer ${bgColor}`;
    const priceChange = token.price_change_percentage_24h;
    const priceChangeEmoji = priceChange >= 0 ? '🤑' : '🤮';
    const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';
    li.innerHTML = `
      <div class="flex flex-col space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-medium truncate">🍀 ${token.name} (${token.symbol}) [Score: ${token.score.toFixed(1)}]</span>
          <span class="text-sm text-gray-400">Vol: $${token.total_volume.toLocaleString()}</span>
        </div>
        <div class="text-sm text-gray-300">
          <p>Price: $${token.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</p>
          <p class="${priceChangeColor}">24h Change: ${priceChange.toFixed(2)}% ${priceChangeEmoji}</p>
          <p>Market Cap: $${token.market_cap.toLocaleString()}</p>
          <p>Circulating Supply: ${token.circulating_supply.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${token.symbol}</p>
          <p>Source: ${token.source}</p>
        </div>
      </div>`;
    li.addEventListener('click', () => showPriceChart(token));
    tokenList.appendChild(li);
  });

  if (sortedTokens.length === 0) {
    tokenList.innerHTML = '<p class="text-gray-400">No tokens under $5M volume at this time.</p>';
  }

  // Top pairs
  const topTokens = sortedTokens.slice(0, 5).map(token => `${token.symbol}/USDT`);
  topPairs.innerHTML = topTokens.map(pair => `<li>${pair}</li>`).join('');

  // Default chart to highest-performing token
  if (sortedTokens.length > 0) {
    showPriceChart(sortedTokens[0]);
  }

  loader.style.display = 'none';
}

// Show Lightweight Charts candlestick
async function showPriceChart(token) {
  const chartContainer = document.getElementById('chart-container');
  const chartTitle = document.getElementById('chart-title');
  const chartDiv = document.getElementById('chart-canvas');
  chartContainer.innerHTML = ''; // Reset container
  chartContainer.appendChild(chartTitle);
  chartContainer.appendChild(chartDiv);
  chartTitle.textContent = `${token.name} (${token.symbol}/USDT) Live Chart`;

  // Destroy existing chart if it exists
  if (window.chart) window.chart.remove();

  // Initialize Lightweight Charts
  const chart = LightweightCharts.createChart(chartDiv, {
    width: chartDiv.clientWidth,
    height: 500,
    layout: { background: { color: 'transparent' }, textColor: '#d1d5db' },
    grid: { vertLines: { color: 'rgba(255, 255, 255, 0.1)' }, horzLines: { color: 'rgba(255, 255, 255, 0.1)' } },
    timeScale: { timeVisible: true, secondsVisible: false }
  });
  window.chart = chart;

  // Fetch historical data from Binance
  const symbol = `${token.symbol.toLowerCase()}usdt`;
  try {
    const response = await fetch(`${BINANCE_API}?symbol=${symbol.toUpperCase()}&interval=1h&limit=168`); // 7 days of hourly data
    if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch data`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('No data returned');
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#4ade80',
      downColor: '#f87171',
      borderVisible: false,
      wickUpColor: '#4ade80',
      wickDownColor: '#f87171'
    });
    const candles = data.map(d => ({
      time: parseInt(d[0]) / 1000,
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4])
    }));
    candlestickSeries.setData(candles);

    // Simulate live updates
    let lastClose = candles[candles.length - 1].close;
    setInterval(() => {
      lastClose += (Math.random() - 0.5) * lastClose * 0.001;
      candlestickSeries.update({
        time: Math.floor(Date.now() / 1000),
        open: lastClose * 0.999,
        high: lastClose * 1.001,
        low: lastClose * 0.998,
        close: lastClose
      });
    }, 5000);
  } catch (error) {
    console.error('Chart data error:', error);
    const mockCandles = Array.from({ length: 168 }, (_, i) => ({
      time: Math.floor(Date.now() / 1000) - (167 - i) * 3600,
      open: token.current_price * (1 - 0.05 + Math.random() * 0.1),
      high: token.current_price * (1 + 0.05 + Math.random() * 0.1),
      low: token.current_price * (1 - 0.05 - Math.random() * 0.1),
      close: token.current_price * (1 - 0.05 + Math.random() * 0.1)
    }));
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#4ade80',
      downColor: '#f87171',
      borderVisible: false,
      wickUpColor: '#4ade80',
      wickDownColor: '#f87171'
    });
    candlestickSeries.setData(mockCandles);
  }

  // Resize handler for responsiveness
  window.addEventListener('resize', () => {
    chart.applyOptions({ width: chartDiv.clientWidth });
    chart.timeScale().fitContent();
  });
}

// Process alert data for display
function processAlert(alert) {
  const li = document.createElement('li');
  li.className = 'bg-gray-700/50 p-4 rounded-md shadow hover:bg-gray-600 transition';
  const eventType = alert.event || 'unknown';
  const signal = alert.signal || '';
  const market = alert.market || 'N/A';
  const timestamp = alert.timestamp || new Date().toISOString();
  let message = '';
  let emoji = '✅';
  if (eventType.includes('entry')) {
    emoji = eventType.includes('long') ? '🚀' : '🧪';
    message = `${signal.toUpperCase()} Entry on ${market} at ${timestamp}`;
  } else if (eventType.includes('exit')) {
    emoji = eventType.includes('protect') ? '🛡️' : '🏁';
    message = `${signal.toUpperCase()} Exit on ${market} at ${timestamp}`;
  } else if (eventType === 'filter_blocked') {
    emoji = '🧊';
    message = `Blocked ${signal.toUpperCase()} Signal on ${market} (${alert.filter}) at ${timestamp}`;
  } else {
    message = `${eventType} on ${market} at ${timestamp}`;
  }
  li.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-medium truncate">${emoji} ${message}</span>
      <span class="text-sm text-gray-400">${new Date(timestamp).toLocaleTimeString()}</span>
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
      const url = nextUrl || `${BETTERSTACK_API}?source_ids=${SOURCE_ID}&query=type%3Ddebug&batch=100&from=${new Date(Date.now() - 30 * 60 * 1000).toISOString()}&to=${new Date().toISOString()}&order=newest_first`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${BETTERSTACK_TOKEN}` },
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch logs`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected response format: Content-Type=${contentType}`);
      }

      const data = await response.json();
      nextUrl = data.pagination?.next || null;

      const logs = data.rows || [];
      if (logs.length > 0) {
        logs.forEach((log, index) => {
          try {
            const alert = typeof log.message === 'string' ? JSON.parse(log.message) : log.message;
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
        wsStatus.textContent = 'Receiving live logs from Better Stack';
        wsStatus.className = 'mb-4 text-green-400';
      } else {
        wsStatus.textContent = 'Waiting for new logs...';
        wsStatus.className = 'mb-4 text-gray-400';
      }
    } catch (error) {
      console.error('Log fetching error:', error);
      wsStatus.textContent = `Error: ${error.message}. Using mock data or check proxy setup.`;
      wsStatus.className = 'mb-4 text-red-400';
      if (!isLive) generateMockAlerts().forEach(alert => alertList.prepend(processAlert(alert)));
    }
  }

  toggleLive.addEventListener('click', () => {
    isLive = !isLive;
    toggleLive.textContent = `${isLive ? 'Live Data' : 'Mock Data'} (Toggle ${isLive ? 'Mock' : 'Live'})`;
    alertList.innerHTML = '';
    nextUrl = null;
    fetchLogs();
  });

  wsStatus.textContent = 'Starting with mock data...';
  wsStatus.className = 'mb-4 text-yellow-400';
  fetchLogs();
  setInterval(fetchLogs, POLLING_INTERVAL);
}

// Initialize both functionalities
fetchLowVolumeTokens();
initLogStream();
