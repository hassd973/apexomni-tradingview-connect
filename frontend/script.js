const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = 'https://s1303816.eu-nbg-2.betterstackdata.com';
const BETTERSTACK_TOKEN = 'x5nvK7DNDURcpAHEBuCbHrza';
const POLLING_INTERVAL = 10000; // Poll every 10 seconds
const FETCH_TIMEOUT = 10000; // 10-second timeout

// Fetch low-volume tokens and top pairs
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  const sortToggle = document.getElementById('sort-toggle');
  let tokens = [];
  const volumeThreshold = 5_000_000; // $5M threshold
  let sortAscending = false;

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

  // Deduplicate and sort
  const uniqueTokens = [];
  const seenSymbols = new Set();
  for (const token of tokens) {
    if (!seenSymbols.has(token.symbol)) {
      seenSymbols.add(token.symbol);
      uniqueTokens.push(token);
    }
  }

  function renderTokens() {
    tokenList.innerHTML = '';
    const sortedTokens = [...uniqueTokens].sort((a, b) =>
      sortAscending
        ? a.price_change_percentage_24h - b.price_change_percentage_24h
        : b.price_change_percentage_24h - a.price_change_percentage_24h
    );

    sortedTokens.forEach((token, index) => {
      const li = document.createElement('li');
      const opacity = 50 + (index / sortedTokens.length) * 50; // Gradient from 50 to 100
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
  }

  sortToggle.addEventListener('click', () => {
    sortAscending = !sortAscending;
    sortToggle.textContent = `Sort: ${sortAscending ? 'Low to High' : 'High to Low'}`;
    renderTokens();
  });

  loader.style.display = 'none';
  renderTokens();
}

// Show custom Canvas chart
function showPriceChart(token) {
  const chartContainer = document.getElementById('chart-container');
  const chartTitle = document.getElementById('chart-title');
  const canvas = document.getElementById('custom-chart');
  const ctx = canvas.getContext('2d');
  chartContainer.innerHTML = ''; // Reset container
  chartContainer.appendChild(chartTitle);
  chartContainer.appendChild(canvas);
  chartContainer.classList.remove('hidden');
  chartTitle.textContent = `${token.name} (${token.symbol}/USDT) Price Trend (Simulated)`;

  // Clear previous chart
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Simulated 30-day price data based on current price and 24h change
  const days = 30;
  const basePrice = token.current_price;
  const changePercent = token.price_change_percentage_24h / 100;
  const data = Array.from({ length: days }, (_, i) => {
    const dayChange = changePercent * (Math.random() * 0.5 + 0.75); // Random variation
    return basePrice * (1 + dayChange * (i / days));
  });

  // Draw chart
  const step = canvas.width / (days - 1);
  ctx.beginPath();
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 2;
  ctx.moveTo(0, canvas.height - (data[0] / Math.max(...data)) * (canvas.height - 20));
  for (let i = 1; i < days; i++) {
    ctx.lineTo(i * step, canvas.height - (data[i] / Math.max(...data)) * (canvas.height - 20));
  }
  ctx.stroke();

  // Add axes and labels
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px Arial';
  ctx.fillText('Price', 10, 15);
  ctx.fillText('Days', canvas.width - 40, canvas.height - 5);
  for (let i = 0; i < 5; i++) {
    const y = canvas.height - (i / 4) * (canvas.height - 20);
    ctx.fillText((Math.max(...data) * (i / 4)).toFixed(2), 0, y);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(10, y);
    ctx.strokeStyle = '#666';
    ctx.stroke();
  }
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

// Fetch logs from Better Stack or use mock data
async function initLogStream() {
  const wsStatus = document.getElementById('ws-status');
  const alertList = document.getElementById('alert-list');
  const toggleLive = document.getElementById('toggle-live');
  let isLive = false;
  let offset = 0;

  async function pollLogs() {
    try {
      if (isLive) {
        const query = `SELECT * FROM t371838.ice_king_logs WHERE type = 'debug' ORDER BY timestamp DESC LIMIT 100 OFFSET ${offset}`;
        console.debug(`Fetching Better Stack logs: Query=${query}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(BETTERSTACK_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BETTERSTACK_TOKEN}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            dt: new Date().toISOString(),
            message: query
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch logs`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Unexpected response format: Content-Type=${contentType}`);
        }

        const data = await response.json();
        const logs = Array.isArray(data) ? data : data.data || [];
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
          offset += logs.length;
        } else {
          wsStatus.textContent = 'Waiting for new logs...';
          wsStatus.className = 'mb-4 text-gray-400';
        }
      } else {
        const mockAlerts = generateMockAlerts();
        mockAlerts.forEach(alert => {
          const li = processAlert(alert);
          alertList.prepend(li);
          while (alertList.children.length > 20) {
            alertList.removeChild(alertList.lastChild);
          }
        });
        wsStatus.textContent = 'Using mock data. Set up a proxy for live logs.';
        wsStatus.className = 'mb-4 text-yellow-400';
      }
    } catch (error) {
      console.error('Log polling error:', error);
      wsStatus.textContent = `Error: ${error.message}. Using mock data or check proxy setup.`;
      wsStatus.className = 'mb-4 text-red-400';
      if (!isLive) generateMockAlerts().forEach(alert => alertList.prepend(processAlert(alert)));
    }
    setTimeout(pollLogs, POLLING_INTERVAL);
  }

  toggleLive.addEventListener('click', () => {
    isLive = !isLive;
    toggleLive.textContent = `${isLive ? 'Live Data' : 'Mock Data'} (Toggle ${isLive ? 'Mock' : 'Live'})`;
    alertList.innerHTML = '';
    offset = 0;
    pollLogs();
  });

  wsStatus.textContent = 'Starting with mock data...';
  wsStatus.className = 'mb-4 text-yellow-400';
  pollLogs();
}

// Initialize both functionalities
fetchLowVolumeTokens();
initLogStream();
