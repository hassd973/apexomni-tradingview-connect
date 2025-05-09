const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=100&convert=USD';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = 'https://telemetry.betterstack.com/api/v2/query/live-tail';
const BETTERSTACK_TOKEN = 'WGdCT5KhHtg4kiGWAbdXRaSL';
const SOURCE_ID = '1303816';
const POLLING_INTERVAL = 15000;
const BINANCE_API = 'https://api.binance.com/api/v3/klines';

// Mock token data for fallback
const mockTokens = [
  { id: 'floki', name: 'FLOKI', symbol: 'FLOKI', total_volume: 4500000, current_price: 0.00015, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 10000000000000, source: 'Mock', score: 52.6 },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', total_volume: 3000000, current_price: 0.000013, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 589000000000000, source: 'Mock', score: 48.9 }
];

// Fetch low-volume tokens and top pairs
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  let tokens = [];

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

  const sortedTokens = [...uniqueTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  tokenList.innerHTML = '';
  sortedTokens.forEach((token, index) => {
    const li = document.createElement('li');
    const opacity = 30 + (index / sortedTokens.length) * 40;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    li.className = `p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} ${hoverClass}`;
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
        </div>
      </div>`;
    li.addEventListener('click', () => showPriceChart(token));
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

  if (sortedTokens.length > 0) {
    showPriceChart(sortedTokens[0]);
  }

  loader.style.display = 'none';
}

// Show TradingView Lightweight Chart
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

  // Clear existing chart
  chartContainer.innerHTML = '';
  const chartElement = document.createElement('div');
  chartElement.id = 'chart-canvas';
  chartElement.style.width = '100%';
  chartElement.style.height = '100%';
  chartContainer.appendChild(chartElement);

  try {
    const chart = LightweightCharts.createChart(chartElement, {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(147, 51, 234, 0.1)' },
        horzLines: { color: 'rgba(59, 130, 246, 0.1)' },
      },
      timeScale: {
        borderColor: 'rgba(59, 130, 246, 0.2)',
      },
      rightPriceScale: {
        borderColor: 'rgba(59, 130, 246, 0.2)',
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
    });

    console.log('Chart container size:', chartContainer.clientWidth, chartContainer.clientHeight);
    console.log('TradingView chart created:', chart);

    const lineSeries = chart.addLineSeries({
      color: token.price_change_percentage_24h >= 0 ? '#4ade80' : '#f87171',
      lineWidth: 2,
    });

    // Test with mock data first
    const mockData = Array.from({ length: 100 }, (_, i) => ({
      time: Date.now() / 1000 - (99 - i) * 3600,
      value: token.current_price * (1 + (Math.random() - 0.5) * 0.1),
    }));
    lineSeries.setData(mockData);
    chart.timeScale().fitContent();
    console.log('Chart initialized with mock data');

    // Attempt to fetch real data
    const symbol = `${token.symbol.toLowerCase()}usdt`;
    try {
      const response = await fetch(`${BINANCE_API}?symbol=${symbol.toUpperCase()}&interval=1h&limit=168`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('No data from Binance');
      console.log('Binance data:', data);
      const chartData = data.map(d => ({
        time: parseInt(d[0]) / 1000, // Convert to seconds
        value: parseFloat(d[4]), // Use closing price
      }));
      lineSeries.setData(chartData);
      chart.timeScale().fitContent();
      console.log('Chart updated with Binance data');

      let lastClose = chartData[chartData.length - 1].value;
      setInterval(() => {
        lastClose += (Math.random() - 0.5) * lastClose * 0.001;
        const newPoint = { time: Math.floor(Date.now() / 1000), value: lastClose };
        lineSeries.update(newPoint);
      }, 5000);
    } catch (error) {
      console.error('Chart data fetch error:', error);
    }

    // Ensure chart resizes properly
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        chart.resize(entry.contentRect.width, entry.contentRect.height);
        chart.timeScale().fitContent();
        console.log('Chart resized to:', entry.contentRect.width, entry.contentRect.height);
      }
    });
    resizeObserver.observe(chartContainer);

    window.addEventListener('resize', () => {
      chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
      chart.timeScale().fitContent();
      console.log('Chart resized on window resize');
    });
  } catch (error) {
    console.error('TradingView chart initialization error:', error);
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Chart failed to load. Check console for errors.</div>';
    // Fallback Canvas Chart
    const canvas = document.createElement('canvas');
    canvas.id = 'fallback-canvas';
    canvas.width = chartContainer.clientWidth;
    canvas.height = chartContainer.clientHeight;
    chartContainer.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(74, 222, 128, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#d1d4dc';
      ctx.font = '16px Orbitron';
      ctx.fillText('Fallback Chart', 10, 20);
      console.log('Fallback canvas chart rendered');
    }
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
        headers: { 'Authorization': `Bearer ${BETTERSTACK_TOKEN}` },
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
