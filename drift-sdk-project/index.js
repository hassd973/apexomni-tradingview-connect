const { DriftClient } = require('@drift-labs/sdk');

async function main() {
  // Initialize the Drift client (example endpoint)
  const client = new DriftClient({ endpoint: 'https://api.drift.trade' });
  console.log('Drift client initialized');
  // Add your logic here, e.g., fetch markets or place orders
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
