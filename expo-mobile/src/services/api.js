// API Configuration
// Production Railway URL
const API_URL = 'https://distinguished-beauty-production-1e26.up.railway.app';

// Common headers for all requests
const getHeaders = (token = null, includeContentType = true) => {
  const headers = {};
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

  async signup(email, password, fullName, role = 'owner', reverseInviteCode = null) {
    const body = { email, password, fullName, role, termsAccepted: true };
    if (reverseInviteCode) {
      body.reverseInviteCode = reverseInviteCode;
    }

    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage = 'Signup failed';
      try {
        const error = await response.json();
        errorMessage = error.error || 'Signup failed';
      } catch (e) {
        errorMessage = 'Server is not responding. Please check if the backend is running.';
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async forgotPassword(email) {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to send reset code');
    }

    return response.json();
  }

  async resetPassword(email, code, newPassword) {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, code, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to reset password');
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

  async submitPromptResponse(token, promptId, responseText, submittedQuestionId = null, fileIds = null, followUpData = null) {
    const response = await fetch(`${API_URL}/api/prompts/respond`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        promptId,
        response: responseText,
        submittedQuestionId,
        fileIds,
        followUpData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.upgrade_required || response.status === 403) {
        const error = new Error(errorData.message || 'Story limit reached');
        error.upgradeRequired = true;
        error.storyCount = errorData.storyCount;
        error.storyLimit = errorData.storyLimit;
        throw error;
      }
      throw new Error(errorData.error || 'Failed to submit response');
    }
    return response.json();
  }

  async getMyStories(token, ownerId = null) {
    const url = ownerId && ownerId !== 'myself'
      ? `${API_URL}/api/prompts/history?ownerId=${ownerId}`
      : `${API_URL}/api/prompts/history`;

    const response = await fetch(url, {
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

  async updateStory(token, storyId, responseText, title = null, fileIds = null, followUpData = null) {
    const response = await fetch(`${API_URL}/api/prompts/response/${storyId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({
        response: responseText,
        title,
        fileIds,
        followUpData,
      }),
    });

    if (!response.ok) throw new Error('Failed to update story');
    return response.json();
  }

  async deleteStory(token, storyId) {
    const response = await fetch(`${API_URL}/api/prompts/response/${storyId}`, {
      method: 'DELETE',
      headers: getHeaders(token, false),
    });

    if (!response.ok) throw new Error('Failed to delete story');
    return response.json();
  }

  async sendAIMessage(token, message, history = [], ownerId = null) {
    const body = { message, history };
    if (ownerId) body.ownerId = ownerId;

    const response = await fetch(`${API_URL}/api/ai/persona`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.upgrade_required) {
        const error = new Error('Premium subscription required');
        error.upgradeRequired = true;
        error.ownerNotPremium = errorData.owner_not_premium || false;
        throw error;
      }
      throw new Error('Failed to send message');
    }
    return response.json();
  }

  async submitFreeWrite(token, title, storyText, fileIds = null, followUpData = null) {
    const response = await fetch(`${API_URL}/api/prompts/respond`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        promptId: null,
        response: storyText,
        isFreeWrite: true,
        title: title,
        fileIds,
        followUpData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.upgrade_required || response.status === 403) {
        const error = new Error(errorData.message || 'Story limit reached');
        error.upgradeRequired = true;
        error.storyCount = errorData.storyCount;
        error.storyLimit = errorData.storyLimit;
        throw error;
      }
      throw new Error(errorData.error || 'Failed to submit story');
    }
    return response.json();
  }

  // ===== FILE UPLOADS =====

  async uploadFiles(token, files) {
    const formData = new FormData();

    files.forEach((file, index) => {
      formData.append('files', {
        uri: file.uri,
        type: file.type,
        name: file.fileName || `file_${index}.${file.type.split('/')[1]}`
      });
    });

    const response = await fetch(`${API_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
        // No Content-Type - browser/RN sets it automatically for FormData
      },
      body: formData
    });

    if (!response.ok) {
      let errorMessage = 'Failed to upload files';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If response is not JSON, use default message
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  // ===== RATING & SKIP SYSTEM =====

  async ratePrompt(token, promptId, responseId, rating) {
    const response = await fetch(`${API_URL}/api/prompts/rate`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ promptId, responseId, rating }),
    });

    if (!response.ok) throw new Error('Failed to rate prompt');
    return response.json();
  }

  async skipPrompt(token, promptId, skipReason = null) {
    console.log('🔄 Skipping prompt:', promptId, 'reason:', skipReason);
    const response = await fetch(`${API_URL}/api/prompts/skip`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ promptId, skipReason }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to skip prompt' }));
      console.error('❌ Skip prompt error:', errorData);
      throw new Error(errorData.error || 'Failed to skip prompt');
    }
    return response.json();
  }

  async choosePrompt(token, promptId) {
    const response = await fetch(`${API_URL}/api/prompts/choose`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ promptId }),
    });

    if (!response.ok) throw new Error('Failed to choose prompt');
    return response.json();
  }

  async getNextWeightedPrompt(token, mode = 'normal') {
    const response = await fetch(`${API_URL}/api/prompts/next-weighted?mode=${mode}`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) throw new Error('Failed to get next prompt');
    return response.json();
  }

  async getUserAffinity(token) {
    const response = await fetch(`${API_URL}/api/prompts/affinity`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) throw new Error('Failed to get affinity data');
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

  async deleteAccount(token) {
    const response = await fetch(`${API_URL}/api/user/account`, {
      method: 'DELETE',
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.details
        ? `${error.error}\n\nDetails: ${error.details}\nConstraint: ${error.constraint || 'N/A'}\nTable: ${error.table || 'N/A'}`
        : error.error || 'Failed to delete account';
      throw new Error(errorMessage);
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

  async getPendingQuestionsCount(token) {
    const response = await fetch(`${API_URL}/api/questions/pending-count`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      throw new Error('Failed to get pending questions count');
    }

    return response.json();
  }

  async getPendingQuestions(token) {
    const response = await fetch(`${API_URL}/api/questions/pending`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      throw new Error('Failed to get pending questions');
    }

    return response.json();
  }

  async getSpecificQuestion(token, questionId) {
    const response = await fetch(`${API_URL}/api/questions/question/${questionId}`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      throw new Error('Failed to get question');
    }

    return response.json();
  }

  async unlockGates(token, gateTags) {
    const response = await fetch(`${API_URL}/api/gates/unlock`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ gateTags }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unlock gates');
    }

    return response.json();
  }

  async getUnlockedGates(token) {
    const response = await fetch(`${API_URL}/api/gates/unlocked`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get unlocked gates');
    }

    return response.json();
  }

  async removeGate(token, gateTag) {
    const response = await fetch(`${API_URL}/api/gates/${gateTag}`, {
      method: 'DELETE',
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove gate');
    }

    return response.json();
  }

  // ===== INVITE SYSTEM (PHASE 2) =====

  async sendInvite(token, method, recipientEmail, recipientPhone) {
    const body = { method };

    if (method === 'email') {
      body.recipientEmail = recipientEmail;
    } else if (method === 'sms') {
      body.recipientPhone = recipientPhone;
    }

    const response = await fetch(`${API_URL}/api/invites/send`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invite');
    }

    return response.json();
  }

  async sendReverseInvite(token, method, recipientEmail, recipientPhone) {
    const body = { method };

    if (method === 'email') {
      body.recipientEmail = recipientEmail;
    } else if (method === 'sms') {
      body.recipientPhone = recipientPhone;
    }

    const response = await fetch(`${API_URL}/api/invites/send-reverse`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invite');
    }

    return response.json();
  }

  async acceptInvite(token, inviteCode) {
    const response = await fetch(`${API_URL}/api/invites/accept`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ inviteCode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept invite');
    }

    return response.json();
  }

  async getMyViewers(token) {
    const response = await fetch(`${API_URL}/api/access/my-viewers`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      throw new Error('Failed to get viewers');
    }

    return response.json();
  }

  async toggleViewerAccess(token, grantId) {
    const response = await fetch(`${API_URL}/api/access/toggle/${grantId}`, {
      method: 'PUT',
      headers: getHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to toggle access');
    }

    return response.json();
  }

  async getMyOwners(token) {
    const response = await fetch(`${API_URL}/api/viewers/my-owners`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      throw new Error('Failed to load owners');
    }

    return response.json();
  }

  // Push Notification Methods
  async registerPushToken(token, deviceToken, deviceType) {
    const response = await fetch(`${API_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        deviceToken,
        deviceType,
        deviceId: deviceToken, // Using token as unique device ID
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register push token');
    }

    return response.json();
  }

  async unregisterPushToken(token, deviceToken) {
    const response = await fetch(`${API_URL}/api/notifications/unregister-token`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ deviceToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unregister push token');
    }

    return response.json();
  }

  async updateNotificationPreferences(token, preferences) {
    const response = await fetch(`${API_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update preferences');
    }

    return response.json();
  }

  async getNotificationPreferences(token) {
    const response = await fetch(`${API_URL}/api/notifications/preferences`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) {
      throw new Error('Failed to get notification preferences');
    }

    return response.json();
  }

  // ===== SUBSCRIPTIONS =====

  async getSubscriptionStatus(token) {
    const response = await fetch(`${API_URL}/api/subscriptions/status`, {
      headers: getHeaders(token, false),
    });

    if (!response.ok) throw new Error('Failed to get subscription status');
    return response.json();
  }

  async giftPremium(token, ownerId) {
    const response = await fetch(`${API_URL}/api/subscriptions/gift`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ ownerId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to gift premium');
    }
    return response.json();
  }

  // ===== AI FOLLOW-UP QUESTIONS =====

  async generateFollowUpQuestions(token, question, response) {
    const res = await fetch(`${API_URL}/api/prompts/generate-followups`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ question, response }),
    });

    if (!res.ok) {
      if (res.status === 403) return null; // Not premium
      throw new Error('Failed to generate follow-up questions');
    }
    return res.json();
  }

  // ===== SUPPORT =====

  async sendSupportMessage(token, subject, message) {
    const response = await fetch(`${API_URL}/api/support/contact`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ subject, message }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
  }
}

export default new ApiService();
