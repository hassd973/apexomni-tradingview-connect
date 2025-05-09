const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1';
const COINGECKO_CHART_API = 'https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={days}';
const COINGECKO_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids={id}&vs_currencies=usd';
const POLLING_INTERVAL = 15000;
const PRICE_UPDATE_INTERVAL = 10000;

// Mock token data for fallback (expanded to 10 tokens)
const mockTokens = [
  { id: 'floki', name: 'FLOKI', symbol: 'FLOKI', total_volume: 4500000, current_price: 0.00015, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 10000000000000, source: 'Mock', score: 52.6 },
  { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', total_volume: 3000000, current_price: 0.000013, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 589000000000000, source: 'Mock', score: 48.9 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', total_volume: 135674.745, current_price: 0.01962, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', score: 70.6 },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', total_volume: 2000000, current_price: 0.12, price_change_percentage_24h: 3.5, market_cap: 17000000000, circulating_supply: 140000000000, source: 'Mock', score: 51.8 },
  { id: 'safemoon', name: 'SafeMoon', symbol: 'SAFEMOON', total_volume: 1500000, current_price: 0.0000000012, price_change_percentage_24h: -4.8, market_cap: 600000000, circulating_supply: 500000000000000, source: 'Mock', score: 47.6 },
  { id: 'binancecoin', name: 'Binance Coin', symbol: 'BNB', total_volume: 4800000, current_price: 590.45, price_change_percentage_24h: 1.8, market_cap: 90000000000, circulating_supply: 153000000, source: 'Mock', score: 50.9 },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', total_volume: 2500000, current_price: 0.45, price_change_percentage_24h: -1.2, market_cap: 16000000000, circulating_supply: 36000000000, source: 'Mock', score: 49.4 },
  { id: 'solana', name: 'Solana', symbol: 'SOL', total_volume: 3500000, current_price: 145.67, price_change_percentage_24h: 6.9, market_cap: 65000000000, circulating_supply: 450000000, source: 'Mock', score: 53.5 },
  { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX', total_volume: 1800000, current_price: 30.12, price_change_percentage_24h: -3.4, market_cap: 12000000000, circulating_supply: 400000000, source: 'Mock', score: 48.3 },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', total_volume: 2200000, current_price: 8.95, price_change_percentage_24h: 2.3, market_cap: 11000000000, circulating_supply: 1200000000, source: 'Mock', score: 51.2 }
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

// Top USDT pairs (limited to three)
const topPairs = ['BTC-USDT', 'ETH-USDT', 'FLOKI-USDT'];

// Global Chart.js instance and state
let priceChart = null;
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
      return await response.json();
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Fetch failed after ${retries} retries:`, error);
        throw error;
      }
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

// Fetch low-volume tokens, rank by performance, and update marquee with puns
async function fetchLowVolumeTokens() {
  const tokenList = document.getElementById('token-list');
  const loader = document.getElementById('loader-tokens');
  const topPairsElement = document.getElementById('top-pairs');
  const marquee = document.getElementById('ticker-marquee');
  const compareDropdown = document.getElementById('compare-token');
  let tokens = [];
  let selectedTokenLi = null;

  try {
    const cgData = await fetchWithRetry(COINGECKO_API);
    console.log('CoinGecko data:', cgData);
    tokens = cgData.filter(token => token.total_volume < 5_000_000).map(token => ({
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
  } catch (error) {
    console.error('CoinGecko error:', error);
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

  allTokens = uniqueTokens.length > 0 ? uniqueTokens : mockTokens;

  // Sort tokens by performance (price_change_percentage_24h)
  const sortedTokens = [...allTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
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
          <span class="text-xs">Vol: $${token.total_volume
