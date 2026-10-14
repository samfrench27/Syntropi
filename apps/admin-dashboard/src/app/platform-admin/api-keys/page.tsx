// apps/admin-dashboard/src/app/(admin)/api-keys/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw, EyeOff, Copy, Building2, User, Key, Eye } from 'lucide-react';
import { apiKeyAPI, organizationAPI } from '@/lib/api';
import Card from '@/components/admin/Card';
import MaskedKey from '@/components/admin/MaskedKey';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';

interface ApiKey {
  _id: string;
  name: string;
  keyPrefix?: string;
  environment: 'sandbox' | 'production';
  organization: {
    _id: string;
    name: string;
  };
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

interface Organization {
  _id: string;
  name: string;
}

function ApiKeysPageContent() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOrg, setFilterOrg] = useState<string>('');
  const [filterEnv, setFilterEnv] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Check if there's an organization filter in URL
    const orgId = searchParams.get('organizationId');
    if (orgId) {
      setFilterOrg(orgId);
    }
    
    fetchOrganizations();
    fetchApiKeys();
  }, [searchParams]);
  
  useEffect(() => {
    fetchApiKeys();
  }, [currentPage, searchTerm, filterOrg, filterEnv, filterActive]);

  const fetchOrganizations = async () => {
    try {
      const response = await organizationAPI.getOrganizations({ limit: 100 });
      setOrganizations(response.data.data.organizations);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const fetchApiKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiKeyAPI.getApiKeys({
        page: currentPage,
        limit: 10,
        organizationId: filterOrg || undefined,
        environment: filterEnv as any || undefined,
        isActive: filterActive ? filterActive === 'true' : undefined
      });
      
      setApiKeys(response.data.data.apiKeys);
      setTotalPages(response.data.data.pagination.pages);
    } catch (err: any) {
      console.error('Failed to fetch API keys:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = () => {
    router.push('/platform-admin/api-keys/create');
  };

  const handleViewApiKey = (id: string) => {
    router.push(`/platform-admin/api-keys/${id}`);
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
    <div>
      <main className="p-6">
        <PageHeader
          title="API Keys"
          description="Manage API keys for accessing Syntropi services"
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
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Organizations</option>
                {organizations.map(org => (
                  <option key={org._id} value={org._id}>{org.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1">
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
            
            <div className="flex-1">
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Revoked</option>
              </select>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center my-12">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
          </div>
        ) : apiKeys.length === 0 ? (
          <EmptyState
            title="No API keys found"
            description="Try changing your search filters or create a new API key."
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
                    Key
                  </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created By
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <MaskedKey prefix={apiKey.keyPrefix} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <Building2 size={14} className="mr-1 text-gray-400" />
                          {apiKey.organization?.name || 'Unknown'}
                        </div>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <User size={14} className="mr-1 text-gray-400" />
                          {apiKey.createdBy ? 
                            `${apiKey.createdBy.firstName} ${apiKey.createdBy.lastName}` : 
                            'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewApiKey(apiKey._id)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {apiKey.isActive && (
                          <button
                            onClick={() => handleRevokeApiKey(apiKey._id)}
                            className="text-red-600 hover:text-red-900"
                            title="Revoke API Key"
                          >
                            <EyeOff size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

// useSearchParams needs a Suspense boundary when the dashboard is built as static files
export default function ApiKeysPage() {
  return (
    <React.Suspense fallback={null}>
      <ApiKeysPageContent />
    </React.Suspense>
  );
}
