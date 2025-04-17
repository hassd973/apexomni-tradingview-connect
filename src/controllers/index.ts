import express, { Router } from 'express';
import {
  apexomniCreateOrder,
  apexomniGetAccount,
  apexomniBuildOrderParams,
  apexomniExportOrder,
  validateAlert,
  checkAfterPosition,
} from '../services';

const router: Router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  console.log('Received GET request.');

  const apexomniAccount = await apexomniGetAccount();

  if (!apexomniAccount) {
    res.status(500).json({ error: 'Error on getting account data' });
  } else {
    res.json({
      message: 'apexomni Account Ready',
      account: apexomniAccount,
    });
  }
});

// Endpoint for frontend to fetch balance
router.get('/api/balance', async (req, res) => {
  console.log('Received request for /api/balance');
  try {
    const apexomniAccount = await apexomniGetAccount();
    if (!apexomniAccount) {
      res.status(500).json({ error: 'Error on getting account data' });
      return;
    }
    // Assuming apexomniAccount has a balance or collateralBalance field
    const balance = apexomniAccount.collateralBalance || 0;
    res.json({ balance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Endpoint for frontend to fetch positions
router.get('/api/positions', async (req, res) => {
  console.log('Received request for /api/positions');
  try {
    const apexomniAccount = await apexomniGetAccount();
    if (!apexomniAccount) {
      res.status(500).json({ error: 'Error on getting account data' });
      return;
    }
    // Assuming apexomniAccount has a positions field (array of open positions)
    // If apexomniGetAccount doesn't return positions, you may need a separate service function
    const positions = apexomniAccount.positions || [];
    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// TradingView webhook endpoint
router.post('/', async (req, res) => {
  console.log('Received TradingView strategy alert:', req.body);

  const validated = await validateAlert(req.body);
  if (!validated) {
    res.status(400).json({ error: 'Error. Alert message is not valid' });
    return;
  }

  let orderResult;
  switch (req.body['exchange']) {
    case 'perpetual': {
      // Handle perpetual exchange if needed
      break;
    }
    default: {
      try {
        const orderParams = await apexomniBuildOrderParams(req.body);
        if (!orderParams) {
          res.status(400).json({ error: 'Error. Unable to build order parameters' });
          return;
        }
        orderResult = await apexomniCreateOrder(orderParams);
        if (!orderResult) {
          res.status(500).json({ error: 'Error. Failed to create order' });
          return;
        }
        await apexomniExportOrder(
          req.body['strategy'],
          orderResult,
          req.body['price']
        );
      } catch (e) {
        res.status(500).json({ error: `Error. ${e.message || e}` });
        return;
      }
    }
  }

  // Optionally check position after placing the order
  // checkAfterPosition(req.body);

  res.json({ message: 'OK' });
});

// Sentry debug endpoint
router.get('/debug-sentry', (req, res) => {
  throw new Error('My first Sentry error!');
});

export default router;
