'use client';

import React, { useEffect, useState, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Calendar, Filter, User, Building2, Code, Shield, Settings, 
         Activity as ActivityIcon, ArrowRight } from 'lucide-react';
import { activityAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

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

export default function ClientActivitiesPage() {
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
  const { user } = useAuth();
  const { currentOrganization, loading: orgLoading, error: orgError } = useOrganization();
  
  const itemsPerPage = 10;

  const fetchActivities = async (page = 1) => {
    if (!currentOrganization?._id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        organizationId: currentOrganization._id
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (filterAction) params.append('action', filterAction);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      
      const response = await fetch(`/api/activities?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      
      const data = await response.json();
      
      setActivities(data.activities || []);
      setTotalPages(Math.ceil(data.total / itemsPerPage) || 1);
      setCurrentPage(page);
    } catch (err: unknown) {
      console.error('Error fetching activities:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch activities';
      setError(errorMessage);
      toast.error('Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchActivities(currentPage);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities(1); // Reset to first page on search
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterAction('');
    setStartDate('');
    setEndDate('');
    fetchActivities(1); // Reset to first page
  };

  const areFiltersActive = searchTerm || filterAction || startDate || endDate;

  useEffect(() => {
    if (currentOrganization?._id && !orgLoading) {
      fetchActivities(currentPage);
    }
  }, [currentOrganization, orgLoading, currentPage]);

  const getActionCategoryColor = (action: string) => {
    if (action.startsWith('admin.')) {
      return 'bg-soft-lavender text-syntropi-purple';
    } else if (action.startsWith('user.')) {
      return 'bg-[#E0F2FE] text-syntropi-blue';
    } else if (action.startsWith('organization.')) {
      return 'bg-green-100 text-green-800';
    } else if (action.startsWith('api.')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (action.startsWith('system.')) {
      return 'bg-red-100 text-red-800';
    } else if (action.startsWith('client.')) {
      return 'bg-[#E0F2FE] text-syntropi-blue';
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

  const handlePreviousPage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (currentPage > 1) {
      fetchActivities(currentPage - 1);
    }
  };

  const handleNextPage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (currentPage < totalPages) {
      fetchActivities(currentPage + 1);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={() => fetchActivities(1)}
            className="ml-4 text-red-700 hover:text-red-900 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="p-6 bg-background-light">
      <PageHeader
        title="Activity Logs"
        description="View your account activity history"
      />
      
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-text-secondary" />
            </div>
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
            />
          </div>
          
          <button
            onClick={() => fetchActivities(currentPage)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-soft-lavender text-text-primary"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
              placeholder="End Date"
            />
          </div>
          
          <div className="flex justify-end">
            {(filterAction || startDate || endDate) && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-syntropi-blue hover:text-syntropi-purple border border-syntropi-blue hover:border-syntropi-purple rounded-md hover:bg-soft-lavender transition-colors"
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-syntropi-purple"></div>
          </div>
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          title="No activities found"
          description="Try adjusting your filters or check again later."
          icon={<ActivityIcon size={24} className="text-syntropi-purple" />}
        />
      ) : (
        <>
          <Card>
            <Card.Body>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-background-light">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Action
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Time
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activities.map((activity) => (
                      <tr key={activity._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`p-1 rounded-md mr-2 ${getActionCategoryColor(activity.action)}`}>
                              {getActionIcon(activity.action)}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatActivityAction(activity.action)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(activity.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="max-w-sm overflow-hidden text-ellipsis">
                            {JSON.stringify(activity.details || {})}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex-1 flex justify-between">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-text-primary hover:bg-soft-lavender"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-4 py-2 ml-3 border border-gray-300 text-text-primary hover:bg-soft-lavender"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
} 