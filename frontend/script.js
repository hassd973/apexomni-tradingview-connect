const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = 'https://eu-nbg-2-connect.betterstackdata.com';
const BETTERSTACK_USERNAME = 'ua439SvEJ8fzbFUfZLgfrngQ0hPAJWpeW';
const BETTERSTACK_PASSWORD = 'ACTAv2qyDnjVwEoeByXTZzY7LT0CBcT4Zd86AjYnE7fy6kPB5TYr4pjFqIfTjiPs';
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

// Show TradingView chart
async function showPriceChart(token) {
  const chartContainer = document.getElementById('chart-container');
  const chartTitle = document.getElementById('chart-title');
  const chartDiv = document.getElementById('tradingview-chart');
  chartContainer.innerHTML = ''; // Reset container
  chartContainer.appendChild(chartTitle);
  chartContainer.appendChild(chartDiv);
  chartContainer.classList.remove('hidden');
  chartTitle.textContent = `${token.name} (${token.symbol}/USDT) Price Movement`;

  // Destroy existing chart if it exists
  if (window.chart) window.chart.remove();

  // Initialize TradingView Lightweight Chart
  const chart = LightweightCharts.createChart(chartDiv, {
    width: chartDiv.clientWidth,
    height: 300,
    layout: { backgroundColor: '#1A202C', textColor: '#FFFFFF' },
    grid: { vertLines: { color: '#2D3748' }, horzLines: { color: '#2D3748' } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });
  window.chart = chart;

  // Simulate historical data (replace with TradingView API call via proxy)
  const pair = `${token.symbol.toLowerCase()}usdt`;
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair.toUpperCase()}&interval=1d&limit=30`);
    if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch data for ${pair}`);
    const data = await response.json();
    const candles = data.map(([time, open, high, low, close]) => ({
      time: parseInt(time) / 1000,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close)
    }));

    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(candles);
  } catch (error) {
    console.error(`Chart error for ${token.name} (${pair}):`, error);
    chartDiv.innerHTML = `<p class="text-red-400">Failed to load chart for ${token.name}: ${error.message}. Consider setting up a proxy for TradingView API.</p>`;
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

// Fetch logs from Better Stack ClickHouse
async function initLogStream() {
  const wsStatus = document.getElementById('ws-status');
  const alertList = document.getElementById('alert-list');
  let offset = 0;

  async function pollLogs() {
    try {
      const query = `SELECT * FROM t371838.ice_king_logs WHERE type = 'debug' ORDER BY timestamp DESC LIMIT 100 OFFSET ${offset}`;
      console.debug(`Fetching Better Stack logs: Query=${query}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(`${BETTERSTACK_API}?output_format_pretty_row_numbers=0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'plain/text',
          'Authorization': 'Basic ' + btoa(`${BETTERSTACK_USERNAME}:${BETTERSTACK_PASSWORD}`),
          'Accept': 'application/json'
        },
        body: query,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${errorText}`;
        let userMessage = 'Error fetching logs. Check console and Network tab (F12 > Network) for details.';

        if (response.status === 401) {
          errorMessage = `HTTP 401 Unauthorized: Invalid username/password. Check BETTERSTACK_USERNAME and BETTERSTACK_PASSWORD.`;
          userMessage = 'Invalid credentials. Verify username/password in Better Stack.';
        } else if (response.status === 400) {
          errorMessage = `HTTP 400 Bad Request: Invalid query or table. Query: ${query}. Response: ${errorText}`;
          userMessage = 'Invalid query or table. Verify t371838.ice_king_logs exists.';
        } else if (response.status >= 500) {
          errorMessage = `HTTP ${response.status} Server Error: Better Stack issue. Response: ${errorText}`;
          userMessage = 'Better Stack server error. Try again later or contact support.';
        }

        console.error(`Better Stack polling error: ${errorMessage}`, { query, status: response.status, responseText: errorText });
        wsStatus.textContent = userMessage;
        wsStatus.className = 'mb-4 text-red-400';
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error(`Unexpected response format: Content-Type=${contentType}`, { responseText: errorText });
        wsStatus.textContent = 'Unexpected response format. Check console and Network tab for details.';
        wsStatus.className = 'mb-4 text-red-400';
        throw new Error(`Unexpected response format: Content-Type=${contentType}`);
      }

      const data = await response.json();
      console.debug('Better Stack response:', data);

      if (!data.data) {
        console.warn('No data field in response. Possible empty logs or table issue.', data);
        wsStatus.textContent = 'No logs received. Check if logs exist in Better Stack > ice_king_logs.';
        wsStatus.className = 'mb-4 text-gray-400';
        return;
      }

      const logs = data.data || [];
      if (logs.length > 0) {
        console.debug(`Received ${logs.length} logs from Better Stack.`);
        logs.forEach((log, index) => {
          try {
            if (!log.message) {
              console.warn(`Log ${index} has no message field:`, log);
              return;
            }
            const alert = JSON.parse(log.message);
            if (alert.type === 'debug' && alert.event) {
              console.debug(`Processing valid ICE KING alert:`, alert);
              const li = processAlert(alert);
              alertList.prepend(li);
              while (alertList.children.length > 20) {
                alertList.removeChild(alertList.lastChild);
              }
            } else {
              console.debug(`Skipping log ${index}: Not a debug alert or missing event.`, alert);
            }
          } catch (error) {
            console.warn(`Invalid log message format in log ${index}:`, log.message, error);
          }
        });
        wsStatus.textContent = 'Receiving live logs from Better Stack';
        wsStatus.className = 'mb-4 text-green-400';
        offset += logs.length; // Update offset for pagination
      } else {
        console.debug('No new logs received from Better Stack.');
        wsStatus.textContent = 'Waiting for new logs...';
        wsStatus.className = 'mb-4 text-gray-400';
      }
    } catch (error) {
      let errorMessage = error.message;
      let userMessage = `Error fetching logs: ${errorMessage}. Check console and Network tab (F12 > Network) for details.`;

      if (error.name === 'AbortError') {
        errorMessage = `Request timed out after ${FETCH_TIMEOUT}ms. Possible network issue or API unreachable.`;
        userMessage = 'Connection to Better Stack timed out. Check Network tab (F12 > Network).';
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = `Failed to fetch: Likely CORS issue, network error, or API unreachable. Check Network tab (F12 > Network) for CORS headers (e.g., Access-Control-Allow-Origin).`;
        userMessage = 'Failed to connect to Better Stack. Check Network tab (F12 > Network) for CORS or network issues.';
      }

      console.error(`Better Stack polling error: ${errorMessage}`, {
        query,
        possibleCauses: [
          'CORS restriction: Better Stack API may not allow browser requests. Use a backend proxy.',
          'Network issue: Render IPs may be blocked or API is down.',
          'Invalid credentials: Verify BETTERSTACK_USERNAME and BETTERSTACK_PASSWORD.',
          'Table issue: Verify t371838.ice_king_logs exists.'
        ]
      });
      wsStatus.textContent = userMessage;
      wsStatus.className = 'mb-4 text-red-400';
      offset = 0; // Reset offset on error
    }
    setTimeout(pollLogs, POLLING_INTERVAL);
  }

  wsStatus.textContent = 'Connecting to Better Stack...';
  wsStatus.className = 'mb-4 text-gray-400';
  pollLogs();
}

// Initialize both functionalities
fetchLowVolumeTokens();
initLogStream();
