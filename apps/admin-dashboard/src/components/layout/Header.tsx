'use client';

import React from 'react';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Header({ title }: { title: string }) {
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 sticky top-0 z-10">
      <div className="flex-1">
        <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      </div>
      
      <div className="max-w-md w-full lg:max-w-xs hidden md:block">
        <div className="relative text-gray-400 focus-within:text-gray-600">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} />
          </div>
          <input
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            type="search"
            placeholder="Search"
          />
        </div>
      </div>
      
      <div className="ml-4 flex items-center md:ml-6">
        <button
          type="button"
          className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <span className="sr-only">View notifications</span>
          <Bell size={20} />
        </button>

        <div className="ml-3 relative">
          <div className="flex items-center">
            <span className="hidden md:inline-block text-sm font-medium text-gray-700 mr-2">
              {user?.firstName} {user?.lastName}
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
              {user?.firstName.charAt(0)}{user?.lastName.charAt(0)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}