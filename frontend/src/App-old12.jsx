import React, { useState, useEffect } from 'react';
import { Heart, BookOpen, MessageCircle, Camera, Mail, FileText, ChevronRight, Sparkles, Lock, Trophy, Flame, ArrowRight, Loader, Send, Check, Clock } from 'lucide-react';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function LegacyApp() {
  const [currentView, setCurrentView] = useState('welcome');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Auth state
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  
  // Intake state
  const [intakeData, setIntakeData] = useState({
    birthDate: '',
    birthLocation: '',
    lifeEvents: [],
    interests: []
  });
  
  // Daily prompts state
  const [todayPrompt, setTodayPrompt] = useState(null);
  const [promptResponse, setPromptResponse] = useState('');
  const [promptAnswered, setPromptAnswered] = useState(false);
  const [isAnsweringBonus, setIsAnsweringBonus] = useState(false);
  const [responseId, setResponseId] = useState(null);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [currentFollowUpIndex, setCurrentFollowUpIndex] = useState(0);
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [userStats, setUserStats] = useState({
    totalResponses: 0,
    currentStreak: 0,
    totalPoints: 0
  });
  
  // Free-write story state
  const [freeWriteTitle, setFreeWriteTitle] = useState('');
  const [freeWriteStory, setFreeWriteStory] = useState('');
  
  // Past stories state
  const [pastStories, setPastStories] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  
  // App state
  const [aiPersonaMessages, setAiPersonaMessages] = useState([]);
  const [personaInput, setPersonaInput] = useState('');

  const lifeEvents = [
    'Had children', 'Got married', 'Changed careers', 'Major move',
    'Started a business', 'Lost a loved one', 'Traveled abroad',
    'Went to college', 'Served in military', 'Bought a home'
  ];

  const interests = [
    'Sports', 'Reading', 'Woodworking', 'Business', 'Cooking',
    'Gardening', 'Music', 'Art', 'Technology', 'Travel',
    'Photography', 'Writing'
  ];

  // Load user data on mount
  useEffect(() => {
    if (authToken) {
      loadUserData();
      loadTodayPrompt();
      loadUserStats();
    }
  }, [authToken]);

  // Helper function to format date for HTML date input
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      // Convert to YYYY-MM-DD format
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // API Functions
  const apiCall = async (endpoint, options = {}) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      };

      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(authForm)
      });

      setAuthToken(data.token);
      localStorage.setItem('authToken', data.token);
      setUser(data.user);
      
      // Check if user has completed profile
      const profileData = await apiCall('/api/profile', {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      
      if (profileData?.profile && profileData.profile.birth_date) {
        // Profile exists - go to dashboard
        setIntakeData({
          birthDate: formatDateForInput(profileData.profile.birth_date),
          birthLocation: profileData.profile.birth_location || '',
          lifeEvents: Array.isArray(profileData.profile.life_events) ? profileData.profile.life_events : [],
          interests: Array.isArray(profileData.profile.interests) ? profileData.profile.interests : []
        });
        await loadUserStats();
        await loadTodayPrompt();
        setCurrentView('dashboard');
      } else {
        // No profile - go to intake form
        setCurrentView('intake');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      const profileData = await apiCall('/api/profile').catch(() => ({ profile: null }));

      if (profileData?.profile) {
        setIntakeData({
          birthDate: formatDateForInput(profileData.profile.birth_date),
          birthLocation: profileData.profile.birth_location || '',
          lifeEvents: Array.isArray(profileData.profile.life_events) ? profileData.profile.life_events : [],
          interests: Array.isArray(profileData.profile.interests) ? profileData.profile.interests : []
        });
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const loadTodayPrompt = async (getNext = false) => {
    try {
      const endpoint = getNext ? '/api/prompts/next' : '/api/prompts/today';
      const data = await apiCall(endpoint);
      
      if (data.answered && !getNext) {
        setPromptAnswered(true);
        setPromptResponse(data.response.response_text || data.response.response || '');
      } else if (data.allComplete) {
        // All prompts completed
        setTodayPrompt({
          id: null,
          question: "Amazing! You've answered all available prompts. Check back later for new questions!",
          category: "complete"
        });
      } else {
        setPromptAnswered(false);
        setTodayPrompt(data.prompt);
      }
    } catch (err) {
      console.error('Error loading prompt:', err);
    }
  };

  const loadUserStats = async () => {
    try {
      const data = await apiCall('/api/user/stats');
      setUserStats(data.stats);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const saveIntake = async () => {
    setLoading(true);
    setError(null);

    try {
      // Automatically detect user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      await apiCall('/api/profile/intake', {
        method: 'POST',
        body: JSON.stringify({
          ...intakeData,
          timezone: userTimezone
        })
      });

      setCurrentView('daily-prompt');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitPromptResponse = async () => {
    if (!promptResponse.trim()) return;
    
    setLoading(true);

    try {
      const data = await apiCall('/api/prompts/respond', {
        method: 'POST',
        body: JSON.stringify({
          promptId: todayPrompt?.id,
          response: promptResponse,
          isBonus: isAnsweringBonus
        })
      });

      setResponseId(data.responseId);
      setUserStats(prev => ({
        ...prev,
        totalResponses: prev.totalResponses + 1,
        currentStreak: data.streak,
        totalPoints: prev.totalPoints + data.pointsEarned
      }));
      
      // Generate follow-up questions
      const followUpData = await apiCall('/api/prompts/generate-followups', {
        method: 'POST',
        body: JSON.stringify({
          question: todayPrompt?.question,
          response: promptResponse
        })
      });

      if (followUpData.followUpQuestions && followUpData.followUpQuestions.length > 0) {
        setFollowUpQuestions(followUpData.followUpQuestions);
        setShowFollowUps(true);
        setCurrentFollowUpIndex(0);
      } else {
        // No follow-ups, mark as answered
        setPromptAnswered(true);
        setTimeout(() => {
          setCurrentView('dashboard');
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitFollowUpResponse = async () => {
    if (!followUpResponse.trim()) return;
    
    setLoading(true);

    try {
      await apiCall('/api/prompts/respond', {
        method: 'POST',
        body: JSON.stringify({
          promptId: todayPrompt?.id,
          response: `Follow-up: ${followUpQuestions[currentFollowUpIndex]}\nAnswer: ${followUpResponse}`,
          isFollowUp: true,
          parentResponseId: responseId
        })
      });

      setUserStats(prev => ({
        ...prev,
        totalPoints: prev.totalPoints + 25
      }));

      // Clear follow-up response
      setFollowUpResponse('');

      // Move to next follow-up or finish
      if (currentFollowUpIndex < followUpQuestions.length - 1) {
        setCurrentFollowUpIndex(currentFollowUpIndex + 1);
      } else {
        // All follow-ups done
        setPromptAnswered(true);
        setShowFollowUps(false);
        setTimeout(() => {
          setCurrentView('dashboard');
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const skipFollowUps = () => {
    setPromptAnswered(true);
    setShowFollowUps(false);
    setTimeout(() => {
      setCurrentView('dashboard');
    }, 2000);
  };

  const loadPastStories = async () => {
    try {
      const data = await apiCall('/api/prompts/history');
      setPastStories(data.responses || []);
    } catch (err) {
      console.error('Error loading past stories:', err);
    }
  };

  const submitFreeWrite = async () => {
    if (!freeWriteStory.trim()) return;
    
    setLoading(true);

    try {
      await apiCall('/api/prompts/respond', {
        method: 'POST',
        body: JSON.stringify({
          promptId: null,
          response: freeWriteStory,
          isFreeWrite: true,
          title: freeWriteTitle || 'My Story'
        })
      });

      setUserStats(prev => ({
        ...prev,
        totalResponses: prev.totalResponses + 1,
        totalPoints: prev.totalPoints + 50
      }));

      // Clear form and go to dashboard
      setFreeWriteTitle('');
      setFreeWriteStory('');
      setTimeout(() => {
        setCurrentView('dashboard');
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (item, category) => {
    setIntakeData(prev => {
      const currentArray = Array.isArray(prev[category]) ? prev[category] : [];
      
      return {
        ...prev,
        [category]: currentArray.includes(item)
          ? currentArray.filter(i => i !== item)
          : [...currentArray, item]
      };
    });
  };

  const sendPersonaMessage = async () => {
    if (!personaInput.trim()) return;

    const userMessage = { role: 'user', content: personaInput };
    setAiPersonaMessages(prev => [...prev, userMessage]);
    setPersonaInput('');
    setLoading(true);

    try {
      const response = await apiCall('/api/ai/persona', {
        method: 'POST',
        body: JSON.stringify({
          message: personaInput,
          profile: intakeData,
          history: aiPersonaMessages
        })
      });

      const aiMessage = { role: 'assistant', content: response.message };
      setAiPersonaMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('AI Persona error:', err);
      const fallbackMessage = {
        role: 'assistant',
        content: `That's interesting! Tell me more about ${intakeData.birthLocation ? `growing up in ${intakeData.birthLocation}` : 'your experiences'}.`
      };
      setAiPersonaMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    localStorage.removeItem('authToken');
    setUser(null);
    setCurrentView('welcome');
    setIntakeData({
      birthDate: '',
      birthLocation: '',
      lifeEvents: [],
      interests: []
    });
  };

  // Render functions
  const renderWelcome = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <Heart className="w-24 h-24 text-rose-500 fill-rose-500" />
            <Sparkles className="w-8 h-8 text-amber-400 absolute -top-2 -right-2 animate-pulse" />
          </div>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Forever <span className="text-rose-600">Stories</span>
        </h1>
        
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Preserve your memories, wisdom, and legacy for future generations with AI-powered storytelling
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: BookOpen, title: "Daily Prompts", desc: "Answer personalized questions" },
            { icon: Camera, title: "Rich Media", desc: "Add photos, videos & documents" },
            { icon: Heart, title: "AI Legacy", desc: "Create an interactive AI version of yourself" }
          ].map((feature, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <feature.icon className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setCurrentView('auth')}
          className="bg-rose-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-rose-700 transition-colors inline-flex items-center gap-2 shadow-lg hover:shadow-xl"
        >
          Start Your Legacy <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderAuth = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Heart className="w-16 h-16 text-rose-500 fill-rose-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900">
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-600 mt-2">
            {authMode === 'login' ? 'Continue your legacy' : 'Start preserving your story'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={authForm.fullName}
                onChange={(e) => setAuthForm(prev => ({ ...prev, fullName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                required={authMode === 'register'}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rose-600 text-white py-3 rounded-lg font-semibold hover:bg-rose-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              authMode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-rose-600 hover:text-rose-700 text-sm font-medium"
          >
            {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderIntake = () => {
    const hasSelections = (
      (Array.isArray(intakeData.lifeEvents) && intakeData.lifeEvents.length > 0) || 
      (Array.isArray(intakeData.interests) && intakeData.interests.length > 0)
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Tell Us About Yourself</h2>
            <p className="text-gray-600 mb-8">This helps us personalize your experience and create meaningful prompts</p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birth Date
                </label>
                <input
                  type="date"
                  value={intakeData.birthDate}
                  onChange={(e) => setIntakeData(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birth Location (City, State/Country)
                </label>
                <input
                  type="text"
                  value={intakeData.birthLocation}
                  onChange={(e) => setIntakeData(prev => ({ ...prev, birthLocation: e.target.value }))}
                  placeholder="e.g., Chicago, Illinois"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Life Events
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {lifeEvents.map(event => (
                    <button
                      key={event}
                      type="button"
                      onClick={() => toggleSelection(event, 'lifeEvents')}
                      className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                        (Array.isArray(intakeData.lifeEvents) && intakeData.lifeEvents.includes(event))
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-gray-200 hover:border-rose-300'
                      }`}
                    >
                      {event}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Your Interests
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {interests.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleSelection(interest, 'interests')}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        (Array.isArray(intakeData.interests) && intakeData.interests.includes(interest))
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-gray-200 hover:border-rose-300'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              {hasSelections && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-2">AI Personalization Preview</h4>
                      <p className="text-blue-800 text-sm mb-3">
                        Based on your selections, here are examples of personalized prompts you'll receive:
                      </p>
                      <div className="space-y-2">
                        {intakeData.birthLocation && (
                          <p className="text-sm text-blue-700 italic">
                            "What do you remember most about growing up in {intakeData.birthLocation}?"
                          </p>
                        )}
                        {Array.isArray(intakeData.interests) && intakeData.interests[0] && (
                          <p className="text-sm text-blue-700 italic">
                            "Tell me about a {intakeData.interests[0].toLowerCase()} experience that taught you something valuable about life."
                          </p>
                        )}
                        {Array.isArray(intakeData.lifeEvents) && intakeData.lifeEvents[0] && (
                          <p className="text-sm text-blue-700 italic">
                            "How did {intakeData.lifeEvents[0].toLowerCase()} change your perspective on what matters most?"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={saveIntake}
                disabled={loading || !intakeData.birthDate || !intakeData.birthLocation}
                className="w-full bg-rose-600 text-white py-4 rounded-lg font-semibold hover:bg-rose-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDailyPrompt = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Stats Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-2xl font-bold text-gray-900">{userStats.currentStreak}</span>
              </div>
              <p className="text-sm text-gray-600">Day Streak</p>
            </div>
            <div className="w-px h-12 bg-gray-200"></div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span className="text-2xl font-bold text-gray-900">{userStats.totalPoints}</span>
              </div>
              <p className="text-sm text-gray-600">Points</p>
            </div>
            <div className="w-px h-12 bg-gray-200"></div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-rose-500" />
                <span className="text-2xl font-bold text-gray-900">{userStats.totalResponses}</span>
              </div>
              <p className="text-sm text-gray-600">Stories</p>
            </div>
          </div>
        </div>

        {/* Today's Prompt */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`bg-gradient-to-br ${isAnsweringBonus ? 'from-purple-500 to-pink-500' : 'from-rose-500 to-orange-500'} p-3 rounded-xl`}>
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {isAnsweringBonus ? 'Bonus Prompt' : "Today's Prompt"}
                  {isAnsweringBonus && (
                    <span className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                      Extra Story!
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-gray-600 hover:text-gray-900 text-sm underline"
            >
              Logout
            </button>
          </div>

          {!promptAnswered && !showFollowUps ? (
            <>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
                <p className="text-xl text-gray-800 leading-relaxed">
                  {todayPrompt?.question || 'Loading your personalized prompt...'}
                </p>
                {todayPrompt?.category && (
                  <div className="mt-4">
                    <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      {todayPrompt.category}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Your Response
                </label>
                <textarea
                  value={promptResponse}
                  onChange={(e) => setPromptResponse(e.target.value)}
                  placeholder="Share your story here... Take your time and write as much or as little as you'd like."
                  rows={8}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {promptResponse.length} characters
                  </p>
                  <button
                    onClick={submitPromptResponse}
                    disabled={loading || !promptResponse.trim()}
                    className="bg-gradient-to-r from-rose-600 to-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-rose-700 hover:to-orange-600 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Submit Response
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : showFollowUps ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Check className="w-6 h-6 text-green-600" />
                  <p className="font-semibold text-green-900">Great start! Let's dive deeper...</p>
                </div>
                <p className="text-sm text-green-700">
                  Answer these optional follow-up questions to make your story even richer. You'll earn 25 points for each!
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-purple-600">
                    Follow-up {currentFollowUpIndex + 1} of {followUpQuestions.length}
                  </span>
                  <button
                    onClick={skipFollowUps}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Skip all
                  </button>
                </div>
                <p className="text-xl text-gray-800 leading-relaxed mb-4">
                  {followUpQuestions[currentFollowUpIndex]}
                </p>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Your Answer (Optional)
                </label>
                <textarea
                  value={followUpResponse}
                  onChange={(e) => setFollowUpResponse(e.target.value)}
                  placeholder="Share more details about your story..."
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {followUpResponse.length} characters
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setFollowUpResponse('');
                        if (currentFollowUpIndex < followUpQuestions.length - 1) {
                          setCurrentFollowUpIndex(currentFollowUpIndex + 1);
                        } else {
                          skipFollowUps();
                        }
                      }}
                      className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                    >
                      Skip This One
                    </button>
                    <button
                      onClick={submitFollowUpResponse}
                      disabled={loading || !followUpResponse.trim()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                    >
                      {loading ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          {currentFollowUpIndex < followUpQuestions.length - 1 ? 'Next Question' : 'Finish'}
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h3>
              <p className="text-gray-600 mb-6">
                Response saved! Keep sharing your stories to build your legacy.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={async () => {
                    setPromptAnswered(false);
                    setPromptResponse('');
                    setShowFollowUps(false);
                    setFollowUpQuestions([]);
                    setFollowUpResponse('');
                    setIsAnsweringBonus(true); // Mark as bonus prompt
                    await loadTodayPrompt(true); // Get next prompt
                  }}
                  className="bg-gradient-to-r from-rose-600 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-rose-700 hover:to-orange-600 transition-all flex items-center gap-2"
                >
                  <BookOpen className="w-5 h-5" />
                  Answer Another Prompt
                </button>
                <button
                  onClick={() => setCurrentView('ai-persona')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Talk to My AI Persona
                </button>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="bg-white border-2 border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:border-gray-300 transition-all"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}! 👋
              </h1>
              <p className="text-gray-600">
                Your legacy is taking shape. Keep sharing your stories!
              </p>
            </div>
            <button
              onClick={logout}
              className="text-gray-600 hover:text-gray-900 text-sm underline"
            >
              Logout
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{userStats.currentStreak}</p>
                  <p className="text-sm text-gray-600">Day Streak 🔥</p>
                </div>
                <Flame className="w-12 h-12 text-orange-500 opacity-50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{userStats.totalPoints}</p>
                  <p className="text-sm text-gray-600">Total Points 🏆</p>
                </div>
                <Trophy className="w-12 h-12 text-amber-500 opacity-50" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{userStats.totalResponses}</p>
                  <p className="text-sm text-gray-600">Stories Written 📖</p>
                </div>
                <BookOpen className="w-12 h-12 text-rose-500 opacity-50" />
              </div>
            </div>
          </div>
        </div>

        {/* Today's Prompt Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-rose-500" />
            Today's Prompt
          </h2>
          
          {!promptAnswered ? (
            <div>
              <p className="text-gray-600 mb-4">
                Share your story and earn 50 points!
              </p>
              <button
                onClick={() => {
                  setIsAnsweringBonus(false); // Reset to daily prompt mode
                  loadTodayPrompt();
                  setCurrentView('daily-prompt');
                }}
                className="w-full bg-gradient-to-r from-rose-600 to-orange-500 text-white py-4 rounded-xl font-semibold hover:from-rose-700 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <BookOpen className="w-5 h-5" />
                Answer Today's Prompt
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Check className="w-6 h-6 text-green-600" />
                  <p className="font-semibold text-green-900">Completed for today!</p>
                </div>
                <p className="text-sm text-green-700">
                  Come back tomorrow for a new question. Keep your streak alive!
                </p>
              </div>
              
              <button
                onClick={() => {
                  setIsAnsweringBonus(true);
                  loadTodayPrompt(true);
                  setCurrentView('daily-prompt');
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <BookOpen className="w-5 h-5" />
                Answer a Bonus Prompt
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-3 rounded-xl">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Write a Story</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Write your own story without a prompt. Share anything you'd like!
            </p>
            <button
              onClick={() => setCurrentView('free-write')}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Start Writing
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-br from-orange-100 to-red-100 p-3 rounded-xl">
                <BookOpen className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">My Stories</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              View all your past stories and add more details to them.
            </p>
            <button
              onClick={() => {
                loadPastStories();
                setCurrentView('my-stories');
              }}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              View Stories ({userStats.totalResponses})
            </button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-3 rounded-xl">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Your AI Persona</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Chat with an AI trained on YOUR stories. Ask it about your memories!
            </p>
            <button
              onClick={() => setCurrentView('ai-persona')}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Chat with AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFreeWrite = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Write Your Own Story</h2>
              <p className="text-gray-600 mt-2">Share any memory, experience, or story you'd like to preserve</p>
            </div>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="text-gray-600 hover:text-gray-900 text-sm underline"
            >
              Back
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Story Title (Optional)
              </label>
              <input
                type="text"
                value={freeWriteTitle}
                onChange={(e) => setFreeWriteTitle(e.target.value)}
                placeholder="e.g., My First Car, Family Vacation 1985"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Story
              </label>
              <textarea
                value={freeWriteStory}
                onChange={(e) => setFreeWriteStory(e.target.value)}
                placeholder="Write your story here... Take your time and share as much detail as you'd like."
                rows={15}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {freeWriteStory.length} characters
              </p>
              <button
                onClick={submitFreeWrite}
                disabled={loading || !freeWriteStory.trim()}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Story
                    <Check className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMyStories = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">My Stories</h2>
              <p className="text-gray-600 mt-2">All your memories and stories in one place</p>
            </div>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="text-gray-600 hover:text-gray-900 text-sm underline"
            >
              Back
            </button>
          </div>

          {pastStories.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">You haven't written any stories yet!</p>
              <button
                onClick={() => setCurrentView('daily-prompt')}
                className="bg-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-rose-700 transition-all"
              >
                Answer Your First Prompt
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {pastStories.map((story, index) => (
                <div key={story.id || index} className="border-2 border-gray-200 rounded-xl p-6 hover:border-rose-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {story.question || story.prompt_text || 'My Story'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(story.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                        {story.response_type && story.response_type !== 'text' && (
                          <span className="ml-2 inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs">
                            {story.response_type}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap line-clamp-3">
                    {story.response_text}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedStory(story);
                      setCurrentView('story-detail');
                    }}
                    className="mt-4 text-rose-600 hover:text-rose-700 font-medium text-sm flex items-center gap-1"
                  >
                    Read More & Add Details
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStoryDetail = () => {
    if (!selectedStory) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedStory.question || selectedStory.prompt_text || 'My Story'}
              </h2>
              <button
                onClick={() => {
                  setSelectedStory(null);
                  setCurrentView('my-stories');
                }}
                className="text-gray-600 hover:text-gray-900 text-sm underline"
              >
                Back to Stories
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-4">
                Written on {new Date(selectedStory.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <div className="bg-gray-50 rounded-xl p-6">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selectedStory.response_text}
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add More Details</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Want to expand on this story? Add more details, context, or related memories below.
              </p>
              <textarea
                value={followUpResponse}
                onChange={(e) => setFollowUpResponse(e.target.value)}
                placeholder="Add more to your story..."
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none mb-4"
              />
              <button
                onClick={async () => {
                  if (!followUpResponse.trim()) return;
                  setLoading(true);
                  try {
                    await apiCall('/api/prompts/respond', {
                      method: 'POST',
                      body: JSON.stringify({
                        promptId: selectedStory.prompt_id,
                        response: `--- Additional details added ---\n${followUpResponse}`,
                        isFollowUp: true,
                        parentResponseId: selectedStory.id
                      })
                    });
                    setFollowUpResponse('');
                    await loadPastStories();
                    setCurrentView('my-stories');
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !followUpResponse.trim()}
                className="bg-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-rose-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Add to Story
                    <Check className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAIPersona = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-rose-600 to-orange-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="w-6 h-6" />
                  Your AI Persona
                </h2>
                <p className="text-rose-100 text-sm mt-1">
                  An AI trained on YOUR stories that speaks AS you - try asking it about your memories!
                </p>
              </div>
              <button
                onClick={() => setCurrentView('dashboard')}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Back
              </button>
            </div>
          </div>

          <div className="h-96 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {aiPersonaMessages.length === 0 && (
              <div className="text-center text-gray-500 mt-12">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-rose-400" />
                <p className="font-semibold text-gray-700 mb-2">This is YOUR digital twin!</p>
                <p className="text-sm">Ask me about your childhood, your stories, or anything you've shared.</p>
                <p className="text-sm mt-2 italic">Example: "Tell me about growing up in {intakeData.birthLocation || 'your hometown'}"</p>
                <p className="text-xs mt-3 text-gray-400">The more prompts you answer, the smarter I become!</p>
              </div>
            )}

            {aiPersonaMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gradient-to-br from-rose-50 to-orange-50 border-2 border-rose-200 text-gray-800'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border-2 border-gray-200 rounded-2xl px-4 py-3">
                  <Loader className="w-5 h-5 text-rose-600 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={personaInput}
                onChange={(e) => setPersonaInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendPersonaMessage()}
                placeholder="Ask me about my life, memories, or experiences..."
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={sendPersonaMessage}
                disabled={loading || !personaInput.trim()}
                className="bg-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="font-sans">
      {currentView === 'welcome' && renderWelcome()}
      {currentView === 'auth' && renderAuth()}
      {currentView === 'intake' && renderIntake()}
      {currentView === 'daily-prompt' && renderDailyPrompt()}
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'free-write' && renderFreeWrite()}
      {currentView === 'my-stories' && renderMyStories()}
      {currentView === 'story-detail' && renderStoryDetail()}
      {currentView === 'ai-persona' && renderAIPersona()}
    </div>
  );
}
