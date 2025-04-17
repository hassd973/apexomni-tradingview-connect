
document.addEventListener("DOMContentLoaded", () => {
  fetch('/balance')
    .then(res => res.json())
    .then(data => {
      document.getElementById('balance').innerText = `$${parseFloat(data?.totalEquityValue || 0).toFixed(2)}`;
    });

  fetch('/positions')
    .then(res => res.json())
    .then(data => {
      const positionsTable = document.getElementById('positions');
      if (data?.positions?.length > 0) {
        data.positions.forEach(pos => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${pos.symbol}</td>
            <td>${pos.side}</td>
            <td>${pos.size} BTC</td>
            <td>$${parseFloat(pos.entryPrice).toFixed(2)}</td>
          `;
          positionsTable.appendChild(row);
        });
      } else {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4">No open positions.</td>';
        positionsTable.appendChild(row);
      }
    });

  fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1')
    .then(res => res.json())
    .then(data => {
      const ctx = document.getElementById('btcChart').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.prices.map(p => new Date(p[0]).toLocaleTimeString()),
          datasets: [{
            label: 'BTC/USD',
            data: data.prices.map(p => p[1]),
            borderColor: '#00f0ff',
            backgroundColor: 'rgba(0, 240, 255, 0.05)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          plugins: {
            legend: {
              labels: { color: '#00f0ff' }
            }
          },
          scales: {
            x: {
              ticks: { color: '#00f0ff' }
            },
            y: {
              ticks: { color: '#00f0ff' }
            }
          }
        }
      });
    });
});
