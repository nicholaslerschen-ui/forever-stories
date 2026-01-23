// API Configuration
const API_URL = 'https://resiniferous-vixenly-kaidence.ngrok-free.dev';

// Common headers for all requests
const getHeaders = (token = null, includeContentType = true) => {
  const headers = {
    'ngrok-skip-browser-warning': 'true',
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

class ApiService {
  async login(email, password) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      } catch (e) {
        // If response is not JSON (e.g., HTML error page from ngrok)
        throw new Error('Server is not responding. Please check if the backend is running.');
      }
    }

    return response.json();
  }

  async signup(email, password, fullName) {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password, fullName }),
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      } catch (e) {
        // If response is not JSON (e.g., HTML error page from ngrok)
        throw new Error('Server is not responding. Please check if the backend is running.');
      }
    }

    return response.json();
  }

  async getUserStats(token) {
    const response = await fetch(`${API_URL}/api/user/stats`, {
      headers: getHeaders(token, false),
    });
    
    if (!response.ok) throw new Error('Failed to get stats');
    return response.json();
  }

  async getTodayPrompt(token) {
    const response = await fetch(`${API_URL}/api/prompts/today`, {
      headers: getHeaders(token, false),
    });
    
    if (!response.ok) throw new Error('Failed to get prompt');
    return response.json();
  }

  async submitPromptResponse(token, promptId, responseText, submittedQuestionId = null) {
    const response = await fetch(`${API_URL}/api/prompts/respond`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        promptId,
        response: responseText,
        submittedQuestionId,
      }),
    });

    if (!response.ok) throw new Error('Failed to submit response');
    return response.json();
  }

  async getMyStories(token) {
    const response = await fetch(`${API_URL}/api/prompts/responses`, {
      headers: getHeaders(token, false),
    });
    
    if (!response.ok) throw new Error('Failed to get stories');
    const data = await response.json();
    return { stories: data.responses || [] };
  }

  async getStoryDetail(token, storyId) {
    const response = await fetch(`${API_URL}/api/prompts/response/${storyId}`, {
      headers: getHeaders(token, false),
    });
    
    if (!response.ok) throw new Error('Failed to get story');
    const data = await response.json();
    return { story: data.response };
  }

  async sendAIMessage(token, message, history = []) {
    const response = await fetch(`${API_URL}/api/ai/persona`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        message,
        history,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }

  async submitFreeWrite(token, title, storyText) {
    const response = await fetch(`${API_URL}/api/prompts/respond`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        promptId: null,
        response: storyText,
        isFreeWrite: true,
        title: title,
      }),
    });

    if (!response.ok) throw new Error('Failed to submit story');
    return response.json();
  }

  // ===== ACCOUNT MANAGEMENT =====

  async getUserAccount(token) {
    const response = await fetch(`${API_URL}/api/user/account`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get account');
      } catch (e) {
        throw new Error('Server is not responding. Please check if the backend is running.');
      }
    }

    return response.json();
  }

  async updateBasicInfo(token, fullName, email) {
    const response = await fetch(`${API_URL}/api/user/account/basic`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({ fullName, email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update account');
    }

    return response.json();
  }

  async updatePassword(token, currentPassword, newPassword) {
    const response = await fetch(`${API_URL}/api/user/account/password`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update password');
    }

    return response.json();
  }

  async updateProfile(token, profileData) {
    const response = await fetch(`${API_URL}/api/user/account/profile`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update profile');
    }

    return response.json();
  }

  // ===== ACCESS MANAGEMENT =====

  async sendInvitation(token, recipientEmail, permissions) {
    const response = await fetch(`${API_URL}/api/access/invite`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ recipientEmail, permissions }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invitation');
    }

    return response.json();
  }

  async getAccessGrants(token) {
    const response = await fetch(`${API_URL}/api/access/grants`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get access grants');
    }

    return response.json();
  }

  async updateAccessGrant(token, grantId, permissions) {
    const response = await fetch(`${API_URL}/api/access/grant/${grantId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({ permissions }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update access');
    }

    return response.json();
  }

  async revokeAccess(token, grantId) {
    const response = await fetch(`${API_URL}/api/access/grant/${grantId}`, {
      method: 'DELETE',
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke access');
    }

    return response.json();
  }

  async getMyAccess(token) {
    const response = await fetch(`${API_URL}/api/access/my-access`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get access list');
    }

    return response.json();
  }

  // ===== QUESTION SUBMISSION =====

  async submitQuestion(token, ownerId, questionText) {
    const response = await fetch(`${API_URL}/api/questions/submit`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ ownerId, questionText }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit question');
    }

    return response.json();
  }

  async getSubmittedQuestions(token) {
    const response = await fetch(`${API_URL}/api/questions/submitted`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get questions');
    }

    return response.json();
  }

  async deleteQuestion(token, questionId) {
    const response = await fetch(`${API_URL}/api/questions/${questionId}`, {
      method: 'DELETE',
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete question');
    }

    return response.json();
  }
}

export default new ApiService();
