async function fetchData() {
  try {
    const [balRes, posRes, pnlRes] = await Promise.all([
      fetch('https://omni-trading-webhook.onrender.com/balance'),
      fetch('https://omni-trading-webhook.onrender.com/positions'),
      fetch('https://omni-trading-webhook.onrender.com/pnl').catch(() => null)
    ]);

    if (balRes.ok) {
      const balData = await balRes.json();
      document.getElementById('balance').textContent = balData.balances.totalEquityValue || 'N/A';
    } else {
      document.getElementById('balance').textContent = 'Error';
    }

    if (posRes.ok) {
      const posData = await posRes.json();
      const posEl = document.getElementById('positions');
      posEl.innerHTML = '';
      if (posData.openPositions && posData.openPositions.length) {
        const ul = document.createElement('ul');
        posData.openPositions.forEach(p => {
          const li = document.createElement('li');
          li.textContent = `${p.symbol} (${p.side}) ${p.size}@${p.entryPrice}`;
          ul.appendChild(li);
        });
        posEl.appendChild(ul);
      } else {
        posEl.textContent = 'No open positions.';
      }
    }

    if (pnlRes && pnlRes.ok) {
      const pnlData = await pnlRes.json();
      document.getElementById('pnl').textContent = pnlData.realizedPnl || 'N/A';
    } else {
      document.getElementById('pnl').textContent = 'N/A';
    }

    // BTC Chart
    const chartRes = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1');
    const chartData = await chartRes.json();
    const ctx = document.getElementById('btcChart').getContext('2d');
    const labels = chartData.prices.map(p => new Date(p[0]).toLocaleTimeString());
    const data = chartData.prices.map(p => p[1]);
    if (window.btcChart) window.btcChart.destroy();
    window.btcChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: 'BTC/USD', data: data, borderColor: '#00f0ff', fill: false, tension: 0.3 }]
      },
      options: { scales: { x: { display: false } } }
    });

  } catch (err) {
    console.error(err);
  }
}

fetchData();
setInterval(fetchData, 10000);
