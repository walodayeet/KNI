"use client";

import Link from "next/link";
import Logo from "./logo";

export default function Footer({ border = false }: { border?: boolean }) {
  const footerClasses = `bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white ${border ? 'border-t border-gray-700' : ''}`;
  
  return (
    <footer className={footerClasses}>
      <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
        <div className="flex justify-center space-x-6 md:order-2">
          {/* Quick Links */}
          <div className="flex space-x-6 text-sm">
            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
              Privacy Policy
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
              Terms of Service
            </a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
              Support
            </a>
          </div>
        </div>
        <div className="mt-6 md:order-1 md:mt-0">
          <div className="flex items-center justify-center md:justify-start">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-3 shadow-lg">
                <span className="text-lg font-bold text-white">KNI</span>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">KNI Education</p>
                <p className="text-sm text-gray-400">
                  &copy; 2024 KNI. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
