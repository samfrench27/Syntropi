'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw, Key } from 'lucide-react';
import { apiKeyAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';

interface ApiKey {
  _id: string;
  name: string;
  environment: 'sandbox' | 'production';
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  isActive: boolean;
  lastUsed?: string;
  createdAt: string;
}

export default function ClientApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterEnv, setFilterEnv] = useState<string>('');
  
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { currentOrganization, loading: orgLoading, error: orgError, refreshOrganization } = useOrganization();
  
  useEffect(() => {
    if (!orgLoading && currentOrganization) {
      fetchApiKeys();
    }
  }, [currentPage, searchTerm, filterEnv, currentOrganization, orgLoading]);

  const handleRefreshOrganization = async () => {
    try {
      await refreshOrganization();
    } catch (err) {
      console.error('Failed to refresh organization data:', err);
    }
  };

  const fetchApiKeys = async () => {
    if (orgLoading) return;
    
    setLoading(true);
    setError(null);
    
    if (!currentOrganization?._id) {
      setError('No organization associated with current user');
      setLoading(false);
      return;
    }
    
    try {
      const response = await apiKeyAPI.getApiKeys({
        page: currentPage,
        limit: 10,
        organizationId: currentOrganization._id,
        environment: filterEnv as any || undefined
      });
      
      // Filter API keys client-side to only show keys created by this user
      const filteredApiKeys = response.data.data.apiKeys.filter(
        (key: ApiKey) => key.createdBy._id === currentUser?.id
      );
      
      setApiKeys(filteredApiKeys);
      
      // Adjust total pages based on client-side filtering
      const totalItems = response.data.data.pagination.total;
      const filteredTotal = Math.ceil(filteredApiKeys.length / 10);
      setTotalPages(filteredTotal > 0 ? filteredTotal : 1);
    } catch (err: any) {
      console.error('Failed to fetch API keys:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = () => {
    router.push('/client-dashboard/api-keys/create');
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }

    try {
      await apiKeyAPI.revokeApiKey(id);
      // Refresh the list after revocation
      fetchApiKeys();
    } catch (err: any) {
      console.error('Failed to revoke API key:', err);
      alert(err.response?.data?.error?.message || 'Failed to revoke API key');
    }
  };

  const renderEnvironmentBadge = (env: string) => {
    const badgeClass = env === 'production' 
      ? 'bg-soft-lavender text-syntropi-purple' 
      : 'bg-[#E0F2FE] text-syntropi-blue';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
        {env}
      </span>
    );
  };

  const renderStatusBadge = (isActive: boolean) => {
    const badgeClass = isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
        {isActive ? 'Active' : 'Revoked'}
      </span>
    );
  };

  if (orgLoading) {
    return (
      <div className="flex justify-center my-12">
        <RefreshCw size={24} className="animate-spin text-syntropi-blue" />
      </div>
    );
  }

  if (orgError || error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 mb-4 text-lg font-medium">{error || orgError}</div>
          <button 
            onClick={handleRefreshOrganization}
            style={{
              background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
              color: 'white',
              padding: '0.5rem 1.5rem',
              borderRadius: '0.375rem',
              transition: 'opacity 150ms'
            }}
            className="inline-flex items-center hover:opacity-90"
          >
            <RefreshCw size={16} className="mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="p-6">
      <PageHeader
        title="API Keys"
        description="Manage your API keys"
        action={
          <button
            onClick={handleCreateApiKey}
            className="flex items-center px-4 py-2 btn-gradient rounded-md"
          >
            <Plus size={16} className="mr-2" />
            New API Key
          </button>
        }
      />
      
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-text-secondary" />
            </div>
            <input
              type="text"
              placeholder="Search API keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
            />
          </div>
          
          <button
            onClick={fetchApiKeys}
            className="flex items-center px-4 py-2 btn-secondary rounded-md"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </button>
        </div>
        
        <div>
          <select
            value={filterEnv}
            onChange={(e) => setFilterEnv(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue"
          >
            <option value="">All Environments</option>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center my-12">
          <RefreshCw size={24} className="animate-spin text-syntropi-purple" />
        </div>
      ) : apiKeys.length === 0 ? (
        <EmptyState
          title="No API keys found"
          description="Get started by creating your first API key."
          icon={<Key size={24} className="text-syntropi-purple" />}
          action={
            <button
              onClick={handleCreateApiKey}
              className="flex items-center px-4 py-2 btn-gradient rounded-md"
            >
              <Plus size={16} className="mr-2" />
              New API Key
            </button>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-background-light">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Environment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {apiKeys.map((apiKey) => (
                  <tr key={apiKey._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{apiKey.name}</div>
                      <div className="text-xs text-gray-500">ID: {apiKey._id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderEnvironmentBadge(apiKey.environment)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStatusBadge(apiKey.isActive)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {apiKey.isActive && (
                        <button
                          onClick={() => handleRevokeApiKey(apiKey._id)}
                          className="text-red-500 hover:text-red-700 transition-colors ml-3"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-background-light border-t border-gray-200 flex items-center justify-between">
              <div className="flex-1 flex justify-between">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 border rounded-md text-sm font-medium ${
                    currentPage === 1
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-text-primary hover:bg-soft-lavender'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`ml-3 px-4 py-2 border rounded-md text-sm font-medium ${
                    currentPage === totalPages
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-text-primary hover:bg-soft-lavender'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </main>
  );
} 