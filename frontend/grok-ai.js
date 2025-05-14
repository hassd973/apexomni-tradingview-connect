// Grok AI Interaction Module
async function queryGrokAI(prompt) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/grok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) {
      throw new Error('Grok AI request failed');
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Grok AI Query Error:', error);
    return 'Sorry, I could not process your request at the moment. ❄️';
  }
}

// Function to display Grok AI response in the UI
async function displayGrokAIResponse(prompt) {
  const grokResponseElement = document.getElementById('grok-ai-response');
  const chatList = document.getElementById('chat-list');
  
  if (!grokResponseElement || !chatList) {
    console.error('[ERROR] Grok AI response or chat list element not found');
    return;
  }

  // Show loading state
  grokResponseElement.innerHTML = '> Consulting the Ice King... 🧊👑';
  
  try {
    const response = await queryGrokAI(prompt);
    
    // Display the response with Ice King flair
    const formattedResponse = `🧊 ${response}`;
    grokResponseElement.innerHTML = formattedResponse;
    
    // Add to chat history
    const chatItem = document.createElement('li');
    chatItem.classList.add('bg-gray-800', 'p-2', 'rounded', 'text-green-400', 'fade-in');
    chatItem.innerHTML = `
      <div class="flex justify-between">
        <span class="font-bold text-green-300">🤖 Grok AI</span>
        <span class="text-xs text-gray-500">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="mt-1">${formattedResponse}</div>
    `;
    
    // Add user prompt to chat history
    const userPromptItem = document.createElement('li');
    userPromptItem.classList.add('bg-gray-900', 'p-2', 'rounded', 'text-blue-300', 'fade-in');
    userPromptItem.innerHTML = `
      <div class="flex justify-between">
        <span class="font-bold text-blue-200">👑 Ice King</span>
        <span class="text-xs text-gray-500">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="mt-1">${prompt}</div>
    `;
    
    // Prepend items to chat list and scroll to top
    chatList.insertBefore(chatItem, chatList.firstChild);
    chatList.insertBefore(userPromptItem, chatList.firstChild);
    chatList.scrollTop = 0;
    
    // Clear input after sending
    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.value = '';
    
  } catch (error) {
    console.error('Grok AI Display Error:', error);
    grokResponseElement.innerHTML = '> Oops! The Ice King is taking a break. ❄️🐧';
    
    // Add error to chat history
    const errorItem = document.createElement('li');
    errorItem.classList.add('bg-red-900', 'p-2', 'rounded', 'text-red-300', 'fade-in');
    errorItem.innerHTML = `
      <div class="flex justify-between">
        <span class="font-bold text-red-200">❌ Error</span>
        <span class="text-xs text-gray-500">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="mt-1">Sorry, the Ice King's magic is temporarily frozen. ${error.message}</div>
    `;
    
    chatList.insertBefore(errorItem, chatList.firstChild);
    chatList.scrollTop = 0;
  }
}

// Event listener for chat send button
document.addEventListener('DOMContentLoaded', () => {
  const chatSendBtn = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');

  if (chatSendBtn && chatInput) {
    // Send message on button click
    chatSendBtn.addEventListener('click', () => {
      const prompt = chatInput.value.trim();
      if (prompt) {
        displayGrokAIResponse(prompt);
      }
    });

    // Send message on Enter key press
    chatInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const prompt = chatInput.value.trim();
        if (prompt) {
          displayGrokAIResponse(prompt);
        }
      }
    });
  }
});
