'use client';

import { useState, useEffect } from 'react';
import { UserIcon, BellIcon, ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  subscription_type: 'free' | 'premium';
  notifications_enabled: boolean;
  language: string;
  theme: 'light' | 'dark';
}

export default function SettingsPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    notifications_enabled: true,
    language: 'en',
    theme: 'light' as 'light' | 'dark'
  });

  useEffect(() => {
    // Mock user data for demo purposes
    const mockProfile = {
      id: 'demo-user-123',
      email: 'demo@example.com',
      full_name: 'Demo User',
      subscription_type: 'free' as const,
      notifications_enabled: true,
      language: 'en',
      theme: 'light' as const
    };
    
    setUserProfile(mockProfile);
    setFormData({
      full_name: mockProfile.full_name || '',
      notifications_enabled: mockProfile.notifications_enabled,
      language: mockProfile.language,
      theme: mockProfile.theme
    });
    setLoading(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate saving process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...formData } : null);
      // Settings saved successfully!
    } catch (error) {
      console.error('Error saving settings:', error);
      // Error saving settings. Please try again.
    } finally {
      setSaving(false);
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
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Account Settings
          </h1>
          <p className="text-xl text-gray-600">
            Manage your account preferences and settings
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-12 border border-orange-100">
          {/* Profile Section */}
          <div className="mb-12">
            <div className="flex items-center mb-8">
              <UserIcon className="h-8 w-8 text-orange-500 mr-4" />
              <h2 className="text-3xl font-bold text-gray-900">Profile Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  Email Address
                </label>
                <input
                  type="email"
                  value={userProfile?.email || ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500 text-lg"
                />
                <p className="text-sm text-gray-500 mt-2">Email cannot be changed</p>
              </div>
              
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                  placeholder="Enter your full name"
                />
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="mb-12">
            <div className="flex items-center mb-8">
              <BellIcon className="h-8 w-8 text-orange-500 mr-4" />
              <h2 className="text-3xl font-bold text-gray-900">Notifications</h2>
            </div>
            
            <div className="flex items-center justify-between p-6 bg-orange-50 rounded-2xl">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Email Notifications</h3>
                <p className="text-gray-600 mt-1">Receive updates about your test results and new features</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifications_enabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, notifications_enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>

          {/* Language & Theme Section */}
          <div className="mb-12">
            <div className="flex items-center mb-8">
              <GlobeAltIcon className="h-8 w-8 text-orange-500 mr-4" />
              <h2 className="text-3xl font-bold text-gray-900">Preferences</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  Language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                >
                  <option value="en">English</option>
                  <option value="vn">Tiếng Việt</option>
                </select>
              </div>
              
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  Theme
                </label>
                <select
                  value={formData.theme}
                  onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' }))}
                  className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </div>

          {/* Subscription Section */}
          <div className="mb-12">
            <div className="flex items-center mb-8">
              <ShieldCheckIcon className="h-8 w-8 text-orange-500 mr-4" />
              <h2 className="text-3xl font-bold text-gray-900">Subscription</h2>
            </div>
            
            <div className="p-6 bg-gradient-to-r from-orange-100 to-red-100 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Current Plan: {userProfile?.subscription_type === 'premium' ? 'Premium' : 'Free'}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {userProfile?.subscription_type === 'premium' 
                      ? 'You have access to all premium features' 
                      : 'Upgrade to premium for unlimited access'
                    }
                  </p>
                </div>
                {userProfile?.subscription_type === 'free' && (
                  <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105">
                    Upgrade Now
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="text-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-12 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}