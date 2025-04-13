import config = require('config');
import 'dotenv/config';
import {ApexClient, ApiKeyCredentials, OMNI_QA} from "apexpro-connector-node";
import {Metadata} from "apexpro-connector-node/lib/omni/interface";

class ApexomniConnector {
	client: ApexClient.omni | undefined;
	positionID = '0';
	static instance: ApexomniConnector | null = null;
	symbols: Metadata | undefined;

	public constructor() {
		if (
			!process.env.API_KEY ||
			!process.env.API_PASSPHRASE ||
			!process.env.API_PASSPHRASE
		) {
			console.log('API Key for Apexomni is not set as environment variable');
			return;
		}
		if (!process.env.ZKLINK_SEED ) {
			console.log('ZKLINK_SEED for Apexomni is not set as environment variable');
			return;
		}
		if (!process.env.ACCOUNT_ID) {
			console.log('account id  for Apexomni is not set as environment variable');
			return;
		}


		this.client = new ApexClient.omni();

	}

	static async build() {
		if (!this.instance) {
			const connector = new ApexomniConnector();
			if (!connector || !connector.client) return;
			//const account = await connector.client.private.getAccount(
			//	process.env.ETH_ADDRESS
			//);

			const apiKeys: ApiKeyCredentials = {
				key: process.env.API_KEY,
				passphrase: process.env.API_PASSPHRASE,
				secret: process.env.API_SECRET
			};

			await connector.client.init(apiKeys, process.env.ZKLINK_SEED);

			connector.symbols = await connector.client.publicApi.symbols();

			this.instance = connector;
		}

		return this.instance;
	}

	GetSymbolData = async function(symbol:string) : Promise<any> {
		const connector = await ApexomniConnector.build();
		if (!connector ) return;
		if( connector.symbols != null ){
			for(const key  of connector.symbols.contractConfig.perpetualContract){
				if (key.symbol == symbol || key.crossSymbolName == symbol || key.symbolDisplayName == symbol )
					return key
			}
		}
	};
}

export default ApexomniConnector;
