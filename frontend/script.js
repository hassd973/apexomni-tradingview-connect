// === Ice King Dashboard Script ===
// Author: ZEL
// Purpose: Display token data and logs with TradingView chart
// Features: Terminal-style UI, sticky chart toggle, backend integration

// --- Papertrail HTTP Logging ---
const PAPERTRAIL_URL = 'https://logsX.papertrailapp.com:XXXXX/systems/apexomni-frontend/events'; // Replace with your Papertrail HTTP endpoint

async function logToPapertrail(level, message, metadata = {}) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toLowerCase(),
      message,
      ...metadata
    };
    await fetch(PAPERTRAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    });
    console.log(`[${level.toUpperCase()}] ${message}`, metadata);
  } catch (error) {
    console.error(`[ERROR] Failed to log to Papertrail: ${error.message}`);
  }
}

// --- Constants and Configuration ---
const BACKEND_URL = 'https://apexomni-backend-fppm.onrender.com';
const TOKEN_REFRESH_INTERVAL = 30000;
const LOG_REFRESH_INTERVAL = 10000;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

// --- Mock Data (Immediate Fallback) ---
const mockTokens = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', current_price: 60000, total_volume: 4500000, price_change_percentage_24h: 5.2, market_cap: 1500000000, circulating_supply: 19000000, source: 'Mock', high_24h: 61000, low_24h: 59000, market_cap_rank: 1 },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', current_price: 4000, total_volume: 3000000, price_change_percentage_24h: -2.1, market_cap: 7500000000, circulating_supply: 120000000, source: 'Mock', high_24h: 4100, low_24h: 3900, market_cap_rank: 2 },
  { id: 'constitutiondao', name: 'ConstitutionDAO', symbol: 'PEOPLE', current_price: 0.01962, total_volume: 135674.745, price_change_percentage_24h: 41.10, market_cap: 99400658.805, circulating_supply: 5066406500, source: 'Mock', high_24h: 0.020, low_24h: 0.018, market_cap_rank: 150 }
];
const mockLogs = [
  { timestamp: new Date().toISOString(), message: 'Dashboard initialized', level: 'info' },
  { timestamp: new Date().toISOString(), message: 'Using mock data', level: 'warn' }
];

// --- Ice King Puns for Marquee ---
const iceKingPuns = [
  "Everything is Going to be okay! ❄️👑",
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

// --- Global State ---
let usedPuns = [];
let currentToken = mockTokens[0];
let currentTimeframe = '1d';
let allTokens = mockTokens;
let sortedTokens = [...mockTokens].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
let isChartDocked = false;
let selectedTokenLi = null;
let logs = mockLogs;

// --- Utility Functions ---

// Fetch with retry
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DEBUG] Fetching ${url} (Attempt ${i + 1}/${retries})`);
      const response = await fetch(url, { timeout: 5000 });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log(`[DEBUG] Fetch successful for ${url}, response:`, data);
      await logToPapertrail('info', `Fetch successful for ${url}`, { response: JSON.stringify(data) });
      return data;
    } catch (error) {
      console.error(`[ERROR] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
      await logToPapertrail('error', `Fetch failed for ${url}`, { attempt: i + 1, retries, error: error.message });
      if (i === retries - 1) {
        console.error(`[ERROR] All retries failed for ${url}, using fallback`);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Validate and sanitize token data
function sanitizeTokenData(data) {
  if (!data || !Array.isArray(data)) {
    console.error('[ERROR] Invalid token data format, expected array:', data);
    logToPapertrail('error', 'Invalid token data format', { data });
    return mockTokens;
  }
  const sanitized = data.map(token => ({
    id: String(token.id || '').replace(/[^a-zA-Z0-9-]/g, ''),
    name: String(token.name || 'Unknown').substring(0, 50),
    symbol: String(token.symbol || '').toUpperCase().substring(0, 10),
    total_volume: Number(token
