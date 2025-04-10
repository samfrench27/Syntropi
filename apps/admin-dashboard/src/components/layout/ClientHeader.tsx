'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogOut, X, Menu as MenuIcon } from 'lucide-react';
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
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      zIndex: 10
    }}>
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Organization Name */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
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
          
          {/* Page Title - Hidden on mobile */}
          <div className="hidden md:flex items-center">
            <h1 style={{ 
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#374151'
            }}>
              {title}
            </h1>
          </div>
          
          {/* User Profile Dropdown */}
          <div className="flex items-center">
            <div className="ml-3 relative">
              <div>
                <button
                  type="button"
                  style={{
                    background: 'linear-gradient(to right, rgba(79, 140, 255, 0.2), rgba(159, 92, 255, 0.2))',
                    borderRadius: '9999px',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  id="user-menu-button"
                  aria-expanded="false"
                  aria-haspopup="true"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <span className="sr-only">Open user menu</span>
                  <User className="h-7 w-7 rounded-full p-1 text-syntropi-blue" />
                </button>
              </div>
              
              {/* Dropdown */}
              {userMenuOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-surface ring-1 ring-black ring-opacity-5 focus:outline-none"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button"
                  tabIndex={-1}
                >
                  <div className="px-4 py-2 text-sm text-text-primary border-b border-gray-100">
                    <div className="font-medium">{getUserDisplayName()}</div>
                    <div className="text-xs text-text-secondary truncate">
                      {user?.email}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-sm text-text-primary hover:bg-soft-lavender"
                    role="menuitem"
                  >
                    <LogOut className="mr-3 h-4 w-4 text-text-secondary" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center ml-4">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-soft-lavender focus:outline-none focus:ring-2 focus:ring-inset focus:ring-syntropi-purple"
                aria-controls="mobile-menu"
                aria-expanded="false"
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
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
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