// Live Logs Fetching and Display
async function fetchLiveLogs(query = '', batch = 50) {
  try {
    const response = await fetch(`/api/live-logs?query=${encodeURIComponent(query)}&batch=${batch}`);
    const data = await response.json();
    
    if (!data.success) {
      console.error('Failed to fetch live logs:', data.error);
      return [];
    }
    
    return data.logs;
  } catch (error) {
    console.error('Error fetching live logs:', error);
    return [];
  }
}

function displayLiveLogs(logs) {
  const liveLogsContainer = document.getElementById('live-logs-container');
  if (!liveLogsContainer) return;

  // Clear previous logs
  liveLogsContainer.innerHTML = '';

  logs.forEach(log => {
    const logElement = document.createElement('div');
    logElement.classList.add(
      'log-item', 
      'p-2', 
      'rounded', 
      'mb-1', 
      'text-sm', 
      'transition-all', 
      'duration-300',
      log.level === 'error' ? 'bg-red-900 text-red-300' : 
      log.level === 'warn' ? 'bg-yellow-900 text-yellow-300' : 
      'bg-gray-800 text-green-300'
    );
    
    const timestamp = new Date(log.timestamp).toLocaleString();
    logElement.innerHTML = `
      <div class="flex justify-between">
        <span class="font-bold opacity-70">${timestamp}</span>
        <span class="text-xs opacity-50 uppercase">${log.level}</span>
      </div>
      <div class="mt-1">${log.message}</div>
    `;
    
    liveLogsContainer.appendChild(logElement);
  });
}

async function initLiveLogs() {
  const liveLogsContainer = document.getElementById('live-logs-container');
  if (!liveLogsContainer) return;

  try {
    const logs = await fetchLiveLogs();
    displayLiveLogs(logs);

    // Optional: Set up periodic refresh
    setInterval(async () => {
      const freshLogs = await fetchLiveLogs();
      displayLiveLogs(freshLogs);
    }, 30000); // Refresh every 30 seconds
  } catch (error) {
    console.error('Failed to initialize live logs:', error);
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initLiveLogs);
