'use client';

import React, { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Key, Activity, Menu, X, BarChart } from 'lucide-react';

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

export default function ClientSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const closeMobileMenu = () => {
    setMobileOpen(false);
  };
  
  // Check if a path is active
  const isActive = (href: string) => {
    // Special case for dashboard
    if (href === '/client-dashboard/dashboard' && (pathname === '/client-dashboard' || pathname === '/client-dashboard/dashboard')) {
      return true;
    }
    
    // Check if current path starts with the nav item's href
    return pathname?.startsWith(href);
  };
  
  // Navigation items for client dashboard
  const navigation = [
    { href: '/client-dashboard/dashboard', icon: <BarChart size={20} />, label: 'Dashboard' },
    { href: '/client-dashboard/api-keys', icon: <Key size={20} />, label: 'API Keys' },
    { href: '/client-dashboard/activities', icon: <Activity size={20} />, label: 'Activity Logs' },
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
          <div className="mb-4 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Client Dashboard
          </div>
          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavItem 
                key={item.href}
                href={item.href} 
                icon={item.icon} 
                label={item.label} 
                active={isActive(item.href)} 
                onClick={closeMobileMenu}
              />
            ))}
          </nav>
        </div>
      </div>
    </>
  );
} 