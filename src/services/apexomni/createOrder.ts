import ApexomniConnector from './client';
import { _sleep } from '../../helper';
import {CreateOrderOptions, OrderObject} from "apexpro-connector-node/lib/omni/interface";

export const apexomniCreateOrder = async (apiOrder: CreateOrderOptions) => {
	let count = 0;
	const maxTries = 3;
	while (count <= maxTries) {
		try {
			const connector = await ApexomniConnector.build();
			const orderResult =
				await connector.client.privateApi.createOrder(
					apiOrder
				);

			 //console.log("orderResult.order：" , orderResult);

			console.log(
				new Date() + ' placed order market:',
				apiOrder.symbol,
				'side:',
				apiOrder.side,
				'price:',
				apiOrder.price,
				'size:',
				apiOrder.size
			);

			return orderResult;
		} catch (error) {
			count++;
			if (count == maxTries) {
				console.error(error);
			}
			await _sleep(5000);
		}
	}
};
