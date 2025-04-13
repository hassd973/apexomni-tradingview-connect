import ApexomniConnector from './client';
import 'dotenv/config';

export const apexomniGetAccount = async () => {
	try {
		const connector = await ApexomniConnector.build();
		if(!connector) return false;

		/*const account = await connector.client.privateApi.getAccount(
			process.env.ETH_ADDRESS, process.env.ACCOUNT_ID,
		);*/

		const balance = await connector.client.privateApi.accountBalance();

		console.log('apexomni balance: ', balance);
		/*if (account.wallets != null && account.wallets.length > 0) {
			console.log('apexomni account balance: ', Number(account.wallets[0].balance));
			if (Number(account.wallets[0].balance) == 0) {
				return false;
			} else {
				return true;
			}
		} */
		if (balance != null){
			if (Number(balance.availableBalance) == 0) {
				return false;
			} else {
				return true;
			}
		} else
			return false
	} catch (error) {
		console.error(error);
	}
};
