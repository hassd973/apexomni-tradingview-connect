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
  
  if (!grokResponseElement) {
    console.error('[ERROR] Grok AI response element not found');
    return;
  }

  // Show loading state
  grokResponseElement.innerHTML = '> Consulting the Ice King... 🧊👑';
  
  try {
    const response = await queryGrokAI(prompt);
    
    // Display the response with Ice King flair
    grokResponseElement.innerHTML = `
      > 👑 Ice King's Wisdom: 
      <br>
      ${response}
      <br>
      > ❄️ Powered by Grok AI
    `;
  } catch (error) {
    grokResponseElement.innerHTML = '> Oops! The Ice King is chilling. Try again later. ❄️';
  }
}

// Add Grok AI interaction to the existing event listeners
document.addEventListener('DOMContentLoaded', () => {
  const grokAIInput = document.getElementById('grok-ai-input');
  const grokAISubmit = document.getElementById('grok-ai-submit');

  if (grokAIInput && grokAISubmit) {
    grokAISubmit.addEventListener('click', () => {
      const prompt = grokAIInput.value.trim();
      if (prompt) {
        displayGrokAIResponse(prompt);
        grokAIInput.value = ''; // Clear input after submission
      }
    });

    // Optional: Add enter key support
    grokAIInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        const prompt = grokAIInput.value.trim();
        if (prompt) {
          displayGrokAIResponse(prompt);
          grokAIInput.value = ''; // Clear input after submission
        }
      }
    });
  }
});
