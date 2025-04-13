import ApexomniConnector from './client';
import config = require('config');
import { AlertObject } from '../../types';
import 'dotenv/config';
import { getDecimalPointLength, getStrategiesDB } from '../../helper';
import { generateRandomClientId, OrderType} from "apexpro-connector-node";
import {CreateOrderOptions, Market} from "apexpro-connector-node/lib/omni/interface";
import { BigNumber } from 'bignumber.js';
import {generateRandomClientIdOmni} from "apexpro-connector-node/lib/omni/tool/Tool";

export const apexomniBuildOrderParams = async (alertMessage: AlertObject) => {
	const [db, rootData] = getStrategiesDB();

	// set expiration datetime. must be more than 1 minute from current datetime
	const date = new Date();
	date.setMinutes(date.getMinutes() + 2);
	const dateStr = date.toJSON();

	const connector = await ApexomniConnector.build();

	let market = alertMessage.market;
	if (market.endsWith("USD")) {
		market = market.replace("USD", "USDT");
	}

	const marketsData = await connector.GetSymbolData(market);

	if (!marketsData){
		console.log('markets is error, symbol=' + market);
		throw new Error('markets is error, symbol=' + market);
	}

	console.log('marketsData', marketsData);

	const tickerData = await connector.client.publicApi.tickers(marketsData.crossSymbolName);
	console.log('tickerData', tickerData);
	if (tickerData.length == 0) {
		console.error('tickerData is error');
		throw new Error('tickerData is error, symbol=' + marketsData.crossSymbolName);
	}


	const orderSide =
		alertMessage.order == 'buy' ? "BUY" : "SELL";

	let orderSize: number;
	if (
		alertMessage.reverse &&
		rootData[alertMessage.strategy].isFirstOrder == 'false'
	) {
		orderSize = alertMessage.size * 2;
	} else {
		orderSize = alertMessage.size;
	}

	const stepSize = parseFloat(marketsData.stepSize);
	let orderSizeStr;

	if(stepSize  >= 1){
		orderSizeStr =  new BigNumber(orderSize).div(stepSize).dp(0,BigNumber.ROUND_DOWN).multipliedBy(stepSize).toFixed(0,BigNumber.ROUND_DOWN)
	}else{
		const stepDecimal = getDecimalPointLength(stepSize);
		orderSizeStr = Number(orderSize).toFixed(stepDecimal);
	}


	const latestPrice = parseFloat(tickerData.at(0).indexPrice);
	const tickSize = parseFloat(marketsData.tickSize);
	console.log('latestPrice', latestPrice);

	const slippagePercentage = 0.05;
	const minPrice =
		orderSide == "BUY"
			? latestPrice * (1 + slippagePercentage)
			: latestPrice * (1 - slippagePercentage);

	const priceBN = new BigNumber(minPrice);
	const price = priceBN.minus(priceBN.mod(tickSize)).toFixed();

	//const decimal = getDecimalPointLength(tickSize);
	//const price = minPrice.toFixed(decimal);

	const baseCoinRealPrecision = marketsData.baseCoinRealPrecision;
	const takerFeeRate = connector.client.account.contractAccount.takerFeeRate;
	const makerFeeRate = connector.client.account.contractAccount.makerFeeRate;

	const limitFee = new BigNumber(price)
		.multipliedBy(takerFeeRate || '0')
		.multipliedBy(orderSizeStr)
		.toFixed(baseCoinRealPrecision, BigNumber.ROUND_UP);

	console.log('limitFee: ', limitFee.toString());


	console.log('limitFee: ', limitFee.toString());
	const apiOrder: CreateOrderOptions = {
		makerFeeRate: makerFeeRate,
		pairId: marketsData.l2PairId,
		takerFeeRate: takerFeeRate,
		limitFee: limitFee,
		price: price,
		reduceOnly: false,
		side: orderSide,
		size: orderSizeStr,
		symbol: <Market>market,
		timeInForce: 'FILL_OR_KILL',
		type: OrderType.MARKET,
		expiration: Math.floor(
			Date.now() / 1000 + 30 * 24 * 60 * 60
		),
		trailingPercent: '',
		triggerPrice: ''
	} ;

	console.log('apiOrder for apexOmni', apiOrder);
	return apiOrder;
};
