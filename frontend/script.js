const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINGECKO_CHART_API = 'https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={days}';
const COINGECKO_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids={id}&vs_currencies=usd';
const COINGECKO_OHLC_API = 'https://api.coingecko.com/api/v3/coins/{id}/ohlc?vs_currency=usd&days={days}';
const COINMARKETCAP_API = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=100&convert=USD';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=100&tsym=USD';
const BETTERSTACK_API = 'https://telemetry.betterstack.com/api/v2/query/explore-logs';
const SOURCE_ID = '1303816';
const POLLING_INTERVAL = 15000;
const LIVE_DATA_INTERVAL = 10000; // Update live data every 10 seconds

// Mock token data for fallback, including ConstitutionDAO
const mockTokens = [
  { id: 'floki', name: 'FLOKI', symbol: 'FLOKI', total_volume: 4500000, current_price: 0.00015, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 10000000000000, source: 'Mock', score: 52.6 },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', total_volume: 3000000, current_price: 0.000013, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 589000000000000, source: 'Mock', score: 48.9 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', total_volume: 135674.745, current_price: 0.01962, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'CryptoCompare', score: 70.6 }
];

// Mock historical data for chart fallback
const mockChartData = {
  prices: Array.from({ length: 7 }, (_, i) => [
    Date.now() - (6 - i) * 24 * 60 * 60 * 1000,
    0.00015 + (Math.random() - 0.5) * 0.00002
  ])
};

// Ice King puns for marquee
const iceKingPuns = [
  "I’m chilling like the Ice King! ❄️👑",
  "Penguins are my royal guards! 🐧🧊",
  "Time to freeze the market! ❄️😂",
  "Ice to meet you, traders! 🧊🐧",
  "I’m the coolest king around! 👑❄️",
  "Penguin power activate! 🐧🧊😂"
];

// Global Chart.js instance and state
let priceChart = null;
let volumeChart = null;
let currentToken = null;
let compareToken = null;
let currentTimeframe = 1; // Default to 1 day
let allTokens = [];

// Retry fetch with delay
async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.text(); // Return text for JSONEachRow or JSON
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Retrying fetch (${i + 1}/${retries})...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Fetch live price for a token
async function fetchLivePrice(tokenId) {
  try {
    const url = COINGECKO_PRICE_API.replace('{id}', encodeURIComponent(tokenId));
    const data = await fetchWithRetry(url);
    return JSON.parse(data)[tokenId]?.usd || 'N/A';
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

// Fetch low-volume tokens, rank by performance, and update marquee with puns
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairs = document.getElementById('top-pairs');
  const marquee = document.getElementById('ticker-marquee');
  const compareDropdown = document.getElementById('compare-token');
  let tokens = [];
  let selectedTokenLi = null;

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
    if (!cmcResponse.ok) throw new Error(`CoinMarketCap HTTP ${cgResponse.status}`);
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

  // Store tokens globally for comparison dropdown
  allTokens = uniqueTokens;

  // Sort tokens by performance (price_change_percentage_24h)
  const sortedTokens = [...uniqueTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
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
      if (selectedTokenLi) {
        selectedTokenLi.classList.remove('selected-token');
      }
      li.classList.add('selected-token');
      selectedTokenLi = li;
      currentToken = token;
      showPriceChart(token, compareToken, currentTimeframe);
      updateLivePrice();
      updateLiveData();
    });
    tokenList.appendChild(li);
  });

  if (sortedTokens.length === 0) {
    tokenList.innerHTML = '<p class="text-gray-400 text-xs">No tokens under $5M volume.</p>';
  }

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
    // Double the content to eliminate blank space
    const doubledItems = [...marqueeItems, ...marqueeItems];
    marquee.innerHTML = doubledItems.join('');
    setTimeout(updateMarquee, 20000); // Match the CSS animation duration (20s)
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
    if (currentToken) {
      showPriceChart(currentToken, compareToken, currentTimeframe);
    }
  });

  if (sortedTokens.length > 0) {
    const firstTokenLi = tokenList.children[0];
    firstTokenLi.classList.add('selected-token');
    selectedTokenLi = firstTokenLi;
    currentToken = sortedTokens[0];
    showPriceChart(sortedTokens[0], null, currentTimeframe);
    updateLivePrice();
    setInterval(updateLivePrice, PRICE_UPDATE_INTERVAL);
    updateLiveData();
    setInterval(updateLiveData, LIVE_DATA_INTERVAL);
  }

  loader.style.display = 'none';
}

// Show Price Chart using Chart.js with candlestick and volume
async function showPriceChart(token, compareToken, days) {
  const chartContainer = document.getElementById('chart-container');
  const chartTitle = document.getElementById('chart-title');
  chartTitle.textContent = compareToken
    ? `${token.name} (${token.symbol}/USDT) vs ${compareToken.name} (${compareToken.symbol}/USDT)`
    : `${token.name} (${token.symbol}/USDT)`;

  // Update chart title hover effect based on performance
  chartTitle.onmouseover = () => {
    chartTitle.style.color = token.price_change_percentage_24h >= 0 ? 'rgba(74, 222, 128, 0.8)' : 'rgba(248, 113, 113, 0.8)';
    chartTitle.style.opacity = '0.75';
  };
  chartTitle.onmouseout = () => {
    chartTitle.style.color = '';
    chartTitle.style.opacity = '1';
  };

  // Clear and destroy existing charts if they exist
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }
  if (volumeChart) {
    volumeChart.destroy();
    volumeChart = null;
  }

  // Remove existing canvases and create new ones
  let chartCanvas = document.getElementById('chart-canvas');
  let volumeCanvas = document.getElementById('volume-canvas');
  if (chartCanvas) chartCanvas.remove();
  if (volumeCanvas) volumeCanvas.remove();
  chartCanvas = document.createElement('canvas');
  volumeCanvas = document.createElement('canvas');
  chartCanvas.id = 'chart-canvas';
  volumeCanvas.id = 'volume-canvas';
  chartCanvas.style.width = '100%';
  chartCanvas.style.height = '60%';
  volumeCanvas.style.width = '100%';
  volumeCanvas.style.height = '40%';
  chartContainer.appendChild(chartCanvas);
  chartContainer.appendChild(volumeCanvas);

  // Ensure canvases are in DOM before proceeding
  if (!chartCanvas.getContext || !volumeCanvas.getContext) {
    console.error('Canvas creation failed');
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Failed to create chart canvas.</div>';
    return;
  }

  try {
    // Fetch OHLC data for candlestick chart
    const ohlcUrl = COINGECKO_OHLC_API.replace('{id}', encodeURIComponent(token.id)).replace('{days}', days);
    let ohlcData;
    try {
      const text = await fetchWithRetry(ohlcUrl);
      ohlcData = JSON.parse(text);
      console.log(`OHLC data for ${token.id} (${days} days):`, ohlcData);
    } catch (error) {
      console.warn(`Failed to fetch OHLC data for ${token.id}. Using mock data.`, error);
      ohlcData = mockChartData.prices.map(([time, price]) => [time, price, price, price, price]); // Mock OHLC
    }

    const labels = ohlcData.map(item => new Date(item[0]).toLocaleString());
    const ohlc = ohlcData.map(item => ({
      x: item[0],
      o: item[1], // Open
      h: item[2], // High
      l: item[3], // Low
      c: item[4]  // Close
    }));

    // Fetch volume data
    let volumeData;
    try {
      const chartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(token.id)).replace('{days}', days);
      const text = await fetchWithRetry(chartUrl);
      const chartData = JSON.parse(text);
      volumeData = chartData.total_volumes || chartData.prices.map(() => [0, Math.random() * 1000000]); // Fallback to random volume
      console.log(`Volume data for ${token.id} (${days} days):`, volumeData);
    } catch (error) {
      console.warn(`Failed to fetch volume data for ${token.id}. Using mock data.`, error);
      volumeData = mockChartData.prices.map(() => [0, Math.random() * 1000000]);
    }

    const volumes = volumeData.map(item => ({
      x: item[0],
      y: item[1] || 0
    }));

    // Fetch data for comparison token if selected
    let compareOHLC = null;
    let compareVolume = null;
    if (compareToken) {
      const compareOHLCUrl = COINGECKO_OHLC_API.replace('{id}', encodeURIComponent(compareToken.id)).replace('{days}', days);
      const compareChartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(compareToken.id)).replace('{days}', days);
      try {
        const compareText = await fetchWithRetry(compareOHLCUrl);
        compareOHLC = JSON.parse(compareText);
        const compareChartText = await fetchWithRetry(compareChartUrl);
        const compareChartData = JSON.parse(compareChartText);
        compareVolume = compareChartData.total_volumes || compareChartData.prices.map(() => [0, Math.random() * 1000000]);
      } catch (error) {
        console.warn(`Failed to fetch data for ${compareToken.id}.`, error);
      }
    }

    // Create candlestick chart
    const ctx = chartCanvas.getContext('2d');
    priceChart = new Chart(ctx, {
      type: 'candlestick',
      data: {
        datasets: [{
          label: `${token.symbol}/USD Price`,
          data: ohlc,
          borderColor: (ctx) => (ctx.raw.c > ctx.raw.o ? '#34d399' : '#f87171'),
          backgroundColor: (ctx) => (ctx.raw.c > ctx.raw.o ? 'rgba(52, 211, 153, 0.5)' : 'rgba(248, 113, 113, 0.5)'),
          borderWidth: 1
        }].concat(compareOHLC ? [{
          label: `${compareToken.symbol}/USD Price`,
          data: compareOHLC.map(item => ({
            x: item[0],
            o: item[1],
            h: item[2],
            l: item[3],
            c: item[4]
          })),
          borderColor: (ctx) => (ctx.raw.c > ctx.raw.o ? '#9333ea' : '#a855f7'),
          backgroundColor: (ctx) => (ctx.raw.c > ctx.raw.o ? 'rgba(147, 51, 234, 0.5)' : 'rgba(168, 85, 247, 0.5)'),
          borderWidth: 1
        }] : [])
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
              text: 'Price (USD)',
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
        }
      }
    });

    // Create volume chart
    const volumeCtx = volumeCanvas.getContext('2d');
    volumeChart = new Chart(volumeCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `${token.symbol} Volume`,
          data: volumes.map(item => item.y),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }].concat(compareVolume ? [{
          label: `${compareToken.symbol} Volume`,
          data: compareVolume.map(item => item[1] || 0),
          backgroundColor: 'rgba(147, 51, 234, 0.7)',
          borderColor: 'rgba(147, 51, 234, 1)',
          borderWidth: 1
        }] : [])
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
              text: 'Volume',
              color: '#d1d4dc'
            },
            ticks: {
              color: '#d1d4dc',
              callback: function(value) {
                return value.toLocaleString();
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
        }
      }
    });

    console.log(`Chart rendered for ${token.id}${compareToken ? ` vs ${compareToken.id}` : ''} (${days} days)`);
  } catch (error) {
    console.error('Error rendering chart:', error);
    chartContainer.innerHTML = '<div class="text-gray-400 text-sm">Failed to load chart data. Try another token or check console.</div>';
  }
}

// Update chart with live data
async function updateLiveData() {
  if (!currentToken || !priceChart || !volumeChart) return;

  try {
    const ohlcUrl = COINGECKO_OHLC_API.replace('{id}', encodeURIComponent(currentToken.id)).replace('{days}', '0.01'); // Latest 14.4 minutes
    const text = await fetchWithRetry(ohlcUrl);
    const liveOHLC = JSON.parse(text);
    const latestOHLC = liveOHLC[liveOHLC.length - 1];
    priceChart.data.datasets[0].data.push({
      x: latestOHLC[0],
      o: latestOHLC[1],
      h: latestOHLC[2],
      l: latestOHLC[3],
      c: latestOHLC[4]
    });
    if (priceChart.data.datasets[0].data.length > 100) priceChart.data.datasets[0].data.shift(); // Limit to 100 data points

    const chartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(currentToken.id)).replace('{days}', '0.01');
    const chartText = await fetchWithRetry(chartUrl);
    const chartData = JSON.parse(chartText);
    const latestVolume = chartData.total_volumes ? chartData.total_volumes[chartData.total_volumes.length - 1][1] : Math.random() * 1000000;
    volumeChart.data.datasets[0].data.push(latestVolume);
    if (volumeChart.data.datasets[0].data.length > 100) volumeChart.data.datasets[0].data.shift();

    if (compareToken) {
      const compareOHLCUrl = COINGECKO_OHLC_API.replace('{id}', encodeURIComponent(compareToken.id)).replace('{days}', '0.01');
      const compareText = await fetchWithRetry(compareOHLCUrl);
      const compareLiveOHLC = JSON.parse(compareText);
      const latestCompareOHLC = compareLiveOHLC[compareLiveOHLC.length - 1];
      priceChart.data.datasets[1].data.push({
        x: latestCompareOHLC[0],
        o: latestCompareOHLC[1],
        h: latestCompareOHLC[2],
        l: latestCompareOHLC[3],
        c: latestCompareOHLC[4]
      });
      if (priceChart.data.datasets[1].data.length > 100) priceChart.data.datasets[1].data.shift();

      const compareChartUrl = COINGECKO_CHART_API.replace('{id}', encodeURIComponent(compareToken.id)).replace('{days}', '0.01');
      const compareChartText = await fetchWithRetry(compareChartUrl);
      const compareChartData = JSON.parse(compareChartText);
      const latestCompareVolume = compareChartData.total_volumes ? compareChartData.total_volumes[compareChartData.total_volumes.length - 1][1] : Math.random() * 1000000;
      volumeChart.data.datasets[1].data.push(latestCompareVolume);
      if (volumeChart.data.datasets[1].data.length > 100) volumeChart.data.datasets[1].data.shift();
    }

    priceChart.update();
    volumeChart.update();
  } catch (error) {
    console.error('Error updating live data:', error);
  }
}

// Process alert data for display
function processAlert(alert) {
  const li = document.createElement('li');
  li.className = 'bg-gray-700/40 p-2 rounded-md shadow hover-glow transition fade-in';
  const time = alert.time || new Date().toISOString();
  const level = alert.level || 'unknown';
  li.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-medium truncate text-gray-200">${level.toUpperCase()} Alert</span>
      <span class="text-xs text-gray-400">${new Date(time).toLocaleTimeString()}</span>
    </div>`;
  return li;
}

// Fetch logs from Better Stack API
async function initLogStream() {
  const alertList = document.getElementById('alert-list');
  const wsStatus = document.getElementById('ws-status');

  async function fetchLogs() {
    const now = new Date().toISOString();
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const url = `${BETTERSTACK_API}?source_ids=${SOURCE_ID}&query=SELECT%20time%2C%20JSONExtract(json%2C%20'level'%2C%20'Nullable(String)')%20AS%20level%20FROM%20source%20WHERE%20time%20BETWEEN%20'${thirtyMinutesAgo}'%20AND%20'${now}'`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer WGdCT5KhHtg4kiGWAbdXRaSL'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const text = await response.text();
      const logs = text.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      if (logs.length > 0) {
        alertList.innerHTML = ''; // Clear existing alerts
        logs.forEach(log => alertList.prepend(processAlert(log)));
        while (alertList.children.length > 20) {
          alertList.removeChild(alertList.lastChild);
        }
        wsStatus.innerHTML = '<span class="status-dot green"></span>Live logs active';
        wsStatus.className = 'mb-2 text-green-400 text-xs sm:text-sm';
      } else {
        wsStatus.innerHTML = '<span class="status-dot yellow"></span>No new logs...';
        wsStatus.className = 'mb-2 text-gray-400 text-xs sm:text-sm';
      }
    } catch (error) {
      console.error('Log fetch error:', error);
      wsStatus.innerHTML = '<span class="status-dot red"></span>Error: ' + error.message;
      wsStatus.className = 'mb-2 text-red-400 text-xs sm:text-sm';
      const mockAlerts = generateMockAlerts();
      alertList.innerHTML = ''; // Clear existing alerts
      mockAlerts.forEach(alert => alertList.prepend(processAlert(alert)));
    }
  }

  wsStatus.innerHTML = '<span class="status-dot yellow"></span>Starting with mock data...';
  wsStatus.className = 'mb-2 text-yellow-400 text-xs sm:text-sm';
  fetchLogs();
  setInterval(fetchLogs, POLLING_INTERVAL);
}

// Mock alert generator (fallback)
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
  return alerts.map(alert => ({ time: alert.timestamp, level: alert.event }));
}

// Setup chart timeframe and sticky toggle
function setupChartControls() {
  const timeframes = {
    'timeframe-1min': 1 / 1440,   // 1 minute in days
    'timeframe-5min': 5 / 1440,   // 5 minutes in days
    'timeframe-15min': 15 / 1440, // 15 minutes in days
    'timeframe-1hr': 1 / 24,      // 1 hour in days
    'timeframe-4hr': 4 / 24,      // 4 hours in days
    'timeframe-1d': 1             // 1 day
  };

  // Timeframe buttons
  Object.keys(timeframes).forEach(id => {
    const btn = document.getElementById(id);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTimeframe = timeframes[id];
      if (currentToken) {
        showPriceChart(currentToken, compareToken, currentTimeframe);
      }
    });
  });

  // Sticky toggle
  const toggleStickyBtn = document.getElementById('toggle-sticky');
  const chartWrapper = document.querySelector('.chart-wrapper');
  let isSticky = true; // Default to sticky
  toggleStickyBtn.addEventListener('click', () => {
    isSticky = !isSticky;
    chartWrapper.classList.toggle('unlocked', !isSticky);
    toggleStickyBtn.textContent = isSticky ? 'Lock Chart' : 'Unlock Chart';
    toggleStickyBtn.classList.toggle('bg-blue-500', isSticky);
    toggleStickyBtn.classList.toggle('bg-blue-600', !isSticky);
  });
}

fetchLowVolumeTokens();
initLogStream();
setupChartControls();
