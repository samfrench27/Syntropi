// src/components/layout/OrgAdminHeader.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, Settings, User, LogOut, Shield, HelpCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { userAPI } from '@/lib/api';

export default function OrgAdminHeader({ title }: { title: string }) {
  const { user, logout, refreshUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [modalAnimation, setModalAnimation] = useState('');
  
  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Set form values when user data changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  const openModal = (modalType: string) => {
    setModalOpen(modalType);
    setDropdownOpen(false);
    setModalAnimation('animate-fadeIn');
    // Reset notification when opening modal
    setNotification(null);
  };

  const closeModal = () => {
    setModalAnimation('animate-fadeOut');
    setTimeout(() => {
      setModalOpen(null);
      setModalAnimation('');
    }, 300);
  };
  
  const handleUpdateProfile = async () => {
    if (!user || !user.id) return;
    
    try {
      setIsUpdating(true);
      
      await userAPI.updateUser(user.id, {
        firstName,
        lastName
      });
      
      // Refresh user data
      await refreshUser();
      
      // Show success message
      setNotification({
        type: 'success',
        message: 'Profile updated successfully'
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to update profile', error);
      setNotification({
        type: 'error',
        message: 'Failed to update profile. Please try again.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <header style={{
        background: 'linear-gradient(to right, rgba(79, 140, 255, 0.03), rgba(159, 92, 255, 0.03))',
        borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
        height: '4rem',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem'
      }}>
        <div className="flex items-center">
          {/* Logo and organization name in horizontal layout */}
          <div className="flex items-center">
            <h1 style={{ 
              background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.5rem',
              fontWeight: 'bold' 
            }}>
              Syntropi
            </h1>
            
            {currentOrganization?.name && (
              <div className="ml-4 pl-4 border-l border-gray-300">
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280' }}>
                  {currentOrganization.name}
                </span>
              </div>
            )}
          </div>
          
          <h1 style={{ 
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#374151',
            marginLeft: '1.5rem'
          }}>
            {title}
          </h1>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* API Documentation Link */}
          <a 
            href="https://www.developer.syntropi.co.uk" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden md:flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            API Docs
            <ExternalLink size={14} className="ml-1" />
          </a>
          
          {/* Search */}
          <div className="max-w-md w-64 lg:w-80">
            <div className="relative text-gray-400 focus-within:text-gray-600">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} />
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none sm:text-sm"
                style={{
                  boxShadow: 'none',
                  borderColor: 'rgba(209, 213, 219, 0.8)',
                }}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(79, 140, 255, 0.3)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                type="search"
                placeholder="Search"
              />
            </div>
          </div>
          
          {/* Notification button */}
          <button
            type="button"
            style={{
              padding: '0.375rem',
              borderRadius: '9999px',
              color: '#9F5CFF',
              transition: 'all 150ms'
            }}
            className="hover:bg-soft-lavender focus:outline-none"
          >
            <span className="sr-only">View notifications</span>
            <Bell size={20} />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center rounded-full hover:bg-soft-lavender px-2 py-1 focus:outline-none transition-colors"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <span className="hidden md:inline-block text-sm font-medium text-gray-700 mr-2">
                {user?.firstName} {user?.lastName}
              </span>
              <div style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '9999px',
                background: 'linear-gradient(to right, rgba(79, 140, 255, 0.2), rgba(159, 92, 255, 0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4F8CFF',
                fontWeight: 600,
                fontSize: '0.875rem'
              }}>
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

      {/* Modal with animation and backdrop blur */}
      {modalOpen && (
        <>
          {/* Semi-transparent backdrop with blur */}
          <div 
            className={`fixed inset-0 bg-gray-600 bg-opacity-30 backdrop-blur-sm z-30 transition-opacity duration-300 ${modalAnimation === 'animate-fadeOut' ? 'opacity-0' : 'opacity-100'}`}
            onClick={closeModal}
          ></div>
          
          {/* Modal content with animation */}
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
            <div 
              ref={modalRef}
              className={`bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto pointer-events-auto transition-all duration-300 ${
                modalAnimation === 'animate-fadeIn' ? 'opacity-100 scale-100 translate-y-0' : 
                modalAnimation === 'animate-fadeOut' ? 'opacity-0 scale-95 -translate-y-4' : 
                'opacity-0 scale-95 -translate-y-4'
              }`}
            >
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
              
              {/* Notification message */}
              {notification && (
                <div className={`mx-6 mt-4 p-3 rounded-md flex items-center ${
                  notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {notification.type === 'success' ? (
                    <CheckCircle size={18} className="text-green-500 mr-2" />
                  ) : (
                    <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span>{notification.message}</span>
                </div>
              )}
              
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
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <button
                        type="button"
                        onClick={handleUpdateProfile}
                        disabled={isUpdating}
                        className="w-full flex justify-center items-center px-4 py-2 rounded-md hover:opacity-90 text-white"
                        style={{
                          background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
                          transition: 'opacity 150ms'
                        }}
                      >
                        {isUpdating ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </>
                        ) : (
                          <>
                            <User size={16} className="mr-2" />
                            Update Profile
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Settings Modal Content */}
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
                
                {/* Security Modal Content */}
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
                
                {/* Help Modal Content */}
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