// Configuration for local testing
const CONFIG = {
  BACKEND_URL: 'http://localhost:3000',
  COINGECKO_URL: 'https://api.coingecko.com/api/v3/coins/markets',
  TOKEN_REFRESH_INTERVAL: 60000,
  LOG_REFRESH_INTERVAL: 30000,
  MAX_RETRIES: 5,
  RETRY_DELAY: 2000
};

// Global State
let currentToken = null;
let currentTimeframe = '1d';
let allTokens = [];
let sortedTokens = [];

// Utility Functions
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        mode: 'cors',
        headers: { 'Accept': 'application/json', ...(options.headers || {}) }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function fetchTokenData() {
  const url = `${CONFIG.COINGECKO_URL}?vs_currency=usd&ids=bitcoin,ethereum,binancecoin&order=market_cap_desc`;
  return fetchWithRetry(url);
}

async function fetchLogs() {
  return fetchWithRetry(`${CONFIG.BACKEND_URL}/logs`);
}

async function updateTokens() {
  try {
    const data = await fetchTokenData();
    allTokens = data.map(token => ({
      id: token.id,
      name: token.name,
      symbol: token.symbol.toUpperCase(),
      current_price: token.current_price,
      price_change_percentage_24h: token.price_change_percentage_24h
    }));
    sortedTokens = [...allTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    renderTokens();
  } catch (error) {
    console.error('Failed to update tokens:', error);
  }
}

async function updateLogs() {
  try {
    const logs = await fetchLogs();
    renderLogs(logs);
  } catch (error) {
    console.error('Failed to update logs:', error);
  }
}

// Render Functions
function renderTokens() {
  const tokenList = document.getElementById('token-list');
  if (tokenList) {
    tokenList.innerHTML = sortedTokens.map(token => `
      <li class="token-item">
        <span class="token-name">${token.name} (${token.symbol})</span>
        <span class="token-price">$${token.current_price.toFixed(2)}</span>
        <span class="token-change ${token.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
          ${token.price_change_percentage_24h >= 0 ? '+' : ''}${token.price_change_percentage_24h.toFixed(2)}%
        </span>
      </li>
    `).join('');
  }
}

function renderLogs(logs) {
  const logList = document.getElementById('log-list');
  if (logList) {
    logList.innerHTML = (logs.data || []).slice(0, 10).map(log => `
      <li class="log-entry">
        <span class="log-time">${new Date(log.dt).toLocaleTimeString()}</span>
        <span class="log-message">${log.message}</span>
      </li>
    `).join('');
  }
}

// Initialize
function initializeDashboard() {
  updateTokens();
  setInterval(updateTokens, CONFIG.TOKEN_REFRESH_INTERVAL);
  
  updateLogs();
  setInterval(updateLogs, CONFIG.LOG_REFRESH_INTERVAL);
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
