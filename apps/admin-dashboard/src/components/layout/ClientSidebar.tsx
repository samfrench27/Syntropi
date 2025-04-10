'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Key, Activity } from 'lucide-react';

const navItems = [
  {
    name: 'API Keys',
    href: '/client-dashboard/api-keys',
    icon: Key,
  },
  {
    name: 'Activity Logs',
    href: '/client-dashboard/activities',
    icon: Activity,
  },
];

export default function ClientSidebar() {
  const pathname = usePathname();
  
  const isActive = (href: string) => {
    // Special case for dashboard
    if (href === '/client-dashboard/dashboard' && pathname === '/client-dashboard') {
      return true;
    }
    
    // Check if current path starts with the nav item's href
    return pathname?.startsWith(href);
  };

  return (
    <aside className="w-64 bg-white shadow-sm hidden md:block">
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto py-4 px-3">
          <nav className="space-y-1 px-2">
            <div className="mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Client Dashboard
            </div>
            
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  className={`mr-3 flex-shrink-0 h-5 w-5 ${
                    isActive(item.href) ? 'text-blue-500' : 'text-gray-400'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
} 