"use client";

import { useAuth } from '@/context/AuthContext';
import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { 
  HomeIcon, 
  BookOpenIcon, 
  AcademicCapIcon, 
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  QuestionMarkCircleIcon,
  CogIcon,
  GiftIcon
} from '@heroicons/react/24/outline';

export default function DashboardSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const t = useTranslations('Dashboard');

  const navigation = [
    { name: t('navigation.dashboard'), href: '/dashboard', icon: HomeIcon },
    { name: t('navigation.resources'), href: '/resources', icon: BookOpenIcon },
    { name: t('navigation.mockTest'), href: '/mock-test', icon: AcademicCapIcon },
    { name: t('navigation.myResults'), href: '/my-results', icon: ChartBarIcon },
    { name: t('navigation.helpSupport'), href: '/help-support', icon: QuestionMarkCircleIcon },
    { name: t('navigation.settings'), href: '/settings', icon: CogIcon },
    { name: t('navigation.activateCourse'), href: '/activate-course', icon: GiftIcon },
  ];

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* Logo/Header */}
      <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-orange-500 to-red-500">
        <h1 className="text-xl font-bold text-white">KNI Prep</h1>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || user?.email}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                ${
                  isActive
                    ? 'bg-orange-100 text-orange-900'
                    : 'text-gray-600 hover:bg-orange-50 hover:text-gray-900'
                }
              `}
            >
              <item.icon
                className={`
                  mr-3 flex-shrink-0 h-5 w-5
                  ${
                    isActive
                      ? 'text-orange-500'
                      : 'text-gray-400 group-hover:text-orange-500'
                  }
                `}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={logout}
          className="group flex w-full items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowRightOnRectangleIcon
            className="mr-3 flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-gray-500"
            aria-hidden="true"
          />
          {t('navigation.logout') || 'Logout'}
        </button>
      </div>
    </div>
  );
}