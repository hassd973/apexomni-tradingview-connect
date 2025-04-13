declare namespace NodeJS {
	interface ProcessEnv {
		readonly ETH_ADDRESS: string;
		readonly ZKLINK_SEED: string;
		readonly API_KEY: string;
		readonly API_PASSPHRASE: string;
		readonly API_SECRET: string;
		readonly ACCOUNT_ID: string;
		readonly TRADINGVIEW_PASSPHRASE: string;
	}
}
