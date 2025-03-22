'use client';

import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Key, 
  Activity,
  TrendingUp,
  ArrowUpRight,
  Settings,
  RefreshCw
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/admin/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface DashboardStats {
  organizationId: string;
  name: string;
  plan: string;
  userCount: number;
  apiKeyCount: number;
  activeApiCalls: number;
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
  loading?: boolean;
}

export default function OrgAdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization, loading, error, refreshOrganization } = useOrganization();

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

  // Handle refresh button click
  const handleRefresh = async () => {
    await refreshOrganization();
  };

  return (
    <div>
      <Header title="Organization Dashboard" />
      
      <main className="p-6">
        {/* Organization header with refresh button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            {currentOrganization ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{currentOrganization.name}</h1>
                <p className="text-gray-500">
                  Plan: <span className="font-medium">
                    {currentOrganization.plan.charAt(0).toUpperCase() + currentOrganization.plan.slice(1)}
                  </span>
                </p>
              </>
            ) : loading ? (
              <div className="space-y-2">
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">Organization Dashboard</h1>
            )}
          </div>
          
          {error && (
            <button
              onClick={handleRefresh}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
        
        {/* Error display if applicable */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-bold">Error Loading Organization</p>
            <p>{error}</p>
          </div>
        )}
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title="Users" 
            value={currentOrganization?.stats?.userCount || 0} 
            change={{ value: 5.2, positive: true }}
            icon={<Users size={24} />} 
            onClick={() => router.push('/org-admin/users')}
          />
          <StatCard 
            title="API Keys" 
            value={currentOrganization?.stats?.apiKeyCount || 0} 
            change={{ value: 3.8, positive: true }}
            icon={<Key size={24} />} 
            onClick={() => router.push('/org-admin/api-keys')}
          />
          <StatCard 
            title="API Calls (24h)" 
            value={254} // Mock data
            change={{ value: 5.2, positive: true }}
            icon={<ArrowUpRight size={24} />} 
            onClick={() => router.push('/org-admin/activities')}
          />
        </div>

        {/* Activity and Usage cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
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
                  <p>Recent activities will appear here</p>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header title="API Usage" />
            <Card.Body className="h-64">
              <div className="text-center text-gray-500 py-16">
                <ArrowUpRight size={36} className="mx-auto mb-2 opacity-40" />
                <p>API usage analytics will appear here</p>
              </div>
            </Card.Body>
          </Card>
        </div>
        
        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onClick={() => router.push('/org-admin/users/create')} className="cursor-pointer">
              <Card className="hover:shadow-md transition-shadow">
                <Card.Body>
                  <div className="flex flex-col items-center justify-center py-4">
                    <Users size={24} className="mb-2 text-blue-600" />
                    <h3 className="font-medium text-center">Add New User</h3>
                  </div>
                </Card.Body>
              </Card>
            </div>
            
            <div onClick={() => router.push('/org-admin/api-keys/create')} className="cursor-pointer">
              <Card className="hover:shadow-md transition-shadow">
                <Card.Body>
                  <div className="flex flex-col items-center justify-center py-4">
                    <Key size={24} className="mb-2 text-blue-600" />
                    <h3 className="font-medium text-center">Create API Key</h3>
                  </div>
                </Card.Body>
              </Card>
            </div>
            
            <div onClick={() => router.push('/org-admin/organization')} className="cursor-pointer">
              <Card className="hover:shadow-md transition-shadow">
                <Card.Body>
                  <div className="flex flex-col items-center justify-center py-4">
                    <Settings size={24} className="mb-2 text-blue-600" />
                    <h3 className="font-medium text-center">Organization Settings</h3>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}