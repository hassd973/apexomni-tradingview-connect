const BINANCE_API_TICKER = 'https://api.binance.com/api/v3/ticker/24hr';
const BINANCE_API_KLINES = 'https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1d&limit=30'; // Daily candles, last 30 days
const BINANCE_API_PRICE = 'https://api.binance.com/api/v3/ticker/price?symbol={symbol}';
const BETTERSTACK_API = 'https://telemetry.betterstack.com/api/v2/query/live-tail';
const POLLING_INTERVAL = 15000;
const PRICE_UPDATE_INTERVAL = 10000;
const TOKEN_REFRESH_INTERVAL = 30000;
const MARQUEE_UPDATE_INTERVAL = 30000;

const iceKingPuns = [
  "I’m chilling like the Ice King! ❄️👑",
  "Penguins are my royal guards! 🐧🧊",
  "Time to freeze the market! ❄️😂",
  "Ice to meet you, traders! 🧊🐧",
  "I’m the coolest king around! 👑❄️",
  "Penguin power activate! 🐧🧊😂",
  "Snow way I’m missing this trade! ❄️📈",
  "Freeze your doubts, let’s trade! 🧊💸",
  "I’m skating through the market! ⛸️❄️",
  "Cold cash, hot trades! 🥶💰",
  "My portfolio’s cooler than ice! ❄️📊",
  "Chill out, I’ve got this! 🧊😎",
  "Ice King’s here to rule the charts! 👑📉",
  "Let’s make it snow profits! ❄️💵",
  "I’m frosting the competition! 🧊🏆",
  "Cool trades, warm wins! ❄️🔥"
];

let usedPuns = [];
let priceChart = null;
let currentToken = null;
let compareToken = null;
let currentTimeframe = 1;
let allTokens = [];
let sortedTokens = [];

async function fetchWithRetry(url, retries = 3, delay = 1000, options = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Retrying fetch (${i + 1}/${retries}) for ${url}:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function fetchLivePrice(symbol) {
  try {
    if (!symbol) throw new Error('Symbol is undefined');
    const url = BINANCE_API_PRICE.replace('{symbol}', symbol);
    const data = await fetchWithRetry(url);
    return parseFloat(data.price) || 'N/A';
  } catch (error) {
    console.error(`Error fetching live price for ${symbol}:`, error);
    return 'N/A';
  }
}

async function updateLivePrice() {
  if (!currentToken || !priceChart) return;

  const livePriceElements = [
    document.getElementById('live-price-header'),
    document.getElementById('live-price-modal')
  ];
  const tickerMarquees = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];

  const price = await fetchLivePrice(currentToken.symbol + 'USDT');
  livePriceElements.forEach(element => {
    if (element) element.textContent = `Live Price: $${price !== 'N/A' ? price.toLocaleString() : 'N/A'}`;
  });

  if (price !== 'N/A' && priceChart) {
    const now = new Date();
    priceChart.data.labels.push(now.toLocaleDateString());
    priceChart.data.datasets[0].data.push(price);

    if (priceChart.data.labels.length > 50) {
      priceChart.data.labels.shift();
      priceChart.data.datasets[0].data.shift();
    }

    priceChart.update('none');

    tickerMarquees.forEach(marquee => {
      if (marquee) marquee.innerHTML = `<span class="glow-green">${currentToken.symbol}: $${price.toLocaleString()}</span>`;
    });
  }

  if (compareToken && priceChart && priceChart.data.datasets[1]) {
    const comparePrice = await fetchLivePrice(compareToken.symbol + 'USDT');
    if (comparePrice !== 'N/A') {
      priceChart.data.datasets[1].data.push(comparePrice);
      if (priceChart.data.datasets[1].data.length > 50) {
        priceChart.data.datasets[1].data.shift();
      }
      priceChart.update('none');
    }
  }
}

async function fetchLogs(sourceId) {
  const url = BETTERSTACK_API;
  const options = {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer WGdCT5KhHtg4kiGWAbdXRaSL'
    },
    body: new URLSearchParams({
      source_ids: sourceId,
      query: 'level=info'
    })
  };
  try {
    const data = await fetchWithRetry(url, 3, 1000, options);
    return data;
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}

function updateAlertsWithLogs(sourceId) {
  const alertList = document.getElementById('alert-list');
  fetchLogs(sourceId).then(logs => {
    alertList.innerHTML = '';
    logs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'bg-gray-700/40 p-2 rounded-md shadow hover-glow transition fade-in';
      const timestamp = log.timestamp || new Date().toISOString();
      li.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-medium truncate text-gray-200">📜 ${log.message || 'No message'}</span>
          <span class="text-xs text-gray-400">${new Date(timestamp).toLocaleTimeString()}</span>
        </div>`;
      alertList.prepend(li);
    });
    while (alertList.children.length > 20) {
      alertList.removeChild(alertList.lastChild);
    }
  });
}

async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  const marqueeElements = [
    document.getElementById('ticker-marquee-header'),
    document.getElementById('ticker-marquee-modal')
  ];
  const compareDropdowns = [
    document.getElementById('compare-token-header'),
    document.getElementById('compare-token-modal')
  ];
  let tokens = [];
  let selectedTokenLi = null;

  try {
    const binanceResponse = await fetchWithRetry(BINANCE_API_TICKER);
    console.log('Binance ticker response:', binanceResponse.slice(0, 5)); // Log first 5 for brevity
    tokens = binanceResponse
      .filter(token => token.symbol.endsWith('USDT')) // Only USDT pairs
      .filter(token => parseFloat(token.quoteVolume) < 5_000_000) // Low volume < $5M
      .map(token => {
        const symbol = token.symbol.replace('USDT', '');
        return {
          id: symbol.toLowerCase(),
          name: symbol,
          symbol: symbol,
          total_volume: parseFloat(token.quoteVolume),
          current_price: parseFloat(token.lastPrice),
          price_change_percentage_24h: parseFloat(token.priceChangePercent),
          market_cap: 0, // Binance doesn't provide market cap directly; set to 0
          circulating_supply: 0, // Not available via this endpoint
          source: 'Binance',
          score: Math.min(100, Math.max(0, (parseFloat(token.priceChangePercent) + 100) / 2))
        };
      });
  } catch (error) {
    console.error('Binance ticker error:', error);
  }

  if (tokens.length === 0) {
    tokenList.innerHTML = '<p class="text-gray-400 text-xs">Failed to fetch token data from Binance. Please try again later.</p>';
    loader.style.display = 'none';
    return;
  }

  const uniqueTokens = [];
  const seenSymbols = new Set();
  for (const token of tokens) {
    if (!seenSymbols.has(token.symbol)) {
      seenSymbols.add(token.symbol);
      uniqueTokens.push(token);
    }
  }

  allTokens = uniqueTokens;
  sortedTokens = [...uniqueTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

  tokenList.innerHTML = '';
  sortedTokens.forEach((token, index) => {
    const li = document.createElement('li');
    const opacity = 30 + (index / sortedTokens.length) * 40;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    li.className = `p-2 rounded-md shadow hover-glow transition cursor-pointer ${bgColor} fade-in ${glowClass} ${hoverClass} z-20`;
    li.setAttribute('data-tooltip', 'Click to toggle chart');
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
          <p>Market Cap: Not Available</p>
          <p>Circulating Supply: Not Available</p>
          <p>Source: ${token.source}</p>
        </div>
      </div>`;
    li.addEventListener('click', () => {
      if (selectedTokenLi) {
        selectedTokenLi.classList.remove('selected-token');
      }
      li.classList.add('selected-token');
      selectedTokenLi = li;
      currentToken = token;
      showPriceChart(token, compareToken, currentTimeframe, document.getElementById('chart-modal').classList.contains('active') ? 'modal' : 'header');
      updateLivePrice();
    });
    tokenList.appendChild(li);
  });

  const topTokens = sortedTokens.slice(0, 5).map(token => token.symbol);
  topPairs.innerHTML = topTokens.map((pair, index) => {
    const token = sortedTokens[index];
    const opacity = 20 + (index / 4) * 30;
    const bgColor = token.price_change_percentage_24h >= 0 ? `bg-green-500/${opacity}` : `bg-red-500/${opacity}`;
    const glowClass = token.price_change_percentage_24h >= 0 ? 'glow-green' : 'glow-red';
    const hoverClass = token.price_change_percentage_24h >= 0 ? 'hover-performance-green' : 'hover-performance-red';
    return `<li class="px-2 py-1 rounded ${bgColor} hover-glow transition ${glowClass} ${hoverClass}">${pair}/USDT</li>`;
  }).join('');

  function getUniquePun() {
    if (usedPuns.length === iceKingPuns.length) {
      usedPuns = [];
    }
    const availablePuns = iceKingPuns.filter(pun => !usedPuns.includes(pun));
    const selectedPun = availablePuns[Math.floor(Math.random() * availablePuns.length)];
    usedPuns.push(selectedPun);
    return selectedPun;
  }

  function updateMarquee() {
    const winners = sortedTokens.filter(t => t.price_change_percentage_24h > 0).slice(0, 3);
    const losers = sortedTokens.filter(t => t.price_change_percentage_24h < 0).slice(-3);
    const currentPun = getUniquePun();
    const marqueeItems = [
      ...winners.map(t => `<span class="glow-green text-green-400">🏆 ${t.symbol}: +${t.price_change_percentage_24h.toFixed(2)}%</span>`),
      `<span class="glow-purple text-purple-400">${currentPun}</span>`,
      ...losers.map(t => `<span class="glow-red text-red-400">📉 ${t.symbol}: ${t.price_change_percentage_24h.toFixed(2)}%</span>`)
    ];
    const doubledItems = [...marqueeItems, ...marqueeItems];
    marqueeElements.forEach(element => {
      if (element) element.innerHTML = doubledItems.join('');
    });
    setTimeout(updateMarquee, MARQUEE_UPDATE_INTERVAL);
  }
  updateMarquee();

  compareDropdowns.forEach(dropdown => {
    if (dropdown) {
      dropdown.innerHTML = '<option value="">Compare with...</option>' + allTokens.map(t => `<option value="${t.id}">${t.name} (${t.symbol})</option>`).join('');
      dropdown.addEventListener('change', (e) => {
        compareToken = allTokens.find(t => t.id === e.target.value) || null;
        showPriceChart(currentToken, compareToken, currentTimeframe, document.getElementById('chart-modal').classList.contains('active') ? 'modal' : 'header');
      });
    }
  });

  if (sortedTokens.length > 0) {
    const firstTokenLi = tokenList.children[0];
    firstTokenLi.classList.add('selected-token');
    selectedTokenLi = firstTokenLi;
    currentToken = sortedTokens[0];
    showPriceChart(sortedTokens[0], null, currentTimeframe, 'header');
    updateLivePrice();
    setInterval(updateLivePrice, PRICE_UPDATE_INTERVAL);
  }

  loader.style.display = 'none';
}

async function fetchChartData(symbol, days) {
  try {
    if (!symbol) throw new Error('Symbol is undefined or invalid');
    const url = BINANCE_API_KLINES.replace('{symbol}', symbol + 'USDT');
    console.log(`Fetching chart data for ${symbol} (${days} days) from ${url}`);
    const data = await fetchWithRetry(url, 3, 2000);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid chart data: data array is missing or empty');
    }
    // Map candlestick data: [timestamp, open, high, low, close, volume, ...]
    const prices = data.map(candle => [
      parseInt(candle[0]), // Timestamp
      parseFloat(candle[4]) // Close price
    ]);
    console.log(`Chart data for ${symbol}:`, prices.slice(0, 5));
    return prices;
  } catch (error) {
    console.error(`Failed to fetch chart data for ${symbol}:`, error);
    throw error;
  }
}

async function showPriceChart(token, compareToken, days, containerType) {
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  const chartContainer = containerType === 'modal' ? document.getElementById('chart-container-modal') : document.getElementById('chart-container-header');
  const chartCanvasId = containerType === 'modal' ? 'chart-canvas-modal' : 'chart-canvas-header';
  const chartTitle = containerType === 'modal' ? document.getElementById('chart-title-modal') : document.getElementById('chart-title-header');
  const tickerMarquee = containerType === 'modal' ? document.getElementById('ticker-marquee-modal') : document.getElementById('ticker-marquee-header');

  if (!chartContainer || !chartTitle || !tickerMarquee || !token) {
    console.error('Missing required elements for chart rendering');
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Chart rendering failed: missing elements.</div>';
    return;
  }

  let chartCanvas = document.getElementById(chartCanvasId);
  if (chartCanvas) {
    chartCanvas.remove();
  }
  chartCanvas = document.createElement('canvas');
  chartCanvas.id = chartCanvasId;
  chartCanvas.style.width = '100%';
  chartCanvas.style.height = '100%';
  chartContainer.appendChild(chartCanvas);

  if (!chartCanvas || !chartCanvas.getContext) {
    console.error('Canvas creation failed');
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Failed to create chart canvas.</div>';
    return;
  }

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

  try {
    const data = await fetchChartData(token.symbol, days);
    const labels = data.map(d => new Date(d[0]).toLocaleDateString());
    const prices = data.map(d => d[1]);

    let compareData = [];
    if (compareToken) {
      const compareChartData = await fetchChartData(compareToken.symbol, days);
      compareData = compareChartData.map(d => d[1]);
    }

    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    priceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `${token.symbol}/USDT Price`,
            data: prices,
            borderColor: '#9333ea',
            backgroundColor: 'rgba(147, 51, 234, 0.2)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          ...(compareToken ? [{
            label: `${compareToken.symbol}/USDT Price`,
            data: compareData,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.2)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          }] : [])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time',
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
              text: 'Price (USDT)',
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

    tickerMarquee.innerHTML = `<span class="glow-green">${token.symbol}: $${prices[prices.length - 1].toLocaleString()}</span>`;
  } catch (error) {
    console.error('Error rendering chart:', error);
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Failed to load chart data. Please try another token or check API status.</div>';
  }
}

window.reinitializeChart = function(containerType) {
  if (currentToken) {
    showPriceChart(currentToken, compareToken, currentTimeframe, containerType);
  }
};

function setupChartControls() {
  const timeframes = {
    '1min': 1 / 1440,
    '5min': 5 / 1440,
    '15min': 15 / 1440,
    '1hr': 1 / 24,
    '4hr': 4 / 24,
    '1d': 1
  };

  ['header', 'modal'].forEach(containerType => {
    const prefix = containerType === 'modal' ? 'modal-' : 'header-';
    Object.entries(timeframes).forEach(([id, days]) => {
      const btn = document.getElementById(`${prefix}timeframe-${id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          currentTimeframe = days;
          document.querySelectorAll(`[id^="${prefix}timeframe-"]`).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (currentToken) {
            showPriceChart(currentToken, compareToken, currentTimeframe, containerType);
          }
        });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const SOURCE_ID = 'source_123';
  await fetchLowVolumeTokens();
  setInterval(fetchLowVolumeTokens, TOKEN_REFRESH_INTERVAL);
  updateAlertsWithLogs(SOURCE_ID);
  setInterval(() => updateAlertsWithLogs(SOURCE_ID), POLLING_INTERVAL);
  setupChartControls();
});
