// src/app/platform-admin/dashboard/page.tsx
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
import Card from '@/components/admin/Card';
import { organizationAPI, userAPI, apiKeyAPI, activityAPI } from '@/lib/api';
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

interface DashboardStats {
  organizationCount: number;
  userCount: number;
  apiKeyCount: number;
  activeApiCalls: number;
  systemStatus: 'healthy' | 'warning' | 'critical';
}

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
  const [apiCallsData, setApiCallsData] = useState<ApiCallData[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch basic data from existing endpoints
        const [orgsResponse, usersResponse, apiKeysResponse, activitiesResponse] = await Promise.all([
          organizationAPI.getOrganizations({ limit: 0 }),
          userAPI.getUsers({ limit: 0 }),
          apiKeyAPI.getApiKeys({ limit: 0 }),
          activityAPI.getActivities({ 
            limit: 10,
            action: 'api.access'
          })
        ]);
        
        // Count API calls in the last 24 hours
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const apiCallsResponse = await activityAPI.getActivities({
          limit: 0,
          action: 'api.access',
          startDate: yesterday.toISOString(),
          endDate: now.toISOString()
        });
        
        setStats({
          organizationCount: orgsResponse.data.data.pagination.total || 0,
          userCount: usersResponse.data.data.pagination.total || 0,
          apiKeyCount: apiKeysResponse.data.data.pagination.total || 0,
          activeApiCalls: apiCallsResponse.data.data.pagination.total || 0,
          systemStatus: 'healthy',
        });
        
        // Set recent activities
        setRecentActivities(activitiesResponse.data.data.activities || []);
        
        // Fetch data for API calls chart
        await fetchApiCallsChartData();
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);
  
  const fetchApiCallsChartData = async () => {
    try {
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
      
      // Fetch data for each day
      const response = await activityAPI.getActivities({
        limit: 1000,
        action: 'api.access',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
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
    } catch (err) {
      console.error('Failed to fetch API calls chart data', err);
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
  
  // Format activity for display
  const formatActivity = (activity: any) => {
    if (!activity) return null;
    
    let title = 'Unknown Activity';
    let description = '';
    
    switch (activity.action) {
      case 'api.access':
        title = 'API Access';
        description = `Endpoint: ${activity.details?.endpoint || 'Unknown'}, Method: ${activity.details?.method || 'Unknown'}`;
        break;
      case 'user.login':
        title = 'User Login';
        description = `User: ${activity.user?.firstName || ''} ${activity.user?.lastName || ''}`;
        break;
      default:
        title = activity.action.replace(/\./g, ' › ').replace(/^./, (str: string) => str.toUpperCase());
        description = `Organization: ${activity.organization?.name || 'Unknown'}`;
    }
    
    return { title, description };
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
        </div>
      </div>
    );
  }

  return (
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
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <p className="text-sm font-medium mb-3">API Calls (Last 7 days)</p>
                <div className="w-full max-w-xl h-52">
                  <Line data={chartData} options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: {
                        display: false
                      }
                    },
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
            <div className="space-y-4">
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
              <div className="rounded-md bg-yellow-50 p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">TrueLayer API Degraded Performance</h3>
                    <div className="mt-1 text-sm text-yellow-700">
                      <p>Mar 1, 2025 - 14:32</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-md bg-green-50 p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Database Maintenance Completed</h3>
                    <div className="mt-1 text-sm text-green-700">
                      <p>Mar 1, 2025 - 08:15</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>
    </main>
  );
}