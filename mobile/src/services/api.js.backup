// API Configuration
const API_URL = 'https://resiniferous-vixenly-kaidence.ngrok-free.dev';

class ApiService {
  async login(email, password) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    
    return response.json();
  }

  async signup(email, password, fullName) {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }
    
    return response.json();
  }

  async getUserStats(token) {
    const response = await fetch(`${API_URL}/api/user/stats`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to get stats');
    return response.json();
  }

  async getTodayPrompt(token) {
    const response = await fetch(`${API_URL}/api/prompts/today`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to get prompt');
    return response.json();
  }

  async submitPromptResponse(token, promptId, responseText) {
    const response = await fetch(`${API_URL}/api/prompts/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        promptId,
        response: responseText,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to submit response');
    return response.json();
  }

  async getMyStories(token) {
    const response = await fetch(`${API_URL}/api/prompts/responses`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to get stories');
    const data = await response.json();
    return { stories: data.responses || [] };
  }

  async getStoryDetail(token, storyId) {
    const response = await fetch(`${API_URL}/api/prompts/response/${storyId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) throw new Error('Failed to get story');
    const data = await response.json();
    return { story: data.response };
  }

  async sendAIMessage(token, message, history = []) {
    const response = await fetch(`${API_URL}/api/ai/persona`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        history,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }

  async submitFreeWrite(token, title, storyText) {
    const response = await fetch(`${API_URL}/api/prompts/freewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        response: storyText,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to submit story');
    return response.json();
  }
}

export default new ApiService();