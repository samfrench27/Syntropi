'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Key, Activity, TrendingUp, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';
import { apiKeyAPI, activityAPI } from '@/lib/api';
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

interface ApiCallData {
  date: string;
  count: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    positive: boolean;
  };
  icon: ReactNode;
  loading?: boolean;
}

export default function ClientDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState(0);
  const [apiCallsCount, setApiCallsCount] = useState(0);
  const [apiCallsData, setApiCallsData] = useState<ApiCallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dashboard data on component mount
  useEffect(() => {
    // If the user isn't authenticated, wait for auth
    if (!user) return;
    
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get API Keys count - filter by user ID if available
      const apiKeysResponse = await apiKeyAPI.getApiKeys({ 
        limit: 0,
        // Optional: Only fetch keys for the current user if API supports it
        ...(user?.id && { userId: user.id })
      });
      setApiKeys(apiKeysResponse.data.data.pagination.total || 0);
      
      // Get data for the last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
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
      
      const last24HoursResponse = await activityAPI.getActivities({
        limit: 0,
        action: 'api.access',
        startDate: yesterday.toISOString(),
        endDate: endDate.toISOString(),
        // Optional: Only fetch activities for current user if API supports it
        ...(user?.id && { userId: user.id })
      });
      
      setApiCallsCount(last24HoursResponse.data.data.pagination.total || 0);
      
      // Fetch data for API calls chart
      const apiCallsResponse = await activityAPI.getActivities({
        limit: 1000,
        action: 'api.access',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        // Optional: Only fetch activities for current user if API supports it
        ...(user?.id && { userId: user.id })
      });
      
      const activities = apiCallsResponse.data.data.activities || [];
      
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
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data', err);
      // More detailed error message
      setError(err?.response?.data?.message || 'Failed to load dashboard data. Please try again later.');
      
      // Ensure we have default data for the chart even when there's an error
      if (apiCallsData.length === 0) {
        setApiCallsData(
          Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return {
              date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              count: 0
            };
          })
        );
      }
    } finally {
      setLoading(false);
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

  // Stat card component
  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon 
  }: StatCardProps) => (
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
          <div className="p-3 bg-soft-lavender rounded-full text-syntropi-purple">
            {icon}
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  return (
    <main className="p-6 bg-background-light">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Dashboard"
          description={`Welcome back${user?.firstName ? ', ' + user.firstName : ''}!`}
        />
        
        <button
          onClick={fetchDashboardData}
          className="flex items-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error display if applicable */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4 mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-8">
        <StatCard 
          title="API Keys" 
          value={apiKeys} 
          change={{ value: 3.8, positive: true }}
          icon={<Key size={24} />} 
        />
        <StatCard 
          title="API Calls (24h)" 
          value={apiCallsCount}
          change={{ value: 5.2, positive: true }}
          icon={<ArrowUpRight size={24} />} 
        />
      </div>
      
      {/* API Calls Chart */}
      <Card className="mb-8">
        <Card.Header title="Recent Activity" />
        <Card.Body className="h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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

      {/* Quick access cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          onClick={() => router.push('/client-dashboard/api-keys')}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <Card>
            <Card.Body className="flex items-center">
              <div className="p-3 rounded-full bg-soft-lavender mr-4">
                <Key className="h-8 w-8 text-syntropi-purple" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-text-primary">API Keys</h3>
                <p className="text-text-secondary">Manage your API keys to access Syntropi services</p>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div
          onClick={() => router.push('/client-dashboard/activities')}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <Card>
            <Card.Body className="flex items-center">
              <div className="p-3 rounded-full bg-soft-lavender mr-4">
                <Activity className="h-8 w-8 text-syntropi-purple" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-text-primary">Activity Logs</h3>
                <p className="text-text-secondary">View your recent account activities</p>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </main>
  );
} 