import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'static')));

app.get('/api/balance', async (req, res) => {
  const response = await fetch('https://omni-trading-webhook.onrender.com/balance');
  const data = await response.json();
  res.json(data);
});

app.get('/api/positions', async (req, res) => {
  const response = await fetch('https://omni-trading-webhook.onrender.com/positions');
  const data = await response.json();
  res.json(data);
});

app.get('/api/pnl', async (req, res) => {
  const response = await fetch('https://omni-trading-webhook.onrender.com/pnl');
  const data = await response.json();
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`ICE KING Dashboard running on http://localhost:${PORT}`);
});