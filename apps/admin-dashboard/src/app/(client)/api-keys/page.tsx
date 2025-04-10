'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw, Key } from 'lucide-react';
import { apiKeyAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
  
  useEffect(() => {
    fetchApiKeys();
  }, [currentPage, searchTerm, filterEnv]);

  const fetchApiKeys = async () => {
    setLoading(true);
    setError(null);
    
    if (!currentUser?.organizationId) {
      setError('No organization associated with current user');
      setLoading(false);
      return;
    }
    
    try {
      const response = await apiKeyAPI.getApiKeys({
        page: currentPage,
        limit: 10,
        organizationId: currentUser.organizationId,
        environment: filterEnv as any || undefined
      });
      
      // Filter API keys client-side to only show keys created by this user
      const filteredApiKeys = response.data.data.apiKeys.filter(
        (key: ApiKey) => key.createdBy._id === currentUser.id
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
    router.push('/api-keys/create');
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
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-blue-100 text-blue-800';
    
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={fetchApiKeys}
            className="ml-4 text-red-700 hover:text-red-900 underline"
          >
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
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search API keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={fetchApiKeys}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </button>
        </div>
        
        <div>
          <select
            value={filterEnv}
            onChange={(e) => setFilterEnv(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Environments</option>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center my-12">
          <RefreshCw size={24} className="animate-spin text-blue-600" />
        </div>
      ) : apiKeys.length === 0 ? (
        <EmptyState
          title="No API keys found"
          description="Get started by creating your first API key."
          icon={<Key size={24} />}
          action={
            <button
              onClick={handleCreateApiKey}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Environment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                          className="text-red-600 hover:text-red-900 ml-3"
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
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex-1 flex justify-between">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 border rounded-md text-sm font-medium ${
                    currentPage === 1
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
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
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
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