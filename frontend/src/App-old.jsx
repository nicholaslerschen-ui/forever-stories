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
  
  // Intake state
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
        apiCall('/api/profile'),
        apiCall('/api/test/stats')
      ]);

      if (profileData.profile) {
        setIntakeData(profileData.profile);
      }
      
      if (statsData.stats) {
        setStreak(statsData.stats.streak);
        setPoints(statsData.stats.points);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
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
    setIntakeData(prev => ({
      ...prev,
      [category]: prev[category].includes(item)
        ? prev[category].filter(i => i !== item)
        : [...prev[category], item]
    }));
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

  const sendPersonaMessage = () => {
    if (!personaInput.trim()) return;
    
    // Add user message
    setAiPersonaMessages(prev => [...prev, {
      role: 'user',
      content: personaInput
    }]);
    
    setLoading(true);
    
    // Simulate AI response based on intake data
    setTimeout(() => {
      const aiResponse = generatePersonaResponse(personaInput, intakeData);
      setAiPersonaMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse
      }]);
      setPersonaInput('');
      setLoading(false);
    }, 2000);
  };

  const generatePersonaResponse = (message, profile) => {
    // Simulate personalized response based on intake data
    const location = profile.birthLocation || "my hometown";
    const interests = profile.interests?.join(', ') || "various hobbies";
    const events = profile.lifeEvents || [];
    
    if (message.toLowerCase().includes('childhood') || message.toLowerCase().includes('grew up')) {
      return `Growing up in ${location} was such a formative experience for me. Those early years really shaped who I became. I was always interested in ${interests}, and that passion stayed with me throughout my life.`;
    }
    
    if (message.toLowerCase().includes('advice') || message.toLowerCase().includes('wisdom')) {
      return `You know, after ${events.includes('Had children') ? 'raising my children' : 'living through so many experiences'}, I've learned that the most important thing is to stay true to your values. Life has a way of testing you, but if you hold onto what matters most, you'll find your way.`;
    }
    
    if (message.toLowerCase().includes('family') || message.toLowerCase().includes('children')) {
      if (events.includes('Had children')) {
        return `My children are my greatest pride and joy. Being a parent taught me more about myself than anything else in life. It wasn't always easy, but watching them grow and become their own people - that's been the most rewarding journey.`;
      }
      return `Family has always been important to me. The bonds we share with the people we love are what make life meaningful. Whether it's the family we're born into or the family we choose, those connections define us.`;
    }
    
    // Default personalized response
    return `That's a thoughtful question. When I reflect on my life from ${location} to where I am now, I'm reminded of how much my interests in ${interests} have guided me. ${events.includes('Got married') ? "My marriage taught me the importance of partnership and communication." : ""} Every experience, good and challenging, has contributed to who I am today.`;
  };

  // Login/Register Screen
  if (!authToken) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdfbf7 0%, #f5ebe0 50%, #ede0d4 100%)',
        fontFamily: '"Newsreader", Georgia, serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '450px',
          width: '100%',
          background: 'white',
          borderRadius: '24px',
          padding: '3rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊️</div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '400',
              color: '#3e2723',
              marginBottom: '0.5rem'
            }}>
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p style={{ color: '#6d4c41', fontSize: '0.95rem' }}>
              {authMode === 'login' ? 'Continue your legacy' : 'Start preserving your memories'}
            </p>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              background: '#ffebee',
              border: '1px solid #ef5350',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              color: '#c62828',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleAuth}>
            {authMode === 'register' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  color: '#3e2723',
                  marginBottom: '0.5rem',
                  fontWeight: '500'
                }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={authForm.fullName}
                  onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                  required={authMode === 'register'}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    fontSize: '1rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: '12px',
                    fontFamily: '"Newsreader", Georgia, serif'
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
                fontWeight: '500'
              }}>
                Email
              </label>
              <input
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  fontFamily: '"Newsreader", Georgia, serif'
                }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
                fontWeight: '500'
              }}>
                Password
              </label>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  fontFamily: '"Newsreader", Georgia, serif'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: loading ? '#bdbdbd' : 'linear-gradient(135deg, #8d6e63 0%, #6d4c41 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: '"Newsreader", Georgia, serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <Loader size={18} className="spin" />
                  Processing...
                </>
              ) : (
                authMode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div style={{ 
            textAlign: 'center', 
            marginTop: '1.5rem',
            color: '#6d4c41',
            fontSize: '0.9rem'
          }}>
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#8d6e63',
                cursor: 'pointer',
                fontWeight: '600',
                textDecoration: 'underline',
                fontFamily: '"Newsreader", Georgia, serif'
              }}
            >
              {authMode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@300;400;500;600&display=swap');
          
          .spin {
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Welcome Screen
  if (currentView === 'welcome') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdfbf7 0%, #f5ebe0 50%, #ede0d4 100%)',
        fontFamily: '"Newsreader", Georgia, serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '600px',
          textAlign: 'center',
          animation: 'fadeInUp 0.8s ease-out'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            animation: 'float 3s ease-in-out infinite'
          }}>
            🕊️
          </div>
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: '300',
            color: '#3e2723',
            marginBottom: '1rem',
            letterSpacing: '-0.02em',
            lineHeight: '1.1'
          }}>
            Forever Stories
          </h1>
          <p style={{
            fontSize: '1.25rem',
            color: '#6d4c41',
            marginBottom: '3rem',
            lineHeight: '1.6',
            fontWeight: '300'
          }}>
            Preserve your wisdom, memories, and voice for the ones you love. 
            A living legacy that grows with every story you share.
          </p>
          <button
            onClick={() => setCurrentView('intake')}
            style={{
              background: 'linear-gradient(135deg, #8d6e63 0%, #6d4c41 100%)',
              color: 'white',
              border: 'none',
              padding: '1.25rem 3rem',
              fontSize: '1.1rem',
              borderRadius: '50px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontFamily: '"Newsreader", Georgia, serif',
              fontWeight: '500',
              boxShadow: '0 8px 24px rgba(109, 76, 65, 0.3)',
              transition: 'all 0.3s ease',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 12px 32px rgba(109, 76, 65, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 8px 24px rgba(109, 76, 65, 0.3)';
            }}
          >
            Begin Your Legacy
            <ArrowRight size={20} />
          </button>
        </div>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@300;400;500;600&display=swap');
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes float {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
        `}</style>
      </div>
    );
  }

  // Intake Form with AI Demonstration
  if (currentView === 'intake') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdfbf7 0%, #f5ebe0 100%)',
        fontFamily: '"Newsreader", Georgia, serif',
        padding: '3rem 2rem'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: '400',
              color: '#3e2723',
              marginBottom: '0.5rem'
            }}>
              Let's Get to Know You
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#6d4c41', fontWeight: '300' }}>
              These details help our AI personalize your experience
            </p>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '3rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '2rem'
          }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '1.1rem',
                color: '#3e2723',
                marginBottom: '0.75rem',
                fontWeight: '500'
              }}>
                When were you born?
              </label>
              <input
                type="date"
                value={intakeData.birthDate}
                onChange={(e) => setIntakeData({ ...intakeData, birthDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  fontFamily: '"Newsreader", Georgia, serif',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#8d6e63'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <div style={{ marginBottom: '2.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '1.1rem',
                color: '#3e2723',
                marginBottom: '0.75rem',
                fontWeight: '500'
              }}>
                Where were you born?
              </label>
              <input
                type="text"
                placeholder="City, State/Country"
                value={intakeData.birthLocation}
                onChange={(e) => setIntakeData({ ...intakeData, birthLocation: e.target.value })}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  fontFamily: '"Newsreader", Georgia, serif',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#8d6e63'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <div style={{ marginBottom: '2.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '1.1rem',
                color: '#3e2723',
                marginBottom: '1rem',
                fontWeight: '500'
              }}>
                Major life events you've experienced
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.75rem'
              }}>
                {lifeEvents.map(event => (
                  <button
                    key={event}
                    onClick={() => toggleSelection(event, 'lifeEvents')}
                    style={{
                      padding: '0.875rem 1rem',
                      border: intakeData.lifeEvents.includes(event) 
                        ? '2px solid #8d6e63' 
                        : '2px solid #e0e0e0',
                      background: intakeData.lifeEvents.includes(event) 
                        ? '#f5ebe0' 
                        : 'white',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontFamily: '"Newsreader", Georgia, serif',
                      color: intakeData.lifeEvents.includes(event) ? '#3e2723' : '#6d4c41',
                      transition: 'all 0.2s ease',
                      fontWeight: intakeData.lifeEvents.includes(event) ? '500' : '400'
                    }}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '1.1rem',
                color: '#3e2723',
                marginBottom: '1rem',
                fontWeight: '500'
              }}>
                Your interests and passions
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '0.75rem'
              }}>
                {interests.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleSelection(interest, 'interests')}
                    style={{
                      padding: '0.875rem 1rem',
                      border: intakeData.interests.includes(interest) 
                        ? '2px solid #8d6e63' 
                        : '2px solid #e0e0e0',
                      background: intakeData.interests.includes(interest) 
                        ? '#f5ebe0' 
                        : 'white',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontFamily: '"Newsreader", Georgia, serif',
                      color: intakeData.interests.includes(interest) ? '#3e2723' : '#6d4c41',
                      transition: 'all 0.2s ease',
                      fontWeight: intakeData.interests.includes(interest) ? '500' : '400'
                    }}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Personalization Preview */}
            {(intakeData.birthLocation || intakeData.lifeEvents.length > 0 || intakeData.interests.length > 0) && (
              <div style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                borderRadius: '16px',
                border: '2px solid #64b5f6'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <Sparkles size={24} style={{ color: '#1976d2' }} />
                  <strong style={{ fontSize: '1.1rem', color: '#1565c0' }}>
                    AI Personalization Preview
                  </strong>
                </div>
                <p style={{ color: '#0d47a1', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                  Based on your answers, our AI will create personalized prompts like:
                  <br/><br/>
                  {intakeData.birthLocation && (
                    <><em>"What do you remember most about growing up in {intakeData.birthLocation}?"</em><br/></>
                  )}
                  {intakeData.lifeEvents.includes('Had children') && (
                    <><em>"What's the most important lesson you want to pass on to your children?"</em><br/></>
                  )}
                  {intakeData.interests.includes('Woodworking') && (
                    <><em>"Tell me about a woodworking project that taught you something valuable about life."</em><br/></>
                  )}
                  {intakeData.lifeEvents.includes('Got married') && (
                    <><em>"What's one piece of advice about relationships you wish you'd known earlier?"</em></>
                  )}
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={() => {
                localStorage.removeItem('authToken');
                setAuthToken(null);
              }}
              style={{
                padding: '1rem 2rem',
                border: '2px solid #8d6e63',
                background: 'transparent',
                borderRadius: '50px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontFamily: '"Newsreader", Georgia, serif',
                color: '#8d6e63',
                fontWeight: '500'
              }}
            >
              Sign Out
            </button>
            <button
              onClick={saveIntake}
              disabled={loading || !intakeData.birthDate || !intakeData.birthLocation}
              style={{
                padding: '1rem 3rem',
                background: loading ? '#bdbdbd' : 'linear-gradient(135deg, #8d6e63 0%, #6d4c41 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                cursor: loading || !intakeData.birthDate || !intakeData.birthLocation ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontFamily: '"Newsreader", Georgia, serif',
                fontWeight: '500',
                boxShadow: '0 4px 16px rgba(109, 76, 65, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: !intakeData.birthDate || !intakeData.birthLocation ? 0.5 : 1
              }}
            >
              {loading ? (
                <>
                  <Loader size={18} className="spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AI Persona Chat Demo
  if (currentView === 'persona') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdfbf7 0%, #f5ebe0 100%)',
        fontFamily: '"Newsreader", Georgia, serif',
        padding: '2rem'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '2rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '2rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', color: '#3e2723', margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                  Chat with Your AI Persona
                </h2>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#6d4c41' }}>
                  See how the AI responds based on your intake answers
                </p>
              </div>
              <button
                onClick={() => setCurrentView('upload')}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '2px solid #8d6e63',
                  background: 'transparent',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontFamily: '"Newsreader", Georgia, serif',
                  color: '#8d6e63',
                  fontWeight: '500'
                }}
              >
                Back
              </button>
            </div>

            <div style={{
              padding: '1.5rem',
              background: '#fff3e0',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              border: '2px solid #ffb74d'
            }}>
              <strong style={{ color: '#e65100' }}>💡 Demo Mode:</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#ef6c00' }}>
                This AI persona is responding based on the profile you created:
                {intakeData.birthLocation && ` Born in ${intakeData.birthLocation}.`}
                {intakeData.interests.length > 0 && ` Interests: ${intakeData.interests.slice(0, 3).join(', ')}.`}
                {intakeData.lifeEvents.length > 0 && ` Life events: ${intakeData.lifeEvents.slice(0, 2).join(', ')}.`}
              </p>
            </div>

            <div style={{
              minHeight: '400px',
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '1.5rem',
              background: '#fafafa',
              borderRadius: '16px',
              marginBottom: '1.5rem'
            }}>
              {aiPersonaMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9e9e9e' }}>
                  <MessageCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>Start a conversation! Try asking about childhood, family, or advice.</p>
                  <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                    <strong>Suggested questions:</strong>
                    <div style={{ marginTop: '0.5rem' }}>
                      "Tell me about your childhood"<br/>
                      "What advice would you give me?"<br/>
                      "What are you most proud of?"
                    </div>
                  </div>
                </div>
              ) : (
                aiPersonaMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: '1rem',
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '70%',
                      padding: '1rem 1.25rem',
                      borderRadius: '16px',
                      background: msg.role === 'user' ? '#8d6e63' : 'white',
                      color: msg.role === 'user' ? 'white' : '#3e2723',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      fontSize: '0.95rem',
                      lineHeight: '1.6'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              
              {loading && (
                <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <input
                type="text"
                value={personaInput}
                onChange={(e) => setPersonaInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendPersonaMessage()}
                placeholder="Ask me anything..."
                style={{
                  flex: 1,
                  padding: '1rem',
                  fontSize: '1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  fontFamily: '"Newsreader", Georgia, serif'
                }}
              />
              <button
                onClick={sendPersonaMessage}
                disabled={!personaInput.trim() || loading}
                style={{
                  padding: '1rem 2rem',
                  background: !personaInput.trim() || loading ? '#bdbdbd' : 'linear-gradient(135deg, #8d6e63 0%, #6d4c41 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: !personaInput.trim() || loading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontFamily: '"Newsreader", Georgia, serif',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Send size={18} />
                Send
              </button>
            </div>
          </div>
        </div>

        <style>{`
          .typing-dot {
            width: 8px;
            height: 8px;
            background: #8d6e63;
            border-radius: 50%;
            animation: typing 1.4s infinite;
          }
          
          .typing-dot:nth-child(2) {
            animation-delay: 0.2s;
          }
          
          .typing-dot:nth-child(3) {
            animation-delay: 0.4s;
          }
          
          @keyframes typing {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.7;
            }
            30% {
              transform: translateY(-10px);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  // Upload screen with link to persona demo
  if (currentView === 'upload') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fdfbf7 0%, #f5ebe0 100%)',
        fontFamily: '"Newsreader", Georgia, serif',
        padding: '3rem 2rem'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: '400',
              color: '#3e2723',
              marginBottom: '0.5rem'
            }}>
              You're All Set!
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#6d4c41', fontWeight: '300' }}>
              Your profile has been saved. Try the AI persona demo below.
            </p>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '3rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            <Sparkles size={64} style={{ color: '#8d6e63', marginBottom: '1.5rem' }} />
            
            <h3 style={{ fontSize: '1.75rem', color: '#3e2723', marginBottom: '1rem' }}>
              Your AI Persona is Ready!
            </h3>
            
            <p style={{ fontSize: '1.1rem', color: '#6d4c41', marginBottom: '2rem', lineHeight: '1.6' }}>
              Based on your profile, we've created an AI that can respond in a personalized way.
              The more you share through daily prompts and uploaded memories, the more authentic it becomes.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                padding: '1.5rem',
                background: '#f5ebe0',
                borderRadius: '16px',
                textAlign: 'left'
              }}>
                <strong style={{ fontSize: '1.1rem', color: '#3e2723', display: 'block', marginBottom: '0.75rem' }}>
                  Your Profile:
                </strong>
                <div style={{ fontSize: '0.95rem', color: '#6d4c41', lineHeight: '1.8' }}>
                  📍 {intakeData.birthLocation || 'Not specified'}<br/>
                  📅 Born: {intakeData.birthDate || 'Not specified'}<br/>
                  ⭐ {intakeData.interests.length} interests<br/>
                  📖 {intakeData.lifeEvents.length} life events
                </div>
              </div>

              <div style={{
                padding: '1.5rem',
                background: '#e3f2fd',
                borderRadius: '16px',
                textAlign: 'left'
              }}>
                <strong style={{ fontSize: '1.1rem', color: '#1565c0', display: 'block', marginBottom: '0.75rem' }}>
                  AI Capabilities:
                </strong>
                <div style={{ fontSize: '0.95rem', color: '#0d47a1', lineHeight: '1.8' }}>
                  🤖 Personalized responses<br/>
                  💭 Context-aware conversations<br/>
                  📚 References your memories<br/>
                  ❤️ Reflects your values
                </div>
              </div>
            </div>

            <button
              onClick={() => setCurrentView('persona')}
              style={{
                padding: '1.25rem 3rem',
                background: 'linear-gradient(135deg, #8d6e63 0%, #6d4c41 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontFamily: '"Newsreader", Georgia, serif',
                fontWeight: '500',
                boxShadow: '0 4px 16px rgba(109, 76, 65, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              Try AI Persona Demo
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
