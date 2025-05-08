const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const WEBSOCKET_URL = 'wss://your-websocket-server'; // Replace with actual WebSocket URL from apexomni-tradingview-connect

// Fetch low-volume tokens from CoinGecko
async function fetchLowVolumeTokens() {
  try {
    const response = await fetch(COINGECKO_API);
    const data = await response.json();
    const lowVolumeTokens = data.filter(token => token.total_volume < 1_000_000);
    const tokenList = document.getElementById('token-list');
    const loader = document.getElementById('loader-tokens');
    loader.style.display = 'none';

    lowVolumeTokens.forEach(token => {
      const li = document.createElement('li');
      li.className = 'bg-secondary p-4 rounded-md shadow hover:bg-gray-700 transition';
      const priceChange = token.price_change_percentage_24h;
      const priceChangeEmoji = priceChange >= 0 ? '🤑' : '🤮';
      const priceChangeColor = priceChange >= 0 ? 'text-success' : 'text-danger';
      li.innerHTML = `
        <div class="flex flex-col space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-medium">🍀 ${token.name} (${token.symbol.toUpperCase()})</span>
            <span class="text-sm text-gray-400">Vol: $${token.total_volume.toLocaleString()}</span>
          </div>
          <div class="text-sm text-gray-300">
            <p>Price: $${token.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</p>
            <p class="${priceChangeColor}">24h Change: ${priceChange.toFixed(2)}% ${priceChangeEmoji}</p>
            <p>Market Cap: $${token.market_cap.toLocaleString()}</p>
            <p>Circulating Supply: ${token.circulating_supply.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${token.symbol.toUpperCase()}</p>
          </div>
        </div>`;
      tokenList.appendChild(li);
    });

    if (lowVolumeTokens.length === 0) {
      tokenList.innerHTML = '<p class="text-gray-400">No tokens under $1M volume at this time.</p>';
    }
  } catch (error) {
    document.getElementById('loader-tokens').textContent = 'Error loading token data.';
    console.error('Error fetching token data:', error);
  }
}

// Initialize WebSocket for TradingView alerts
function initWebSocket() {
  const ws = new WebSocket(WEBSOCKET_URL);
  const alertList = document.getElementById('alert-list');
  const wsStatus = document.getElementById('ws-status');

  ws.onopen = () => {
    wsStatus.textContent = 'Connected to WebSocket';
    wsStatus.className = 'mb-4 text-success';
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
      alertList.prepend(li); // Add new alerts at the top
      // Limit to 20 alerts to prevent overflow
      while (alertList.children.length > 20) {
        alertList.removeChild(alertList.lastChild);
      }
    } catch (error) {
      console.error('Error processing alert:', error);
    }
  };

  ws.onclose = () => {
    wsStatus.textContent = 'Disconnected from WebSocket. Reconnecting...';
    wsStatus.className = 'mb-4 text-danger';
    setTimeout(initWebSocket, 5000); // Reconnect after 5 seconds
  };

  ws.onerror = (error) => {
    wsStatus.textContent = 'WebSocket error. Reconnecting...';
    wsStatus.className = 'mb-4 text-danger';
    console.error('WebSocket error:', error);
  };
}

// Initialize both functionalities
fetchLowVolumeTokens();
initWebSocket();
