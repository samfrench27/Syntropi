'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogOut, X, Menu as MenuIcon, Bell, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ClientHeaderProps {
  title: string;
}

export default function ClientHeader({ title }: ClientHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentOrganization } = useOrganization();
  
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };
  
  // Get user's name or fallback to email
  const getUserDisplayName = () => {
    if (!user) return 'User';
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    
    if (user.firstName) {
      return user.firstName;
    }
    
    return user.email?.split('@')[0] || 'User';
  };

  return (
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
        {/* Logo and Organization Name */}
        <div className="flex items-center">
          <Link 
            href="/"
            className="flex items-center"
          >
            <h1 style={{ 
              background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.5rem',
              fontWeight: 'bold' 
            }}>
              Syntropi
            </h1>
          </Link>
          
          {currentOrganization && (
            <div className="ml-4 pl-4 border-l border-gray-300">
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6B7280' }}>
                {currentOrganization.name}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-6">
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
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center rounded-full hover:bg-soft-lavender px-2 py-1 focus:outline-none transition-colors"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <span className="hidden md:inline-block text-sm font-medium text-gray-700 mr-2">
              {getUserDisplayName()}
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
          
          {/* Dropdown */}
          {userMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none z-20"
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {getUserDisplayName()}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
              
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
        
        {/* Mobile menu button - keep this for responsive design */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-soft-lavender focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open main menu</span>
            {mobileMenuOpen ? (
              <X className="block h-6 w-6" aria-hidden="true" />
            ) : (
              <MenuIcon className="block h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-white shadow-lg z-10" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/client-dashboard/api-keys"
              className="text-text-primary hover:bg-soft-lavender block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              API Keys
            </Link>
            <Link
              href="/client-dashboard/activities"
              className="text-text-primary hover:bg-soft-lavender block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Activity Logs
            </Link>
          </div>
        </div>
      )}
    </header>
  );
} 