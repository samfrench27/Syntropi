// src/components/layout/PlatformAdminSidebar.tsx
'use client';

import React, { useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart, 
  Users, 
  Building2, 
  Settings, 
  Key, 
  Database,
  Server,
  Activity,
  TrendingUp,
  Shield,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}

// NavItem component for sidebar links
const NavItem = ({ href, icon, label, active, onClick }: NavItemProps) => (
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

export default function PlatformAdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  // Navigation items for platform admin
  const navigation = [
    { href: '/platform-admin/dashboard', icon: <BarChart size={20} />, label: 'Dashboard' },
    { href: '/platform-admin/analytics', icon: <TrendingUp size={20} />, label: 'Analytics' },
    { href: '/platform-admin/organizations', icon: <Building2 size={20} />, label: 'Organizations' },
    { href: '/platform-admin/users', icon: <Users size={20} />, label: 'Users' },
    { href: '/platform-admin/api-keys', icon: <Key size={20} />, label: 'API Keys' },
    { href: '/platform-admin/providers', icon: <Database size={20} />, label: 'Providers' },
    { href: '/platform-admin/activities', icon: <Activity size={20} />, label: 'Activities' },
  ];

  // Configuration items
  const configItems = [
    { href: '/system', icon: <Server size={20} />, label: 'System' },
    { href: '/security', icon: <Shield size={20} />, label: 'Security' },
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
        className={`h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 flex flex-col z-10 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } lg:static`}
      >
        <div className="overflow-auto flex-1 p-4">
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
              Configuration
            </div>
            
            {configItems.map((item) => (
              <NavItem 
                key={item.href}
                href={item.href} 
                icon={item.icon} 
                label={item.label} 
                active={pathname === item.href} 
                onClick={closeMobileMenu}
              />
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}