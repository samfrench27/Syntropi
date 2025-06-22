// src/app/org-admin/dashboard/page.tsx
'use client';

import React, { ReactNode, useEffect, useState } from 'react';
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
import Card from '@/components/admin/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { activityAPI } from '@/lib/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

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

interface ApiCallData {
  date: string;
  count: number;
}

export default function OrgAdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization, loading, error, refreshOrganization } = useOrganization();
  const [apiCallsData, setApiCallsData] = useState<ApiCallData[]>([]);
  const [apiCallsLoading, setApiCallsLoading] = useState(true);
  const [apiCallsError, setApiCallsError] = useState<string | null>(null);
  const [apiCallsCount, setApiCallsCount] = useState(0);

  useEffect(() => {
    if (currentOrganization && currentOrganization._id) {
      fetchApiCallsData();
    }
  }, [currentOrganization]);

  const fetchApiCallsData = async () => {
    if (!currentOrganization) return;
    
    try {
      setApiCallsLoading(true);
      
      // Get data for the last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
      
      // Prepare the array of dates for the last 7 days
      const chartData: ApiCallData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        chartData.push({
          date: date.toISOString().split('T')[0],
          count: 0
        });
      }
      
      // Count API calls in the last 24 hours
      const yesterday = new Date(endDate);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Fetch data for each day
      const params = {
        limit: 1000,
        action: 'api.access',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        organizationId: currentOrganization._id
      };
      
      const response = await activityAPI.getActivities(params);
      const activities = response.data.data.activities || [];
      
      // Count activities per day
      activities.forEach((activity: any) => {
        const activityDate = new Date(activity.createdAt).toISOString().split('T')[0];
        const dataPoint = chartData.find(item => item.date === activityDate);
        if (dataPoint) {
          dataPoint.count++;
        }
      });
      
      // Format dates to be more readable
      chartData.forEach(data => {
        const date = new Date(data.date);
        data.date = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      
      setApiCallsData(chartData);
      
      // Get 24h API call count
      const last24HoursResponse = await activityAPI.getActivities({
        limit: 0,
        action: 'api.access',
        startDate: yesterday.toISOString(),
        endDate: endDate.toISOString(),
        organizationId: currentOrganization._id
      });
      
      setApiCallsCount(last24HoursResponse.data.data.pagination.total || 0);
      setApiCallsError(null);
    } catch (err) {
      console.error('Failed to fetch API calls data', err);
      setApiCallsError('Failed to load API usage data');
    } finally {
      setApiCallsLoading(false);
    }
  };

  // Prepare chart data for Chart.js
  const chartData = {
    labels: apiCallsData.map(item => item.date),
    datasets: [
      {
        fill: true,
        label: 'API Calls',
        data: apiCallsData.map(item => item.count),
        borderColor: '#6366F1',
        backgroundColor: 'rgba(129, 140, 248, 0.5)',
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (context: any) => context[0].label,
          label: (context: any) => `${context.dataset.label}: ${context.raw}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
    maintainAspectRatio: false,
  };

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
    fetchApiCallsData();
  };

  return (
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
        
        <button
          onClick={handleRefresh}
          className="flex items-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          disabled={loading || apiCallsLoading}
        >
          <RefreshCw size={16} className={`mr-2 ${(loading || apiCallsLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {/* Error display if applicable */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">Error Loading Organization</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          value={apiCallsLoading ? '-' : apiCallsCount}
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
            {apiCallsLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : apiCallsError ? (
              <div className="text-center text-red-500 py-16">
                <p>{apiCallsError}</p>
                <button 
                  onClick={fetchApiCallsData}
                  className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <p className="text-sm font-medium mb-3">API Calls (Last 7 days)</p>
                <div className="w-full max-w-xl h-52">
                  <Line data={chartData} options={{
                    ...chartOptions,
                    elements: {
                      line: {
                        borderWidth: 2
                      },
                      point: {
                        radius: 3,
                        hoverRadius: 5
                      }
                    }
                  }} />
                </div>
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
  );
}