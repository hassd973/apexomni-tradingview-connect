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

router.get('/', async (req, res) => {
	console.log('Received GET request.');

	const apexomniAccount = await apexomniGetAccount();

	if (!apexomniAccount) {
		res.send('Error on getting account data');
	} else {
		const message = 'apexomni Account Ready: ' + apexomniAccount;
		res.send(message);
	}
});

router.post('/', async (req, res) => {
	console.log('Received TradingView alert at `/`: ', req.body);

	const validated = await validateAlert(req.body);
	if (!validated) {
		res.send('Error. Alert message is not valid');
		return;
	}

	let orderResult;
	switch (req.body['exchange']) {
		case 'perpetual': {
			break;
		}
		default: {
			try {
				const orderParams = await apexomniBuildOrderParams(req.body);
				if (!orderParams) return;
				orderResult = await apexomniCreateOrder(orderParams);
				if (!orderResult) return;
				await apexomniExportOrder(
					req.body['strategy'],
					orderResult,
					req.body['price']
				);
			} catch (e) {
				res.send('Error. ' + (e.message || e));
				return;
			}
		}
	}

	res.send('OK');
});

// ✅ Secure /webhook route with token validation and token stripping
router.post('/webhook', async (req, res) => {
	console.log('📥 Webhook POST received:', req.body);

	const { token, ...cleanBody } = req.body;

	if (!token || token !== process.env.WEBHOOK_SECRET) {
		console.warn('🚨 Invalid token:', token);
		return res.status(403).send('Forbidden: Invalid Token');
	}

	const validated = await validateAlert(cleanBody);
	if (!validated) {
		res.send('Error. Alert message is not valid');
		return;
	}

	let orderResult;
	try {
		const orderParams = await apexomniBuildOrderParams(cleanBody);
		if (!orderParams) return;
		orderResult = await apexomniCreateOrder(orderParams);
		if (!orderResult) return;
		await apexomniExportOrder(
			cleanBody['strategy'],
			orderResult,
			cleanBody['price']
		);
	} catch (e) {
		res.send('Error. ' + (e.message || e));
		return;
	}

	res.send('✅ Secure webhook OK');
});

router.get('/debug-sentry', function mainHandler(req, res) {
	throw new Error('My first Sentry error!');
});

export default router;
