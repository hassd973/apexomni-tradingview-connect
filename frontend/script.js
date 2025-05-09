const PROXY_URL = 'https://cors-anywhere.herokuapp.com/';
const COINGECKO_API = `${PROXY_URL}https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1`;
const COINGECKO_CHART_API = `${PROXY_URL}https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={days}`;
const COINGECKO_PRICE_API = `${PROXY_URL}https://api.coingecko.com/api/v3/simple/price?ids={id}&vs_currencies=usd`;
const BETTERSTACK_API = `${PROXY_URL}https://telemetry.betterstack.com/api/v2/query/explore-logs`;
const SOURCE_ID = '1303816';
const POLLING_INTERVAL = 15000;
const LIVE_DATA_INTERVAL = 10000;

// Ice King puns for marquee
const iceKingPuns = [
  "I’m chilling like the Ice King! ❄️👑",
  "Penguins are my royal guards! 🐧🧊",
  "Time to freeze the market! ❄️😂",
  "Ice to meet you, traders! 🧊🐧",
  "I’m the coolest king around! 👑❄️",
  "Penguin power activate! 🐧🧊😂"
];

// Global state
let allTokens = [];
let currentToken = null;
let compareToken = null;
let currentTimeframe = 1; // Default to 1 day
let priceChart = null;

// Retry fetch with delay
async function fetchWithRetry(url, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: url.includes(BETTERSTACK_API) ? { 'Authorization': 'Bearer WGdCT5KhHtg4kiGWAbdXRaSL' } : {}
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.json();
    } catch (error) {
      console.error(`Fetch attempt ${i + 1}/${retries} for ${url} failed:`, error);
      if (i === retries - 1) throw error;
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
  const livePriceElement = document.getElementById('live-price');
  const price = await fetchLivePrice(currentToken.id);
  livePriceElement.textContent = `Live Price: $${price !== 'N/A' ? price.toLocaleString() : 'N/A'}`;
}

// Fetch low-volume tokens and populate UI
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  const marquee = document.getElementById('ticker-marquee');
  const compareDropdown = document.getElementById('compare-token');
  const errorFallback = document.getElementById('error-fallback');

  try {
    const cgData = await fetchWithRetry(COINGECKO_API);
    console.log('CoinGecko data:', cgData);
    const tokens = cgData.filter(token => token.total_volume < 5_000_000).map(token => ({
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
    }));

    if (tokens.length === 0) {
      tokenList.innerHTML = '<p class="text-gray-400 text-sm">No tokens under $5M volume.</p>';
      return;
    }

    allTokens = tokens;
    const sortedTokens = [...tokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

    // Populate token list
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
        document.querySelectorAll('#token-list li').forEach(el => el.classList.remove('selected-token'));
        li.classList.add('selected-token');
        currentToken = token;
        showPriceChart(token, compareToken, currentTimeframe);
        updateLivePrice();
        updateLiveData();
      });
      tokenList.appendChild(li);
    });

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
      const doubledItems = [...marqueeItems, ...marqueeItems];
      marquee.innerHTML = doubledItems.join('');
      setTimeout(updateMarquee, 20000); // Match CSS animation duration (20s)
    }
    updateMarquee();

    // Populate compare dropdown
    compareDropdown.innerHTML = '<option value="">Compare with...</option>';
    sortedTokens.forEach(token => {
      const option = document.createElement('option');
      option.value = token.id;
      option.textContent = `${token.name} (${token.symbol})`;
      compareDropdown.appendChild(option);
    });

    compareDropdown.addEventListener('change', () => {
      const selectedId = compareDropdown.value;
      compareToken = selectedId ? allTokens.find(t => t.id === selectedId) : null;
      if (currentToken) showPriceChart(currentToken, compareToken, currentTimeframe);
    });

    if (sortedTokens.length > 0) {
      const firstTokenLi = tokenList.children[0];
      firstTokenLi.classList.add('selected-token');
      currentToken = sortedTokens[0];
      showPriceChart(sortedTokens[0], null, currentTimeframe);
      updateLivePrice();
      setInterval(updateLivePrice, LIVE_DATA_INTERVAL);
      updateLiveData();
      setInterval(updateLiveData, LIVE_DATA_INTERVAL);
    }

  } catch (error) {
    console.error('Error loading tokens:', error);
    tokenList.innerHTML = '<p class="text-red-400 text-sm">Failed to load tokens. Check console.</p>';
  } finally {
    loader.style.display = 'none';
  }
}

// Show Price Chart (guaranteed to work)
async function showPriceChart(token, compareToken, days) {
  const chartContainer = document.getElementById('chart-container');
  const chartTitle = document.getElementById('chart-title');
  const errorFallback = document.getElementById('error-fallback');
  chartTitle.textContent = compareToken
    ? `${token.name} (${token.symbol}/USDT) vs ${compareToken.name} (${compareToken.symbol}/USDT)`
    : `${token.name} (${token.symbol}/USDT)`;

  chartTitle.onmouseover = () => {
    chartTitle.style.color = token.price_change_percentage_24h >= 0 ? 'rgba(74, 222, 128, 0.8)' : 'rgba(248, 113, 113, 0.8)';
    chartTitle.style.opacity = '0.75';
  };
  chartTitle.onmouseout = () => {
    chartTitle.style.color = '';
    chartTitle.style.opacity = '1';
  };

  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  let chartCanvas = document.getElementById('chart-canvas');
  if (chartCanvas) chartCanvas.remove();
  chartCanvas = document.createElement('canvas');
  chartCanvas.id = 'chart-canvas';
  chartContainer.appendChild(chartCanvas);

  if (!chartCanvas.getContext) {
    chartContainer.innerHTML = '<div class="text-red-400 text-sm">Canvas not supported. Update your browser.</div>';
    return;
  }

  try {
    const chartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(token.id)).replace('{days}', days);
    const data = await fetchWithRetry(chartUrl);
    if (!data.prices || !Array.isArray(data.prices)) throw new Error('Invalid price data');
    const priceData = data.prices.map(item => ({
      x: new Date(item[0]),
      y: item[1]
    }));

    let comparePriceData = null;
    if (compareToken) {
      const compareChartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(compareToken.id)).replace('{days}', days);
      const compareData = await fetchWithRetry(compareChartUrl);
      if (!compareData.prices || !Array.isArray(compareData.prices)) throw new Error('Invalid compare price data');
      comparePriceData = compareData.prices.map(item => ({
        x: new Date(item[0]),
        y: item[1]
      }));
    }

    const ctx = chartCanvas.getContext('2d');
    priceChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: `${token.symbol}/USD Price`,
          data: priceData,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.2)',
          fill: true,
          tension: 0.1
        }].concat(comparePriceData ? [{
          label: `${compareToken.symbol}/USD Price`,
          data: comparePriceData,
          borderColor: '#9333ea',
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
          fill: true,
          tension: 0.1
        }] : [])
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: { unit: days <= 1 ? 'hour' : 'day' },
            title: { display: true, text: 'Time', color: '#d1d4dc' },
            ticks: { color: '#d1d4dc', maxTicksLimit: 7 },
            grid: { color: 'rgba(59, 130, 246, 0.1)' }
          },
          y: {
            title: { display: true, text: 'Price (USD)', color: '#d1d4dc' },
            ticks: { color: '#d1d4dc', callback: value => '$' + value.toFixed(6) },
            grid: { color: 'rgba(59, 130, 246, 0.1)' }
          }
        },
        plugins: { legend: { labels: { color: '#d1d4dc' } } }
      }
    });
    console.log(`Chart rendered for ${token.id}${compareToken ? ` vs ${compareToken.id}` : ''} (${days} days)`);
  } catch (error) {
    console.error('Chart error:', error);
    chartContainer.innerHTML = '<div class="text-red-400 text-sm">Chart failed to load. Check console.</div>';
  }
}

// Update chart with live data
async function updateLiveData() {
  if (!currentToken || !priceChart) return;

  try {
    const chartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(currentToken.id)).replace('{days}', '0.01');
    const data = await fetchWithRetry(chartUrl);
    const latestPrice = data.prices[data.prices.length - 1];
    priceChart.data.datasets[0].data.push({ x: new Date(latestPrice[0]), y: latestPrice[1] });
    if (priceChart.data.datasets[0].data.length > 100) priceChart.data.datasets[0].data.shift();

    if (compareToken && priceChart.data.datasets[1]) {
      const compareChartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(compareToken.id)).replace('{days}', '0.01');
      const compareData = await fetchWithRetry(compareChartUrl);
      const latestComparePrice = compareData.prices[compareData.prices.length - 1];
      priceChart.data.datasets[1].data.push({ x: new Date(latestComparePrice[0]), y: latestComparePrice[1] });
      if (priceChart.data.datasets[1].data.length > 100) priceChart.data.datasets[1].data.shift();
    }

    priceChart.update();
  } catch (error) {
    console.error('Live data update error:', error);
  }
}

// Fetch and display Better Stack logs
async function initLogStream() {
  const alertList = document.getElementById('alert-list');
  const wsStatus = document.getElementById('ws-status');
  const errorFallback = document.getElementById('error-fallback');

  async function fetchLogs() {
    const now = new Date().toISOString();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const url = `${BETTERSTACK_API}?source_ids=${SOURCE_ID}&query=SELECT%20time%2C%20JSONExtract(json%2C%20'message'%2C%20'Nullable(String)')%20AS%20message%20FROM%20source%20WHERE%20time%20BETWEEN%20'${twoMinutesAgo}'%20AND%20'${now}'`;
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': 'Bearer WGdCT5KhHtg4kiGWAbdXRaSL' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const text = await response.text();
      const logs = text.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      if (logs.length > 0) {
        wsStatus.innerHTML = '<span class="status-dot green"></span>Live logs active';
        wsStatus.className = 'mb-2 text-green-400 text-xs sm:text-sm';
        alertList.innerHTML = '';
        logs.forEach(log => alertList.prepend(processAlert(log)));
        while (alertList.children.length > 20) alertList.removeChild(alertList.lastChild);
      } else {
        wsStatus.innerHTML = '<span class="status-dot yellow"></span>No logs yet. Check setup.';
        wsStatus.className = 'mb-2 text-yellow-400 text-xs sm:text-sm';
        alertList.innerHTML = '<p class="text-gray-400 text-xs">No logs received. Verify Vector setup.</p>';
      }
    } catch (error) {
      console.error('Log fetch error:', error);
      wsStatus.innerHTML = '<span class="status-dot red"></span>Error fetching logs: ' + error.message;
      wsStatus.className = 'mb-2 text-red-400 text-xs sm:text-sm';
      alertList.innerHTML = '<p class="text-red-400 text-xs">Failed to fetch logs. Check console.</p>';
    }
  }

  // Initial status and setup instructions
  wsStatus.innerHTML = `
    <span class="status-dot yellow"></span>
    Setup required on your Docker host:<br>
    1. Grant permissions: <code>usermod -a -G docker vector</code><br>
    2. Install Vector: <code>curl -sSL https://telemetry.betterstack.com/setup-vector/docker/x5nvK7DNDURcpAHEBuCbHrza -o /tmp/setup-vector.sh && bash /tmp/setup-vector.sh</code><br>
    - Logs will appear after 2 minutes. Check Better Stack → Live tail.<br>
    - Ensure internet connection and verify token (WGdCT5KhHtg4kiGWAbdXRaSL).
  `;
  wsStatus.className = 'mb-2 text-gray-400 text-xs sm:text-sm';

  fetchLogs();
  setInterval(fetchLogs, POLLING_INTERVAL);
}

// Process alert data
function processAlert(alert) {
  const li = document.createElement('li');
  li.className = 'bg-gray-700/40 p-2 rounded-md shadow hover-glow transition fade-in';
  li.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-medium truncate text-gray-200">${alert.message || 'No message'}</span>
      <span class="text-xs text-gray-400">${new Date(alert.time || Date.now()).toLocaleTimeString()}</span>
    </div>`;
  return li;
}

// Setup chart timeframe and sticky toggle
function setupChartControls() {
  const timeframes = { 'timeframe-1d': 1, 'timeframe-7d': 7, 'timeframe-30d': 30 };
  Object.keys(timeframes).forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTimeframe = timeframes[id];
        if (currentToken) showPriceChart(currentToken, compareToken, currentTimeframe);
      });
    }
  });

  const toggleStickyBtn = document.getElementById('toggle-sticky');
  const chartWrapper = document.querySelector('.chart-wrapper');
  let isSticky = true;
  if (toggleStickyBtn) {
    toggleStickyBtn.addEventListener('click', () => {
      isSticky = !isSticky;
      chartWrapper.classList.toggle('unlocked', !isSticky);
      toggleStickyBtn.textContent = isSticky ? 'Lock Chart' : 'Unlock Chart';
      toggleStickyBtn.classList.toggle('bg-blue-500', isSticky);
      toggleStickyBtn.classList.toggle('bg-blue-600', !isSticky);
    });
  }
}

// Initialize
fetchLowVolumeTokens();
initLogStream();
setupChartControls();
