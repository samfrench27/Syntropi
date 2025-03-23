// src/app/org-admin/activities/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Calendar, Filter, User, Building2, Code, Shield, Settings, 
         Activity as ActivityIcon } from 'lucide-react';
import Header from '@/components/layout/Header';
import { activityAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';


interface ActivityLog {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  action: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export default function OrgAdminActivitiesPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  useEffect(() => {
    fetchActivities();
  }, [currentPage, searchTerm, filterAction, startDate, endDate]);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    
    if (!currentUser?.organizationId) {
      setError('No organization associated with current user');
      setLoading(false);
      return;
    }
    
    try {
      const response = await activityAPI.getActivities({
        page: currentPage,
        limit: 20,
        organizationId: currentUser.organizationId,
        action: filterAction || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      
      setActivities(response.data.data.activities);
      setTotalPages(response.data.data.pagination.pages);
    } catch (err: any) {
      console.error('Failed to fetch activities:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterAction('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const getActionCategoryColor = (action: string) => {
    if (action.startsWith('admin.')) {
      return 'bg-purple-100 text-purple-800';
    } else if (action.startsWith('user.')) {
      return 'bg-blue-100 text-blue-800';
    } else if (action.startsWith('organization.')) {
      return 'bg-green-100 text-green-800';
    } else if (action.startsWith('api.')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (action.startsWith('system.')) {
      return 'bg-red-100 text-red-800';
    } else if (action.startsWith('client.')) {
      return 'bg-indigo-100 text-indigo-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  const formatActivityAction = (action: string) => {
    return action.replace(/\./g, ' › ').replace(/^./, str => str.toUpperCase());
  };

  const getActionIcon = (action: string) => {
    if (action.startsWith('admin.')) {
      return <Shield size={16} />;
    } else if (action.startsWith('user.')) {
      return <User size={16} />;
    } else if (action.startsWith('organization.')) {
      return <Building2 size={16} />;
    } else if (action.startsWith('api.')) {
      return <Code size={16} />;
    } else if (action.startsWith('system.')) {
      return <Settings size={16} />;
    } else if (action.startsWith('client.')) {
      return <User size={16} />;
    } else {
      return <ActivityIcon size={16} />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const uniqueActions = Array.from(new Set(activities.map(a => a.action))).sort();

  if (error) {
    return (
      <div className="p-6">
        <Header title="Activity Logs" />
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={fetchActivities}
            className="ml-4 text-red-700 hover:text-red-900 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Activity Logs" />
      
      <main className="p-6">
        <PageHeader
          title="Activity Logs"
          description="Audit trail of all organization activities"
        />
        
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={fetchActivities}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>
                    {formatActivityAction(action)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Start Date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="End Date"
              />
            </div>
            
            <div className="flex justify-end">
              {(filterAction || startDate || endDate) && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="py-8">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            title="No activities found"
            description="Try adjusting your filters or check again later."
            icon={<ActivityIcon size={24} />}
          />
        ) : (
          <>
            <Card>
              <Card.Body>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          IP Address
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activities.map((activity) => (
                        <tr key={activity._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(activity.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {activity.user ? `${activity.user.firstName} ${activity.user.lastName}` : 'System'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {activity.user?.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionCategoryColor(activity.action)}`}>
                              <span className="mr-1">{getActionIcon(activity.action)}</span>
                              {formatActivityAction(activity.action)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {JSON.stringify(activity.details)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {activity.ipAddress || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
            
            {/* Pagination Controls */}
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-700">
                Showing page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => p < totalPages ? p + 1 : p)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}