"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/i18n/navigation';
import { useEffect } from 'react';
import TopNavigation from '@/components/TopNavigation';
import Footer from '@/components/ui/footer';

type Props = {
  children: React.ReactNode;
};

export default function AppLayoutClient({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <TopNavigation />
      <main className="flex-1 p-6">
        {children}
      </main>
      <Footer border={true} />
    </div>
  );
}