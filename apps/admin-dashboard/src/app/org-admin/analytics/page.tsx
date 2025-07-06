'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  TrendingUp, 
  Activity,
  CreditCard,
  Filter,
  RefreshCw
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Card from '@/components/admin/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { analyticsAPI, paymentsAPI, apiKeyAPI } from '@/lib/api';
import api from '@/lib/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsData {
  daily: { date: string; banks: number; payments: number }[];
  summary: {
    totalBankCalls: number;
    totalPayments: number;
    bankCallsChange: number;
    paymentsChange: number;
  };
}

interface Payment {
  paymentId: string;
  status: string;
  provider: string;
  amount: { value: string; currency: string };
  toAccount: { accountName: string };
  createdAt: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    details?: string;
  }>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  loading?: boolean;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const router = useRouter();
  const [endpointFilter, setEndpointFilter] = useState<'all' | 'banks' | 'payments'>('all');
  const [dateRange, setDateRange] = useState(7); // days
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
    fetchPaymentsData();
  }, [endpointFilter, dateRange, currentOrganization]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      // Get activities data using existing endpoint
      const response = await analyticsAPI.getActivities({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        organizationId: currentOrganization?._id,
        limit: 1000
      });

      console.log('Analytics API Response:', response.data);

      // Process the activities data to create analytics
      // Try different response structures
      const activities = response.data.data?.activities || response.data.activities || response.data || [];
      console.log('Activities found:', activities.length, activities);
      
      // Group by date and action type
      const dailyData: { [key: string]: { banks: number; payments: number } } = {};
      
      for (let i = 0; i < dateRange; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        dailyData[dateStr] = { banks: 0, payments: 0 };
      }

      let bankCount = 0;
      let paymentCount = 0;

      activities.forEach((activity: any) => {
        const date = new Date(activity.createdAt).toISOString().split('T')[0];
        if (dailyData[date]) {
          // Use details.endpoint to categorize API calls
          const endpoint = activity.details?.endpoint || '';
          
          // Debug: Log first few activities to see the structure
          if (bankCount + paymentCount < 3) {
            console.log('DEBUG ORG: Activity structure:', {
              action: activity.action,
              endpoint: endpoint,
              details: activity.details
            });
          }
          
          if (endpoint.includes('/api/banks')) {
            dailyData[date].banks++;
            bankCount++;
          } else if (endpoint.includes('/api/payments')) {
            dailyData[date].payments++;
            paymentCount++;
          }
        }
      });

      const daily = Object.entries(dailyData).map(([date, counts]) => ({
        date,
        banks: counts.banks,
        payments: counts.payments
      }));

      const totalBankCalls = daily.reduce((sum, day) => sum + day.banks, 0);
      const totalPayments = daily.reduce((sum, day) => sum + day.payments, 0);

      setAnalyticsData({
        daily,
        summary: {
          totalBankCalls,
          totalPayments,
          bankCallsChange: 0, // Would need historical data to calculate
          paymentsChange: 0
        }
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsData = async () => {
    try {
      setPaymentsLoading(true);
      
      // Use admin payments endpoint (no API key needed)
      const response = await api.get('/admin/payments', {
        params: { 
          limit: 50,
          organizationId: currentOrganization?._id  // Filter by org for org-admin
        }
      });
      
      // Try different response structures
      const payments = response.data.data?.payments || response.data.payments || response.data || [];

      setPayments(payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      // If payments fail, it's not critical for the analytics view
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, loading = false }: StatCardProps) => (
    <Card className="hover:shadow-md transition-shadow">
      <Card.Body>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-semibold mt-1">
              {loading ? (
                <span className="h-8 w-16 bg-gray-200 rounded animate-pulse inline-block"></span>
              ) : (
                value
              )}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-full text-blue-600">
            {icon}
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  const getChartData = () => {
    if (!analyticsData) return null;

    const labels = analyticsData.daily.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    let datasets = [];

    if (endpointFilter === 'all' || endpointFilter === 'banks') {
      datasets.push({
        label: 'Bank API Calls',
        data: analyticsData.daily.map(d => d.banks),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
      });
    }

    if (endpointFilter === 'all' || endpointFilter === 'payments') {
      datasets.push({
        label: 'Payment API Calls',
        data: analyticsData.daily.map(d => d.payments),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
      });
    }

    return { labels, datasets };
  };

  const formatCurrency = (amount: { value: string; currency: string }) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: amount.currency
    }).format(parseFloat(amount.value));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'CANCELLED': return 'text-gray-600 bg-gray-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">API usage and payment analytics</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              fetchAnalyticsData();
              fetchPaymentsData();
            }}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            disabled={loading || paymentsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${(loading || paymentsLoading) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={endpointFilter}
            onChange={(e) => setEndpointFilter(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Endpoints</option>
            <option value="banks">Banks Only</option>
            <option value="payments">Payments Only</option>
          </select>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(parseInt(e.target.value))}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Bank Calls"
          value={analyticsData?.summary.totalBankCalls || 0}
          icon={<BarChart3 className="h-5 w-5" />}
          loading={loading}
        />
        <StatCard
          title="Total Payments"
          value={analyticsData?.summary.totalPayments || 0}
          icon={<CreditCard className="h-5 w-5" />}
          loading={loading}
        />
        <StatCard
          title="Daily Average"
          value={analyticsData ? Math.round((analyticsData.summary.totalBankCalls + analyticsData.summary.totalPayments) / dateRange) : 0}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
        <StatCard
          title="Active Period"
          value={`${dateRange} days`}
          icon={<Activity className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Chart */}
      <Card>
        <Card.Header title="API Usage Over Time" />
        <Card.Body>
          <div className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : getChartData() ? (
              <Line
                data={getChartData()!}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    title: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Payments Table */}
      <Card>
        <Card.Header title="Recent Payments" />
        <Card.Body>
          <div className="overflow-x-auto">
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.paymentId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                        <button
                          onClick={() => router.push(`/org-admin/analytics/payments/${payment.paymentId}`)}
                          className="text-left hover:underline"
                        >
                          {payment.paymentId}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {currentOrganization?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
