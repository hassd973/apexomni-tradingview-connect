
async function fetchData() {
  const endpoints = ['balance', 'positions', 'pnl'];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`https://omni-trading-webhook.onrender.com/${endpoint}`);
      const data = await res.json();
      document.getElementById(endpoint).textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      document.getElementById(endpoint).textContent = `Error fetching ${endpoint}`;
    }
  }
}

// Dummy chart
const ctx = document.getElementById('chart').getContext('2d');
let chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Sample PnL Trend',
      data: [],
      borderColor: '#00f2ff',
      backgroundColor: 'rgba(0, 242, 255, 0.2)',
      fill: true,
      tension: 0.4
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { ticks: { color: '#ccc' }, grid: { color: '#333' } },
      y: { ticks: { color: '#ccc' }, grid: { color: '#333' } }
    },
    plugins: {
      legend: { labels: { color: '#ccc' } }
    }
  }
});

function updateChart() {
  const now = new Date().toLocaleTimeString();
  const newVal = Math.random() * 100 - 50;
  chart.data.labels.push(now);
  chart.data.datasets[0].data.push(newVal);
  if (chart.data.labels.length > 10) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

setInterval(() => {
  fetchData();
  updateChart();
}, 10000);

fetchData();
updateChart();
