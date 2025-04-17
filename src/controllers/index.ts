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
	console.log('Recieved GET request.');

	const apexomniAccount = await apexomniGetAccount();

	if (!apexomniAccount ) {
		res.send('Error on getting account data');
	} else {
		const message =
			'apexomni Account Ready: ' +
			apexomniAccount ;
		res.send(message);
	}
});

router.post('/', async (req, res) => {
	console.log('Recieved Tradingview strategy alert:', req.body);

	const validated = await validateAlert(req.body);
	if (!validated) {
		res.send('Error. alert message is not valid');
		return;
	}

	// if (!orderParams) return;
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

	//checkAfterPosition(req.body);

	res.send('OK');
});

router.get('/debug-sentry', function mainHandler(req, res) {
	throw new Error('My first Sentry error!');
});

export default router;
