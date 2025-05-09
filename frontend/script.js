const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_LIVE_TAIL_API = 'https://telemetry.betterstack.com/api/v2/query/live-tail';
const BETTERSTACK_TOKEN = 'x5nvK7DNDURcpAHEBuCbHrza'; // Source token for ice_king
const BETTERSTACK_SOURCE_IDS = '1303816'; // Numeric source ID for ice_king
const POLLING_INTERVAL = 10000; // Poll every 10 seconds

// Fetch low-volume tokens from multiple sources
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const tokens = [];
  const volumeThreshold = 5_000_000; // $5M threshold

  // CoinGecko
  try {
    const cgResponse = await fetch(COINGECKO_API);
    const cgData = await cgResponse.json();
    tokens.push(...cgData.filter(token => token.total_volume < volumeThreshold).map(token => ({
      name: token.name,
      symbol: token.symbol.toUpperCase(),
      total_volume: token.total_volume,
      current_price: token.current_price,
      price_change_percentage_24h: token.price_change_percentage_24h,
      market_cap: token.market_cap,
      circulating_supply: token.circulating_supply,
      source: 'CoinGecko'
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
      name: token.name,
      symbol: token.symbol.toUpperCase(),
      total_volume: token.quote.USD.volume_24h,
      current_price: token.quote.USD.price,
      price_change_percentage_24h: token.quote.USD.percent_change_24h,
      market_cap: token.quote.USD.market_cap,
      circulating_supply: token.circulating_supply,
      source: 'CoinMarketCap'
    })));
  } catch (error) {
    console.error('CoinMarketCap error:', error);
  }

  // CryptoCompare
  try {
    const ccResponse = await fetch(CRYPTOCOMPARE_API);
    const ccData = await ccResponse.json();
    tokens.push(...ccData.Data.filter(token => token.RAW?.USD?.VOLUME24HOURTO < volumeThreshold).map(token => ({
      name: token.CoinInfo.FullName,
      symbol: token.CoinInfo.Name.toUpperCase(),
      total_volume: token.RAW?.USD?.VOLUME24HOURTO || 0,
      current_price: token.RAW?.USD?.PRICE || 0,
      price_change_percentage_24h: token.RAW?.USD?.CHANGEPCT24HOUR || 0,
      market_cap: token.RAW?.USD?.MKTCAP || 0,
      circulating_supply: token.RAW?.USD?.SUPPLY || 0,
      source: 'CryptoCompare'
    })));
  } catch (error) {
    console.error('CryptoCompare error:', error);
  }

  // Deduplicate by symbol
  const uniqueTokens = [];
  const seenSymbols = new Set();
  for (const token of tokens) {
    if (!seenSymbols.has(token.symbol)) {
      seenSymbols.add(token.symbol);
      uniqueTokens.push(token);
    }
  }

  loader.style.display = 'none';
  uniqueTokens.forEach(token => {
    const li = document.createElement('li');
    li.className = 'bg-secondary p-4 rounded-md shadow hover:bg-gray-700 transition';
    const priceChange = token.price_change_percentage_24h;
    const priceChangeEmoji = priceChange >= 0 ? '🤑' : '🤮';
    const priceChangeColor = priceChange >= 0 ? 'text-success' : 'text-danger';
    li.innerHTML = `
      <div class="flex flex-col space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-medium">🍀 ${token.name} (${token.symbol})</span>
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
    tokenList.appendChild(li);
  });

  if (uniqueTokens.length === 0) {
    tokenList.innerHTML = '<p class="text-gray-400">No tokens under $5M volume at this time.</p>';
  }
}

// Process alert data for display
function processAlert(alert) {
  const li = document.createElement('li');
  li.className = 'bg-secondary p-4 rounded-md shadow hover:bg-gray-700 transition';
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
      <span class="font-medium">${emoji} ${message}</span>
      <span class="text-sm text-gray-400">${new Date(timestamp).toLocaleTimeString()}</span>
    </div>`;
  return li;
}

// Fetch live logs from Better Stack Live Tail
async function initLogStream() {
  const wsStatus = document.getElementById('ws-status');
  const alertList = document.getElementById('alert-list');
  let nextUrl = null;

  async function pollLogs() {
    try {
      // Build initial query or use nextUrl
      const baseUrl = nextUrl || BETTERSTACK_LIVE_TAIL_API;
      const params = nextUrl ? {} : {
        source_ids: BETTERSTACK_SOURCE_IDS,
        query: 'type=debug',
        batch: '100',
        order: 'newest_first',
        from: new Date(Date.now() - 30000).toISOString()
      };
      const url = nextUrl || `${baseUrl}?${new URLSearchParams(params).toString()}`;
      console.debug(`Fetching Better Stack Live Tail: URL=${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${BETTERSTACK_TOKEN}`
        },
        redirect: 'follow'
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${errorText}`;
        let userMessage = 'Error fetching logs. Check console for details.';

        if (response.status === 401) {
          errorMessage = `HTTP 401 Unauthorized: Invalid or expired token. Check BETTERSTACK_TOKEN (${BETTERSTACK_TOKEN.slice(0, 4)}...).`;
          userMessage = 'Invalid token. Verify source token in Better Stack > Sources > ice_king.';
        } else if (response.status === 400) {
          errorMessage = `HTTP 400 Bad Request: Likely invalid source_ids (${BETTERSTACK_SOURCE_IDS}) or query parameters. Response: ${errorText}`;
          userMessage = `Invalid source ID or query. Verify source_ids (${BETTERSTACK_SOURCE_IDS}) in Better Stack > Sources > ice_king.`;
        } else if (response.status >= 500) {
          errorMessage = `HTTP ${response.status} Server Error: Better Stack API issue. Response: ${errorText}`;
          userMessage = 'Better Stack API server error. Try again later or contact support.';
        }

        console.error(`Better Stack polling error: ${errorMessage}`, {
          url,
          status: response.status,
          responseText: errorText
        });
        wsStatus.textContent = userMessage;
        wsStatus.className = 'mb-4 text-danger';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.debug('Better Stack Live Tail response:', data);

      if (!data.data) {
        console.warn('No data field in response. Possible API change or empty logs.', data);
        wsStatus.textContent = 'No logs received. Check if logs exist in Better Stack > ice_king.';
        wsStatus.className = 'mb-4 text-gray-400';
        return;
      }

      const logs = data.data || [];
      nextUrl = data.pagination?.next || null;

      if (logs.length > 0) {
        console.debug(`Received ${logs.length} logs from Better Stack.`);
        logs.reverse().forEach((log, index) => {
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
        wsStatus.className = 'mb-4 text-success';
      } else {
        console.debug('No new logs received from Better Stack.');
        wsStatus.textContent = 'Waiting for new logs...';
        wsStatus.className = 'mb-4 text-gray-400';
      }
    } catch (error) {
      console.error('Better Stack polling error:', error);
      if (!wsStatus.textContent.includes('Error fetching logs')) {
        wsStatus.textContent = `Error fetching logs: ${error.message}. Check console for details.`;
        wsStatus.className = 'mb-4 text-danger';
      }
      nextUrl = null; // Reset pagination on error
    }
    setTimeout(pollLogs, POLLING_INTERVAL);
  }

  wsStatus.textContent = 'Connecting to Better Stack Live Tail...';
  wsStatus.className = 'mb-4 text-gray-400';
  pollLogs();
}

// Initialize both functionalities
fetchLowVolumeTokens();
initLogStream();
