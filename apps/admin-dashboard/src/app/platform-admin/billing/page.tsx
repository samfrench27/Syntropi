'use client';

import { useState, useEffect } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { billingAPI } from '@/lib/api';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface RevenueData {
  totalRevenue: number;
  subscriptionRevenue: number;
  refunds: number;
  netRevenue: number;
}

interface SubscriptionMetrics {
  active: number;
  total: number;
  planDistribution: Array<{ _id: string; count: number }>;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  created: number;
  organization?: {
    name: string;
    plan: string;
  };
  subscription?: {
    plan: string;
    status: string;
  };
}

interface Subscription {
  _id: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  organizationId: {
    name: string;
    contactEmail: string;
    plan: string;
  };
}

export default function PlatformBillingPage() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionMetrics | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      const [revenueRes, customersRes, subscriptionsRes] = await Promise.all([
        billingAPI.getRevenue({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        billingAPI.getCustomers(),
        billingAPI.getSubscriptions()
      ]);

      // Handle revenue data
      if (revenueRes.data.success) {
        setRevenue(revenueRes.data.data.revenue);
        setSubscriptions(revenueRes.data.data.subscriptions);
      }

      // Handle customers data
      if (customersRes.data.success) {
        setCustomers(customersRes.data.data);
      }

      // Handle subscriptions data
      if (subscriptionsRes.data.success) {
        setAllSubscriptions(subscriptionsRes.data.data.subscriptions);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const revenueChartData = {
    labels: ['Total Revenue', 'Net Revenue', 'Refunds'],
    datasets: [
      {
        label: 'Revenue (£)',
        data: revenue ? [revenue.totalRevenue, revenue.netRevenue, revenue.refunds] : [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const planDistributionData = {
    labels: subscriptions?.planDistribution.map(p => p._id.charAt(0).toUpperCase() + p._id.slice(1)) || [],
    datasets: [
      {
        data: subscriptions?.planDistribution.map(p => p.count) || [],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(168, 85, 247, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Billing Dashboard</h1>
          <p className="text-gray-600">Monitor revenue, subscriptions, and customer billing</p>
        </div>
        
        <div className="flex space-x-4">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900">Total Revenue</h3>
          <p className="text-3xl font-bold text-green-600">
            £{revenue?.totalRevenue.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900">Net Revenue</h3>
          <p className="text-3xl font-bold text-blue-600">
            £{revenue?.netRevenue.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900">Active Subscriptions</h3>
          <p className="text-3xl font-bold text-purple-600">
            {subscriptions?.active || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900">Total Customers</h3>
          <p className="text-3xl font-bold text-orange-600">
            {customers.length}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
          <div className="h-64">
            <Line 
              data={revenueChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return '£' + value;
                      }
                    }
                  }
                }
              }} 
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Distribution</h3>
          <div className="h-64">
            <Doughnut 
              data={planDistributionData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }} 
            />
          </div>
        </div>
      </div>

      {/* Recent Subscriptions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Subscriptions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Billing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allSubscriptions.map((subscription) => (
                <tr key={subscription._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {subscription.organizationId.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {subscription.organizationId.contactEmail}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                      {subscription.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      subscription.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {subscription.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button 
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => {
                        // Handle view details
                        toast.success('Subscription details coming soon');
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stripe Account Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stripe Account Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            <p className="text-sm text-gray-600">Total Customers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{subscriptions?.active || 0}</p>
            <p className="text-sm text-gray-600">Active Subscriptions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              £{((revenue?.totalRevenue || 0) / (subscriptions?.active || 1)).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">Avg Revenue per Customer</p>
          </div>
        </div>
        
        <div className="mt-6">
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Open Stripe Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
