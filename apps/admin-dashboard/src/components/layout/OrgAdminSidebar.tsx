// src/components/layout/OrgAdminSidebar.tsx
'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart, 
  Users, 
  Building2, 
  Settings, 
  Key,
  Activity,
  HelpCircle,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavItemProps {
    href: string;
    icon: ReactNode;
    label: string;
    active: boolean;
    onClick?: () => void;  // Optional since some nav items might not need click handlers
  }

// NavItem component for sidebar links
const NavItem = ({ href, icon, label, active, onClick }:NavItemProps) => (
  <Link 
    href={href}
    className={`flex items-center px-4 py-3 rounded-md mb-1 ${
      active 
        ? 'bg-blue-100 text-blue-800' 
        : 'text-gray-700 hover:bg-gray-100'
    }`}
    onClick={onClick}
  >
    <span className="mr-3">{icon}</span>
    {label}
  </Link>
);

export default function OrgAdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const closeMobileMenu = () => {
    setMobileOpen(false);
  };
  
  const handleLogout = () => {
    logout();
  };

  // Navigation items for organization admin
  const navigation = [
    { href: '/org-admin/dashboard', icon: <BarChart size={20} />, label: 'Dashboard' },
    { href: '/org-admin/organization', icon: <Building2 size={20} />, label: 'Organization' },
    { href: '/org-admin/users', icon: <Users size={20} />, label: 'Users' },
    { href: '/org-admin/api-keys', icon: <Key size={20} />, label: 'API Keys' },
    { href: '/org-admin/activities', icon: <Activity size={20} />, label: 'Activities' },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-20">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      {/* Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={closeMobileMenu}
        ></div>
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed h-full w-64 bg-white border-r border-gray-200 flex flex-col z-10 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } lg:static`}
      >
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-700">Syntropi</h1>
          <p className="text-sm text-gray-500">Organization Admin</p>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavItem 
                key={item.href}
                href={item.href} 
                icon={item.icon} 
                label={item.label} 
                active={pathname === item.href} 
                onClick={closeMobileMenu}
              />
            ))}
            
            <div className="mt-8 mb-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Support
            </div>
            
            <NavItem 
              href="/org-admin/settings" 
              icon={<Settings size={20} />} 
              label="Settings" 
              active={pathname === '/org-admin/settings'} 
              onClick={closeMobileMenu}
            />
            
            <NavItem 
              href="/help" 
              icon={<HelpCircle size={20} />} 
              label="Help & Support" 
              active={pathname === '/help'} 
              onClick={closeMobileMenu}
            />
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          {user && (
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </div>
          )}
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-gray-700 rounded-md hover:bg-gray-100"
          >
            <LogOut size={20} className="mr-3" />
            Log out
          </button>
        </div>
      </div>
    </>
  );
}