'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, Settings, User, LogOut, Shield, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  const openModal = (modalType: string) => {
    setModalOpen(modalType);
    setDropdownOpen(false);
  };

  const closeModal = () => {
    setModalOpen(null);
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center">
          {/* Logo - only visible in header now */}
          <div className="mr-6">
            <h1 style={{ 
              background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.25rem',
              fontWeight: 'bold' 
            }}>
              Syntropi
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>Platform Admin</p>
          </div>
          
          <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* Search */}
          <div className="max-w-md w-64 lg:w-80">
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
          
          {/* Notification button */}
          <button
            type="button"
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span className="sr-only">View notifications</span>
            <Bell size={20} />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center rounded-full hover:bg-gray-100 px-2 py-1 focus:outline-none transition-colors"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <span className="hidden md:inline-block text-sm font-medium text-gray-700 mr-2">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
            </button>
            
            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                  <p className="text-xs font-medium text-gray-500 mt-1">
                    {user?.role}
                  </p>
                </div>
                
                {/* Menu items */}
                <button
                  onClick={() => openModal('profile')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <User size={16} className="mr-2" />
                  My Profile
                </button>
                
                <button
                  onClick={() => openModal('settings')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <Settings size={16} className="mr-2" />
                  Settings
                </button>
                
                <button
                  onClick={() => openModal('security')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <Shield size={16} className="mr-2" />
                  Security
                </button>
                
                <button
                  onClick={() => openModal('help')}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <HelpCircle size={16} className="mr-2" />
                  Help & Support
                </button>
                
                <div className="border-t border-gray-100 my-1"></div>
                
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                >
                  <LogOut size={16} className="mr-2" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Overlay - Using a more transparent overlay for better background visibility */}
      {modalOpen && (
        <>
          {/* Semi-transparent backdrop */}
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50 z-30"
            onClick={closeModal}
          ></div>
          
          {/* Modal content */}
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto pointer-events-auto">
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  {modalOpen === 'profile' && 'My Profile'}
                  {modalOpen === 'settings' && 'Settings'}
                  {modalOpen === 'security' && 'Security'}
                  {modalOpen === 'help' && 'Help & Support'}
                </h2>
                <button 
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                {modalOpen === 'profile' && (
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xl mr-6">
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-medium">{user?.firstName} {user?.lastName}</h3>
                        <p className="text-sm text-gray-500">{user?.role}</p>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          defaultValue={user?.firstName}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          defaultValue={user?.lastName}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <button
                        type="button"
                        className="w-full flex justify-center items-center px-4 py-2 rounded-md hover:opacity-90 text-white"
                        style={{
                          background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
                          transition: 'opacity 150ms'
                        }}
                      >
                        <User size={16} className="mr-2" />
                        Update Profile
                      </button>
                    </div>
                  </div>
                )}
                
                {modalOpen === 'settings' && (
                  <div className="space-y-4">
                    <p>Settings content will be displayed here</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Language
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option>English</option>
                          <option>Spanish</option>
                          <option>French</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Time Zone
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option>UTC</option>
                          <option>America/New_York</option>
                          <option>Europe/London</option>
                          <option>Asia/Tokyo</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="darkMode"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="darkMode" className="ml-2 block text-sm text-gray-700">
                          Enable Dark Mode
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                
                {modalOpen === 'security' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Change Password</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Current Password
                          </label>
                          <input
                            type="password"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            New Password
                          </label>
                          <input
                            type="password"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <button
                          type="button"
                          className="w-full flex justify-center items-center px-4 py-2 rounded-md hover:opacity-90 text-white"
                          style={{
                            background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
                            transition: 'opacity 150ms'
                          }}
                        >
                          Update Password
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-medium mb-2">Two-Factor Authentication</h3>
                      <p className="text-sm text-gray-600 mb-3">Add an extra layer of security to your account</p>
                      <button
                        type="button"
                        className="px-4 py-2 border border-gray-300 rounded-md text-blue-700 hover:bg-blue-50"
                      >
                        Set Up Two-Factor Authentication
                      </button>
                    </div>
                  </div>
                )}
                
                {modalOpen === 'help' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Help & Support</h3>
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <h4 className="font-medium mb-2">Documentation</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Check our comprehensive documentation to find answers to common questions.
                      </p>
                      <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Documentation
                      </a>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <h4 className="font-medium mb-2">Contact Support</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Need help? Our support team is ready to assist you.
                      </p>
                      <a href="mailto:support@syntropi.com" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        support@syntropi.com
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}