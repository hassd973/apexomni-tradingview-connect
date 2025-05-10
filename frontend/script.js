// CoinMarketCap API configuration (proxying through backend)
const apiUrl = '/api/crypto'; // Proxy to backend endpoint

// DOM elements
const tokenList = document.getElementById('token-list');
const loaderTokens = document.getElementById('loader-tokens');
const livePriceHeader = document.getElementById('live-price-header');
const livePriceModal = document.getElementById('live-price-modal');
let selectedToken = null;

// Fetch crypto data from backend
async function fetchCryptoData() {
  try {
    loaderTokens.style.display = 'flex'; // Show loader
    tokenList.innerHTML = ''; // Clear token list

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    displayTokens(data.coins); // Use the coins array from the category data
    updateLivePrice(data.coins[0]); // Default to first token
  } catch (error) {
    console.error('Error fetching crypto data:', error.message);
    tokenList.innerHTML = '<li class="text-red-500">Failed to load tokens. Check console for details.</li>';
  } finally {
    loaderTokens.style.display = 'none'; // Hide loader
  }
}

// Display tokens in the list
function displayTokens(tokens) {
  // Sort by 24h volume (low to high for "low-volume" tokens)
  tokens.sort((a, b) => a.quote.USD.volume_24h - b.quote.USD.volume_24h);
  const topLowVolume = tokens.slice(0, 5); // Top 5 low-volume tokens

  topLowVolume.forEach(token => {
    const li = document.createElement('li');
    li.className = 'hover-glow gradient-bg p-2 rounded cursor-pointer';
    li.innerHTML = `
      <span class="glow-green">${token.name} (${token.symbol})</span>
      <span class="text-gray-500"> - $${token.quote.USD.price.toFixed(2)}</span>
      <span class="text-gray-500"> - Vol: $${token.quote.USD.volume_24h.toFixed(0)}</span>
    `;
    li.addEventListener('click', () => {
      selectedToken = token;
      updateLivePrice(token);
      updateChart(token.symbol); // Assuming updateChart is defined for TradingView
    });
    tokenList.appendChild(li);
  });
}

// Update live price display
function updateLivePrice(token) {
  if (token) {
    livePriceHeader.textContent = `> Live Price: $${token.quote.USD.price.toFixed(2)} (${token.symbol})`;
    livePriceModal.textContent = `> Live Price: $${token.quote.USD.price.toFixed(2)} (${token.symbol})`;
  }
}

// Initialize TradingView chart (placeholder - adjust based on your setup)
function updateChart(symbol) {
  if (window.tvWidget) {
    window.tvWidget.remove(); // Remove existing widget if present
  }
  const chartContainerHeader = document.getElementById('chart-container-header');
  const chartContainerModal = document.getElementById('chart-container-modal');
  const widget = new TradingView.widget({
    container_id: chartContainerHeader.id,
    width: chartContainerHeader.offsetWidth,
    height: chartContainerHeader.offsetHeight,
    symbol: `COINBASE:${symbol}USD`,
    interval: '1D',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    enable_publishing: false,
    allow_symbol_change: true,
    container_id: chartContainerModal.id, // Also update modal chart
  });
  window.tvWidget = widget;
}

// Event listeners for timeframe buttons (example - adjust as needed)
document.querySelectorAll('.timeframe-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const interval = btn.id.split('-')[1].toUpperCase();
    if (window.tvWidget) {
      window.tvWidget.chart().setResolution(interval);
    }
  });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  fetchCryptoData();
  // Additional initialization for TradingView or other features can go here
});
