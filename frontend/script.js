const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const WEBSOCKET_URL = 'wss://omni-trading-webhook:10000';

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

// Initialize WebSocket for TradingView alerts
function initWebSocket() {
  let ws;
  const wsStatus = document.getElementById('ws-status');
  const alertList = document.getElementById('alert-list');
  let retryCount = 0;
  const maxRetries = 5;

  function connect() {
    try {
      ws = new WebSocket(WEBSOCKET_URL);
    } catch (error) {
      wsStatus.textContent = `Failed to initialize WebSocket: ${error.message}. Ensure backend is running and accessible from Render IPs: 44.226.145.213, 54.187.200.255, 34.213.214.55, 35.164.95.156, 44.230.95.183, 44.229.200.200.`;
      wsStatus.className = 'mb-4 text-danger';
      console.error('WebSocket initialization error:', error);
      return;
    }

    ws.onopen = () => {
      wsStatus.textContent = 'Connected to WebSocket';
      wsStatus.className = 'mb-4 text-success';
      retryCount = 0;
      console.log('WebSocket connected to:', WEBSOCKET_URL);
    };

    ws.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data);
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
        alertList.prepend(li);
        while (alertList.children.length > 20) {
          alertList.removeChild(alertList.lastChild);
        }
      } catch (error) {
        console.error('Error processing alert:', error);
      }
    };

    ws.onclose = (event) => {
      console.warn(`WebSocket closed: Code=${event.code}, Reason=${event.reason || 'No reason provided'}`);
      let errorMessage = 'Disconnected from WebSocket.';
      if (event.code === 1006) {
        errorMessage += ' Likely network issue or backend not running. Ensure backend accepts Render IPs: 44.226.145.213, 54.187.200.255, 34.213.214.55, 35.164.95.156, 44.230.95.183, 44.229.200.200.';
      } else if (event.code === 1001) {
        errorMessage += ' Backend may be shutting down.';
      }
      if (retryCount < maxRetries) {
        wsStatus.textContent = `${errorMessage} Reconnecting (${retryCount + 1}/${maxRetries})...`;
        wsStatus.className = 'mb-4 text-danger';
        retryCount++;
        setTimeout(connect, 5000);
      } else {
        wsStatus.textContent = `${errorMessage} Failed after ${maxRetries} attempts. Expose backend via ngrok or deploy on Render and whitelist Render IPs.`;
        wsStatus.className = 'mb-4 text-danger';
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      wsStatus.textContent = 'WebSocket error occurred. Check console and ensure backend is accessible from Render IPs: 44.226.145.213, 54.187.200.255, 34.213.214.55, 35.164.95.156, 44.230.95.183, 44.229.200.200.';
      wsStatus.className = 'mb-4 text-danger';
    };
  }

  connect();
}

// Initialize both functionalities
fetchLowVolumeTokens();
initWebSocket();
