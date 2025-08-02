"use client";

import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { 
  AcademicCapIcon, 
  ChartBarIcon, 
  TrophyIcon,
  ClockIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';

interface MockTest {
  id: string;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  duration: number;
  question_count: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface UserProgress {
  total_tests: number;
  average_score: number;
  best_score: number;
  total_time_spent: number;
  streak_days: number;
  last_test_date: string | null;
}

interface UserStats {
  tests_this_week: number;
  tests_this_month: number;
  improvement_rate: number;
  weak_areas: string[];
  strong_areas: string[];
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
  due_date: string;
}

interface WeeklyAssignment {
  id: string;
  title: string;
  description: string;
  target_tests: number;
  completed_tests: number;
  due_date: string;
  completed: boolean;
}

interface RecentAttempt {
  id: string;
  mock_test: {
    title: string;
  };
  score: number;
  completed_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  // @ts-ignore
  const [_userStats, _setUserStats] = useState<UserStats | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  // @ts-ignore
  const [_recommendations, _setRecommendations] = useState<Recommendation[]>([]);
  // @ts-ignore
  const [_weeklyAssignments, _setWeeklyAssignments] = useState<WeeklyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) {return;}
      
      try {
        // Fetch all dashboard data in parallel
        const [testsRes, progressRes] = await Promise.all([
          fetch(`/api/mock-tests?userId=${user.id}&userType=${user.role}`),
          fetch(`/api/user-progress?userId=${user.id}`)
        ]);

        if (testsRes.ok) {
          const tests = await testsRes.json();
          setMockTests(tests.filter((test: MockTest) => test.status === 'ACTIVE'));
        }

        if (progressRes.ok) {
          const data = await progressRes.json();
          setUserProgress(data.progress);
          _setUserStats(data.stats);
          setRecentAttempts(data.recentAttempts || []);
          
          // Set recommendations for premium users or assignments for free users
          // Note: Premium status should be determined by user_type, but for now using role-based logic
          if (user.role === 'ADMIN' || user.role === 'TEACHER') {
            _setRecommendations(data.recommendations || []);
          } else {
            _setWeeklyAssignments(data.weeklyAssignments || []);
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);



  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HARD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // @ts-ignore
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Ensure proper component initialization
  if (typeof window === 'undefined') {return null;}

  const streakDays = userProgress?.streak_days || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-red-50">
      <div className="max-w-7xl mx-auto space-y-12 p-8">
        {/* Welcome Header */}
        <div className="relative bg-white rounded-2xl p-8 shadow-xl overflow-hidden mb-8 border border-gray-100">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-200">
              <Image 
                src="/images/Dashboard/Dashboard icon.png"
                alt="Welcome icon"
                width={80}
                height={80}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-800">
                {t('welcome.title', { name: user?.name || user?.email?.split('@')[0] || t('welcome.defaultName') })}
              </h1>
              <div className="flex items-center space-x-4">
                <div className="bg-gray-100 px-4 py-2 rounded-lg text-gray-600">
                  {streakDays} {t('welcome.dayStreak')}
                </div>
                <span className="text-gray-500">
                  {user?.role === 'ADMIN' || user?.role === 'TEACHER' ? t('welcome.premiumMember') : t('welcome.freeMember')}
                </span>
              </div>
            </div>
          </div>
        </div>



        {/* Key Statistics - Enhanced */}
        {userProgress && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl p-12 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium text-orange-100 mb-3">{t('stats.testsCompleted')}</p>
                  <p className="text-5xl font-bold text-white">{userProgress.total_tests}</p>
                  <p className="text-sm text-orange-200 mt-2">{t('stats.keepGoing')}</p>
                </div>
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                  <AcademicCapIcon className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-12 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium text-emerald-100 mb-3">{t('stats.averageScore')}</p>
                  <p className="text-5xl font-bold text-white">{userProgress.average_score.toFixed(1)}%</p>
                  <p className="text-sm text-emerald-200 mt-2">{t('stats.excellentProgress')}</p>
                </div>
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                  <ChartBarIcon className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-12 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium text-amber-100 mb-3">{t('stats.bestScore')}</p>
                  <p className="text-5xl font-bold text-white">{userProgress.best_score}%</p>
                  <p className="text-sm text-amber-200 mt-2">{t('stats.personalBest')}</p>
                </div>
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                  <TrophyIcon className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Available Mock Tests */}
        <div className="space-y-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
              {t('availableTests.title')}
              <span className="block text-lg font-normal text-gray-600 mt-2">{t('availableTests.subtitle')}</span>
            </h2>
          {mockTests.length > 0 ? (
            mockTests.map((test) => (
              <div key={test.id} className="bg-gradient-to-r from-orange-50 via-white to-orange-50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-orange-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">{test.title}</h3>
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${getDifficultyColor(test.difficulty)}`}>
                    {test.difficulty}
                  </span>
                </div>
                <p className="text-gray-700 mb-8 leading-relaxed text-lg">{test.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-8 text-base text-gray-600">
                    <span className="flex items-center bg-orange-100 px-4 py-2 rounded-xl">
                      <ClockIcon className="h-5 w-5 mr-3 text-orange-500" />
                      {test.duration} min
                    </span>
                    <span className="flex items-center bg-orange-100 px-4 py-2 rounded-xl">
                      <BookOpenIcon className="h-5 w-5 mr-3 text-orange-500" />
                      {test.question_count} questions
                    </span>
                  </div>
                  <Link
                    href={`/test/${test.id}`}
                    className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
                  >
                    {t('availableTests.startTest')} →
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AcademicCapIcon className="h-12 w-12 text-orange-500" />
              </div>
              <p className="text-gray-500 text-xl">{t('availableTests.noTests')}</p>
              <p className="text-gray-400 text-lg mt-2">{t('availableTests.checkBack')}</p>
            </div>
          )}
        </div>

        {/* Recent Attempts */}
        {recentAttempts.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
              {t('recentAttempts.title')}
              <span className="block text-lg font-normal text-gray-600 mt-2">{t('recentAttempts.subtitle')}</span>
            </h2>
            <div className="space-y-6">
              {recentAttempts.slice(0, 6).map((attempt) => (
                <div key={attempt.id} className="bg-gradient-to-r from-orange-50 via-white to-orange-50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-orange-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">{attempt.mock_test.title}</h3>
                    <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                      attempt.score >= 70 
                        ? 'bg-green-100 text-green-800' 
                        : attempt.score >= 50 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {attempt.score}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-base text-gray-600">
                    <span className="flex items-center bg-orange-100 px-4 py-2 rounded-xl">
                      <ClockIcon className="h-5 w-5 mr-3 text-orange-500" />
                      {new Date(attempt.completed_at).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/result/${attempt.id}`}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
                    >
                      {t('recentAttempts.viewResults')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/my-results"
              className="block mt-8 text-center bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 text-lg"
            >
              {t('recentAttempts.viewAllResults')} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}