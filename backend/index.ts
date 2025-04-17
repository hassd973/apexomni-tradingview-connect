import express from 'express';
import cors from 'cors';
import { ApexClient } from '@apexpro/apexpro-api';

const app = express();

// Enable CORS for the frontend domain
app.use(cors({
  origin: 'https://ice-king-dashboard-tm4b.onrender.com',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// Apex Pro client setup
const client = new ApexClient({
  apiKey: process.env.APEX_API_KEY,
  starkKey: process.env.APEX_STARK_KEY,
  userId: process.env.APEX_USER_ID,
});

// API routes for frontend
app.get('/api/balance', async (req, res) => {
  try {
    const account = await client.getAccount();
    res.json({ balance: account.collateralBalance || 0 });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

app.get('/api/positions', async (req, res) => {
  try {
    const positions = await client.getPositions();
    res.json(positions || []);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Route for TradingView webhooks (example)
app.post('/webhook', (req, res) => {
  try {
    const alert = req.body;
    console.log('Received TradingView alert:', alert);
    // Process the alert and place trades via Apex Pro
    // Example: client.placeOrder(...)
    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
