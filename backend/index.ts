import express from 'express';
import { ApexClient } from '@apexpro/apexpro-api';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

// Serve static frontend build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Apex Pro client setup
const client = new ApexClient({
  apiKey: process.env.APEX_API_KEY,
  starkKey: process.env.APEX_STARK_KEY,
  userId: process.env.APEX_USER_ID,
});

// API routes
app.get('/api/balance', async (req, res) => {
  try {
    const account = await client.getAccount();
    res.json({ balance: account.collateralBalance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

app.get('/api/positions', async (req, res) => {
  try {
    const positions = await client.getPositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Fallback to serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
