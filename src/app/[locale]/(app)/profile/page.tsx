import AuthGuard from '@/components/auth/AuthGuard';
import UserProfile from '@/components/profile/UserProfile';

export const metadata = {
  title: 'Profile',
  description: 'User profile page',
};

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16 px-4 shadow-lg">
          <div className="container mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4">My Profile</h1>
            <p className="text-xl text-blue-100">Manage your account information and preferences</p>
          </div>
        </div>
        
        {/* Content Section */}
        <div className="container mx-auto py-12 px-4">
          <UserProfile />
        </div>
      </div>
    </AuthGuard>
  );
}