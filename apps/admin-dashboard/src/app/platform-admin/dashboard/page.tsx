'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Users, 
  Key, 
  Activity,
  TrendingUp,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/admin/Card';
import { organizationAPI, userAPI } from '@/lib/api';

interface DashboardStats {
  organizationCount: number;
  userCount: number;
  apiKeyCount: number;
  activeApiCalls: number;
  systemStatus: 'healthy' | 'warning' | 'critical';
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    positive: boolean;
  };
  icon: ReactNode;
  onClick?: () => void;
}

// Define a type for the status values
type SystemStatus = 'healthy' | 'warning' | 'critical';

// Create an interface for the component props
interface StatusIndicatorProps {
  status: SystemStatus;
}

export default function PlatformAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    organizationCount: 0,
    userCount: 0,
    apiKeyCount: 0,
    activeApiCalls: 0,
    systemStatus: 'healthy',
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch basic data from existing endpoints
        const [orgsResponse, usersResponse] = await Promise.all([
          organizationAPI.getOrganizations({ limit: 0 }),
          userAPI.getUsers({ limit: 0 })
        ]);
        
        setStats({
          organizationCount: orgsResponse.data.data.pagination.total || 0,
          userCount: usersResponse.data.data.pagination.total || 0,
          apiKeyCount: 12, // Mock data
          activeApiCalls: 1247, // Mock data
          systemStatus: 'healthy',
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Stat card component for dashboard metrics
  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon, 
    onClick 
  }: StatCardProps) => (
    <div onClick={onClick} className={onClick ? "cursor-pointer" : ""}>
      <Card className="hover:shadow-md transition-shadow">
        <Card.Body>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-2xl font-semibold mt-1">
                {loading ? (
                  <span className="h-8 w-16 bg-gray-200 rounded animate-pulse"></span>
                ) : (
                  value
                )}
              </p>
              {change && (
                <p className={`text-xs flex items-center mt-1 ${change.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {change.positive ? '+' : '-'}{Math.abs(change.value)}%
                  <TrendingUp size={12} className="ml-1" />
                </p>
              )}
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
              {icon}
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );

  // System status indicator
  const StatusIndicator = ({ status }: StatusIndicatorProps) => {
    let bgColor = 'bg-green-500';
    let textColor = 'text-green-800';
    
    if (status === 'warning') {
      bgColor = 'bg-yellow-500';
      textColor = 'text-yellow-800';
    } else if (status === 'critical') {
      bgColor = 'bg-red-500';
      textColor = 'text-red-800';
    }
    
    return (
      <div className={`flex items-center ${textColor}`}>
        <div className={`w-3 h-3 ${bgColor} rounded-full mr-2`}></div>
        <span className="font-medium">
          {status === 'healthy' && 'All systems operational'}
          {status === 'warning' && 'Some systems degraded'}
          {status === 'critical' && 'System outage detected'}
        </span>
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <Header title="Dashboard" />
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Platform Dashboard" />
      
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Organizations" 
            value={stats.organizationCount} 
            change={{ value: 8.2, positive: true }}
            icon={<Building2 size={24} />} 
            onClick={() => router.push('/platform-admin/organizations')}
          />
          <StatCard 
            title="Users" 
            value={stats.userCount} 
            change={{ value: 12.5, positive: true }}
            icon={<Users size={24} />} 
            onClick={() => router.push('/platform-admin/users')}
          />
          <StatCard 
            title="API Keys" 
            value={stats.apiKeyCount} 
            change={{ value: 3.8, positive: true }}
            icon={<Key size={24} />} 
            onClick={() => router.push('/platform-admin/api-keys')}
          />
          <StatCard 
            title="API Calls (24h)" 
            value={stats.activeApiCalls} 
            change={{ value: 5.2, positive: true }}
            icon={<ArrowUpRight size={24} />} 
            onClick={() => router.push('/platform-admin/activities')}
          />
        </div>

        {/* System status and recent activity cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <Card.Header title="Recent Activity" />
            <Card.Body className="h-64">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse mt-2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-16">
                  <Activity size={36} className="mx-auto mb-2 opacity-40" />
                  <p>Activity data will appear here</p>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header title="System Status" />
            <Card.Body>
              <div className="mb-4">
                <StatusIndicator status={stats.systemStatus} />
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">API Service</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Healthy
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Healthy
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Auth Service</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Healthy
                  </span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
        
        {/* Provider Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <Card.Header title="Provider Status" />
            <Card.Body>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Token.io</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Online
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Yapily</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Online
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">TrueLayer</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Degraded
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Tink</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Online
                  </span>
                </div>
              </div>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header title="Recent Alerts" />
            <Card.Body>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="mt-1 mr-3 flex-shrink-0">
                    <AlertTriangle size={18} className="text-yellow-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">TrueLayer API Degraded Performance</h4>
                    <p className="text-xs text-gray-500 mt-1">Mar 1, 2025 - 14:32</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mt-1 mr-3 flex-shrink-0">
                    <AlertTriangle size={18} className="text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Database Maintenance Completed</h4>
                    <p className="text-xs text-gray-500 mt-1">Mar 1, 2025 - 08:15</p>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </main>
    </div>
  );
}