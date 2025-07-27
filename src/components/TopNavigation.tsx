"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link, usePathname } from '@/i18n/navigation';
import { 
  HomeIcon, 
  BookOpenIcon, 
  AcademicCapIcon, 
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  CogIcon,
  BellIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  GiftIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import Logo from './ui/logo';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Resources', href: '/resources', icon: BookOpenIcon },
  { name: 'Mock Test', href: '/mock-test', icon: AcademicCapIcon },
  { name: 'My Results', href: '/my-results', icon: ChartBarIcon },
  { name: 'Help & Support', href: '/help-support', icon: QuestionMarkCircleIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
  { name: 'Activate Course', href: '/activate-course', icon: GiftIcon },
];

const getPageTitle = (pathname: string) => {
  const page = navigation.find(item => pathname === item.href);
  return page ? page.name : 'Dashboard';
};

export default function TopNavigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <img
                src="/images/logo.avif"
                width={40}
                height={40}
                alt="KNI Logo"
                className="hover:opacity-80 transition-opacity"
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-gray-800">KNI</span>
                <span className="text-xs text-gray-500">Khanh Nhat Institute</span>
              </div>
            </Link>
          </div>

          {/* Page Title */}
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-gray-900">{getPageTitle(pathname)}</h1>
          </div>

          {/* User Menu */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              {/* Messenger Link */}
              <a 
                href="https://www.facebook.com/khanhnhatinstitute" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 mr-2"
                title="Contact us on Messenger"
              >
                <ChatBubbleLeftRightIcon className="h-6 w-6" />
              </a>
              
              {/* Notifications */}
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200 mr-2">
                <BellIcon className="h-6 w-6" />
              </button>
              
              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-100 hover:text-gray-900 transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-medium text-white">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left mr-2">
                    <p className="font-medium text-gray-900">
                      {user?.name || user?.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user?.user_type === 'PREMIUM' ? '✨ Premium' : '🎯 Free'}
                    </p>
                  </div>
                  <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                <div className={`absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-[9999] transition-all duration-300 ease-in-out transform origin-top-right ${
                  isProfileDropdownOpen 
                    ? 'opacity-100 scale-100 translate-y-0' 
                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                }`}>
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-white">
                            {user?.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user?.name || user?.email?.split('@')[0]}
                          </p>
                          <p className="text-sm text-gray-500">
                            {user?.email}
                          </p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                            user?.user_type === 'PREMIUM' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user?.user_type === 'PREMIUM' ? '✨ Premium Member' : '🎯 Free Member'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        href="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors duration-200"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <UserCircleIcon className="mr-3 h-5 w-5 text-gray-400" />
                        My Profile
                      </Link>
                      
                      <Link
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors duration-200"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <CogIcon className="mr-3 h-5 w-5 text-gray-400" />
                        Settings
                      </Link>
                      
                      <Link
                        href="/resources"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors duration-200"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <BookOpenIcon className="mr-3 h-5 w-5 text-gray-400" />
                        Resources
                      </Link>
                      
                      <Link
                        href="/mock-test"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors duration-200"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <AcademicCapIcon className="mr-3 h-5 w-5 text-gray-400" />
                        Mock Test
                      </Link>
                      
                      <Link
                        href="/my-results"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors duration-200"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <ChartBarIcon className="mr-3 h-5 w-5 text-gray-400" />
                        My Results
                      </Link>
                      
                      {user?.user_type === 'FREE' && (
                        <>
                          <div className="px-4 py-3 border-t border-gray-100">
                            <div className="bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-lg p-4 text-white">
                              <div className="flex items-center mb-2">
                                <GiftIcon className="h-5 w-5 mr-2" />
                                <span className="font-semibold text-sm">Buy the Full Course</span>
                              </div>
                              <p className="text-xs text-emerald-100 mb-3">
                                Get 95% chance to study abroad in Germany or get into VGU
                              </p>
                              <Link
                                href="/upgrade"
                                className="inline-block w-full text-center px-3 py-2 bg-white text-emerald-600 text-xs font-bold rounded-md hover:bg-opacity-90 transition-all duration-200"
                                onClick={() => setIsProfileDropdownOpen(false)}
                              >
                                Activate Course →
                              </Link>
                            </div>
                          </div>
                        </>
                      )}
                      
                      <Link
                        href="/help-support"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors duration-200"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <QuestionMarkCircleIcon className="mr-3 h-5 w-5 text-gray-400" />
                        Help & Support
                      </Link>
                      
                      <Link
                        href="/activate-course"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors duration-200"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      >
                        <GiftIcon className="mr-3 h-5 w-5 text-gray-400" />
                        Activate Course
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={() => {
                          logout();
                          setIsProfileDropdownOpen(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"
            >
              {isMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden bg-white border-t border-gray-200 transition-all duration-300 ease-in-out transform ${
        isMenuOpen 
          ? 'opacity-100 max-h-screen translate-y-0' 
          : 'opacity-0 max-h-0 -translate-y-4 pointer-events-none overflow-hidden'
      }`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 rounded-xl text-base font-medium transition-all duration-200
                    ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                        : 'text-gray-600 hover:bg-orange-50 hover:text-gray-900'
                    }
                  `}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon
                    className={`
                      mr-3 h-5 w-5
                      ${
                        isActive
                          ? 'text-white'
                          : 'text-gray-400'
                      }
                    `}
                  />
                  {item.name}
                </Link>
              );
            })}
            
            
            {/* Additional Mobile Navigation Items */}
            <div className="border-t border-gray-200 pt-2">
              <Link
                href="/resources"
                className="flex items-center px-3 py-2 rounded-xl text-base font-medium text-gray-600 hover:bg-orange-50 hover:text-gray-900 transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <BookOpenIcon className="mr-3 h-5 w-5 text-gray-400" />
                Resources
              </Link>
              
              <Link
                href="/mock-test"
                className="flex items-center px-3 py-2 rounded-xl text-base font-medium text-gray-600 hover:bg-orange-50 hover:text-gray-900 transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <AcademicCapIcon className="mr-3 h-5 w-5 text-gray-400" />
                Mock Test
              </Link>
              
              <Link
                href="/my-results"
                className="flex items-center px-3 py-2 rounded-xl text-base font-medium text-gray-600 hover:bg-orange-50 hover:text-gray-900 transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <ChartBarIcon className="mr-3 h-5 w-5 text-gray-400" />
                My Results
              </Link>
              
              <Link
                href="/settings"
                className="flex items-center px-3 py-2 rounded-xl text-base font-medium text-gray-600 hover:bg-orange-50 hover:text-gray-900 transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <CogIcon className="mr-3 h-5 w-5 text-gray-400" />
                Settings
              </Link>
              
              <Link
                href="/help-support"
                className="flex items-center px-3 py-2 rounded-xl text-base font-medium text-gray-600 hover:bg-orange-50 hover:text-gray-900 transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <QuestionMarkCircleIcon className="mr-3 h-5 w-5 text-gray-400" />
                Help & Support
              </Link>
              
              <Link
                href="/activate-course"
                className="flex items-center px-3 py-2 rounded-xl text-base font-medium text-gray-600 hover:bg-orange-50 hover:text-gray-900 transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <GiftIcon className="mr-3 h-5 w-5 text-gray-400" />
                Activate Course
              </Link>
            </div>

            {/* Mobile User Info */}
            <div className="border-t border-gray-200 pt-4 pb-3">
              <div className="flex items-center px-3">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-900">
                    {user?.name || user?.email?.split('@')[0]}
                  </div>
                  <div className="text-sm text-gray-500">
                    {user?.user_type === 'PREMIUM' ? '✨ Premium Member' : '🎯 Free Member'}
                  </div>
                </div>
              </div>
              <div className="mt-3 px-2">
                <button
                  onClick={logout}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-600 rounded-xl hover:bg-orange-50 hover:text-gray-900 transition-all duration-200"
                >
                  <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
    </nav>
  );
}