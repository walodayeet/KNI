'use client';

import { useState, useEffect } from 'react';
import { GiftIcon, CheckCircleIcon, XCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface UserProfile {
  id: string;
  subscription_type: 'free' | 'premium';
}

export default function ActivateCoursePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  useEffect(() => {
    // Mock user data for demo purposes
    const mockUser = {
      id: 'demo-user-123',
      subscription_type: 'free' as const
    };
    
    setUserProfile(mockUser);
    setLoading(false);
  }, []);

  const handleActivation = async () => {
    if (!activationCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid activation code.' });
      return;
    }

    setActivating(true);
    setMessage({ type: null, text: '' });

    try {
      // Simulate activation process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo purposes, accept any code that starts with 'PREMIUM'
      if (activationCode.toUpperCase().startsWith('PREMIUM')) {
        // Mock update user subscription
        setUserProfile(prev => prev ? { ...prev, subscription_type: 'premium' } : null);
        setMessage({ type: 'success', text: 'Congratulations! Your premium course has been activated successfully!' });
        setActivationCode('');
      } else {
        setMessage({ type: 'error', text: 'Invalid activation code. Please check your code and try again.' });
      }
    } catch (error) {
      console.error('Activation error:', error);
      setMessage({ type: 'error', text: 'An error occurred during activation. Please try again.' });
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <GiftIcon className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Activate Your Course
          </h1>
          <p className="text-xl text-gray-600">
            Enter your activation code to unlock premium features
          </p>
        </div>

        {userProfile?.subscription_type === 'premium' ? (
          // Already Premium User
          <div className="bg-white rounded-3xl shadow-2xl p-12 border border-green-200">
            <div className="text-center">
              <CheckCircleIcon className="h-24 w-24 text-green-500 mx-auto mb-6" />
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Course Already Activated!
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                You already have access to all premium features.
              </p>
              
              <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl p-8 mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Premium Features Unlocked:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="flex items-center space-x-3">
                    <SparklesIcon className="h-6 w-6 text-green-500" />
                    <span className="text-lg text-gray-700">Unlimited mock tests</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <SparklesIcon className="h-6 w-6 text-green-500" />
                    <span className="text-lg text-gray-700">Detailed analytics</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <SparklesIcon className="h-6 w-6 text-green-500" />
                    <span className="text-lg text-gray-700">Priority support</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <SparklesIcon className="h-6 w-6 text-green-500" />
                    <span className="text-lg text-gray-700">Advanced study materials</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        ) : (
          // Free User - Show Activation Form
          <div className="bg-white rounded-3xl shadow-2xl p-12 border border-orange-100">
            <div className="max-w-2xl mx-auto">
              {/* Activation Form */}
              <div className="mb-8">
                <label className="block text-2xl font-bold text-gray-900 mb-4">
                  Activation Code
                </label>
                <input
                  type="text"
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value)}
                  placeholder="Enter your activation code (e.g., PREMIUM2024)"
                  className="w-full px-6 py-4 border-2 border-orange-200 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                  disabled={activating}
                />
                <p className="text-gray-500 mt-3 text-lg">
                  Don't have a code? Contact support or purchase the full course.
                </p>
              </div>

              {/* Message Display */}
              {message.type && (
                <div className={`p-6 rounded-2xl mb-8 flex items-center space-x-3 ${
                  message.type === 'success' 
                    ? 'bg-green-100 border border-green-200' 
                    : 'bg-red-100 border border-red-200'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircleIcon className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-8 w-8 text-red-500" />
                  )}
                  <p className={`text-lg font-semibold ${
                    message.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {message.text}
                  </p>
                </div>
              )}

              {/* Activate Button */}
              <div className="text-center mb-12">
                <button
                  onClick={handleActivation}
                  disabled={activating || !activationCode.trim()}
                  className="px-12 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {activating ? (
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Activating...</span>
                    </div>
                  ) : (
                    'Activate Course'
                  )}
                </button>
              </div>

              {/* Premium Features Preview */}
              <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-2xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  What You'll Get with Premium:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Unlimited Access</h4>
                      <p className="text-gray-600">Take as many mock tests as you want</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Detailed Analytics</h4>
                      <p className="text-gray-600">Track your progress with advanced insights</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Priority Support</h4>
                      <p className="text-gray-600">Get help when you need it most</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">Study Materials</h4>
                      <p className="text-gray-600">Access exclusive learning resources</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}