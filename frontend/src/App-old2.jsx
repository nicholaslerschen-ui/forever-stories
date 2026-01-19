import React, { useState, useEffect } from 'react';
import { Heart, Upload, MessageCircle, Camera, Mail, FileText, ChevronRight, Sparkles, Lock, Trophy, Flame, ArrowRight, Loader, Send } from 'lucide-react';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function LegacyApp() {
  const [currentView, setCurrentView] = useState('welcome');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Auth state
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  
  // Intake state with proper initialization
  const [intakeData, setIntakeData] = useState({
    birthDate: '',
    birthLocation: '',
    lifeEvents: [],
    interests: []
  });
  
  // App state
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [prompts, setPrompts] = useState([]);
  const [response, setResponse] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
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
    }
  }, [authToken]);

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
      setCurrentView('intake');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      const [profileData, statsData] = await Promise.all([
        apiCall('/api/profile').catch(() => ({ profile: null })),
        apiCall('/api/test/stats').catch(() => ({ stats: null }))
      ]);

      if (profileData?.profile) {
        // Ensure arrays exist with proper defaults
        setIntakeData({
          birthDate: profileData.profile.birth_date || '',
          birthLocation: profileData.profile.birth_location || '',
          lifeEvents: Array.isArray(profileData.profile.life_events) ? profileData.profile.life_events : [],
          interests: Array.isArray(profileData.profile.interests) ? profileData.profile.interests : []
        });
      }
      
      if (statsData?.stats) {
        setStreak(statsData.stats.streak || 0);
        setPoints(statsData.stats.points || 0);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      // Silent fail - app will work with empty data
    }
  };

  const saveIntake = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiCall('/api/profile/intake', {
        method: 'POST',
        body: JSON.stringify(intakeData)
      });

      // Load personalized prompts
      await loadPrompts();
      setCurrentView('upload');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      const data = await apiCall('/api/test/prompts');
      setPrompts(data.prompts || []);
    } catch (err) {
      console.error('Error loading prompts:', err);
      // Set default prompts if API fails
      setPrompts([
        {
          id: 1,
          title: "A Defining Moment",
          question: "What moment in your life changed who you are as a person?",
          type: "reflective"
        },
        {
          id: 2,
          title: "Childhood Memory",
          question: "What is your earliest memory?",
          type: "nostalgic"
        }
      ]);
    }
  };

  const toggleSelection = (item, category) => {
    setIntakeData(prev => {
      // Ensure the array exists before using includes
      const currentArray = Array.isArray(prev[category]) ? prev[category] : [];
      
      return {
        ...prev,
        [category]: currentArray.includes(item)
          ? currentArray.filter(i => i !== item)
          : [...currentArray, item]
      };
    });
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({ name: f.name, type: f.type }))]);
  };

  const submitResponse = async () => {
    if (!response.trim()) return;
    
    setLoading(true);
    
    // Simulate AI processing with delay
    setTimeout(() => {
      setPoints(prev => prev + 50);
      setFollowUpQuestion("That's a wonderful memory. Can you tell me more about how that experience shaped your values today?");
      setShowFollowUp(true);
      setLoading(false);
    }, 1500);
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

  // Render functions for each view
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
            { icon: MessageCircle, title: "Daily Prompts", desc: "Answer personalized questions" },
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
    // Safely check if arrays exist and have items
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

  const renderUpload = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">You're All Set!</h2>
              <p className="text-gray-600 mt-2">Here's a summary of your profile</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-600 hover:text-gray-900 text-sm underline"
            >
              Logout
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-rose-50 rounded-xl p-6">
              <h3 className="font-semibold text-rose-900 mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Your Profile
              </h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Born:</span> {intakeData.birthDate || 'Not specified'}</p>
                <p><span className="font-medium">Location:</span> {intakeData.birthLocation || 'Not specified'}</p>
                <p><span className="font-medium">Life Events:</span> {Array.isArray(intakeData.lifeEvents) && intakeData.lifeEvents.length > 0 ? intakeData.lifeEvents.length : 0} selected</p>
                <p><span className="font-medium">Interests:</span> {Array.isArray(intakeData.interests) && intakeData.interests.length > 0 ? intakeData.interests.length : 0} selected</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Capabilities
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Personalized daily prompts based on your profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>AI follow-up questions that dig deeper into your stories</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Interactive AI persona trained on your memories</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('ai-persona')}
            className="w-full bg-gradient-to-r from-rose-600 to-orange-500 text-white py-4 rounded-xl font-semibold hover:from-rose-700 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Sparkles className="w-5 h-5" />
            Try AI Persona Demo
          </button>
        </div>
      </div>
    </div>
  );

  const renderAIPersona = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-rose-600 to-orange-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="w-6 h-6" />
                  AI Persona Chat
                </h2>
                <p className="text-rose-100 text-sm mt-1">
                  Chat with an AI that knows your profile and helps you document your story
                </p>
              </div>
              <button
                onClick={() => setCurrentView('upload')}
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
                <p>Start a conversation! I'm here to help you tell your story.</p>
                <p className="text-sm mt-2">I know about your background in {intakeData.birthLocation || 'your area'} and your interests.</p>
              </div>
            )}

            {aiPersonaMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-rose-600 text-white' 
                    : 'bg-white border-2 border-gray-200 text-gray-800'
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
                placeholder="Type your message..."
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
      {currentView === 'upload' && renderUpload()}
      {currentView === 'ai-persona' && renderAIPersona()}
    </div>
  );
}
