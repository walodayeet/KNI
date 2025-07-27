'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserIcon, EnvelopeIcon, CalendarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  user_type: 'free' | 'premium';
  createdAt: string;
  premium_activated_at?: string;
}

export default function UserProfile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Mock profile data for demo purposes
    if (user) {
      const mockProfileData: UserProfileData = {
        id: user.id || 'demo-user-123',
        name: user.name || 'Demo User',
        email: user.email || 'demo@example.com',
        user_type: 'free',
        createdAt: new Date().toISOString(),
      };
      
      setProfileData(mockProfileData);
      setFormData({ name: mockProfileData.name, email: mockProfileData.email });
    }
    setLoading(false);
  }, [user]);

  const handleSave = async () => {
    // TODO: Implement actual API call to update user profile
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (profileData) {
        setProfileData({
          ...profileData,
          name: formData.name,
          email: formData.email
        });
      }
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (profileData) {
      setFormData({ name: profileData.name, email: profileData.email });
    }
    setEditing(false);
  };

  // Prevent hydration mismatch by not rendering anything until mounted
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Profile data not available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 border border-blue-100">
      {/* Profile Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {profileData.name.charAt(0).toUpperCase()}
          </div>
          <div className="ml-4">
            <h2 className="text-2xl font-bold text-gray-900">{profileData.name}</h2>
            <div className="flex items-center mt-1">
              <ShieldCheckIcon className="h-4 w-4 text-blue-500 mr-1" />
              <span className="text-sm text-gray-600 capitalize">{profileData.user_type} Member</span>
            </div>
          </div>
        </div>
        
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* Profile Information */}
      <div className="space-y-6">
        {/* Name Field */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <UserIcon className="h-4 w-4 mr-2 text-blue-500" />
            Full Name
          </label>
          {editing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{profileData.name}</p>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <EnvelopeIcon className="h-4 w-4 mr-2 text-blue-500" />
            Email Address
          </label>
          {editing ? (
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{profileData.email}</p>
          )}
        </div>

        {/* Member Since */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <CalendarIcon className="h-4 w-4 mr-2 text-blue-500" />
            Member Since
          </label>
          <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
            {new Date(profileData.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Account Type */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <ShieldCheckIcon className="h-4 w-4 mr-2 text-blue-500" />
            Account Type
          </label>
          <div className="px-4 py-3 bg-gray-50 rounded-lg">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              profileData.user_type === 'premium' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {profileData.user_type === 'premium' ? '✨ Premium' : '🆓 Free'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {editing && (
        <div className="flex space-x-4 mt-8">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium"
          >
            Save Changes
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200 font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}