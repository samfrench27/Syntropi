// apps/admin-dashboard/src/app/(admin)/api-keys/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, EyeOff, ClipboardCheck, Building2, User, Clock, Calendar, Activity } from 'lucide-react';
import Card from '@/components/admin/Card';
import MaskedKey from '@/components/admin/MaskedKey';
import { apiKeyAPI } from '@/lib/api';

interface ApiKeyDetails {
  _id: string;
  name: string;
  environment: 'sandbox' | 'production';
  permissions: string[];
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
  keyPrefix?: string;
  isActive: boolean;
  lastUsed?: string;
  createdAt: string;
}

interface UsageStats {
  totalRequests: number;
  last30Days: number;
  last7Days: number;
  yesterday: number;
  today: number;
}

export default function ApiKeyDetailsPage() {
  const params = useParams<{ id: string }>();
  const [apiKey, setApiKey] = useState<ApiKeyDetails | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const router = useRouter();

  useEffect(() => {
    fetchApiKey();
  }, [params.id]);

  const fetchApiKey = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiKeyAPI.getApiKey(params.id);
      const apiKeyData = response.data.data.apiKey;
      setApiKey(apiKeyData);
      
      // Set mock usage stats
      setUsageStats({
        totalRequests: 5783,
        last30Days: 1254,
        last7Days: 389,
        yesterday: 42,
        today: 16
      });
    } catch (err: any) {
      console.error('Failed to fetch API key:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch API key details');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!apiKey || !apiKey.isActive) return;
    
    if (!window.confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }

    try {
      await apiKeyAPI.revokeApiKey(params.id);
      // Refresh API key data
      fetchApiKey();
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

  const renderPermissionBadges = (permissions: string[]) => {
    if (!permissions || permissions.length === 0) {
      return <span className="text-gray-500 text-sm">No permissions assigned</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {permissions.map(permission => (
          <span 
            key={permission}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
          >
            {permission}
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={fetchApiKey}
            className="ml-4 text-red-700 hover:text-red-900 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-700">API key not found</p>
          <button
            onClick={() => router.push('/platform-admin/api-keys')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back to API Keys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="p-6">
        <div className="mb-6">
          <button
            onClick={() => router.push('/platform-admin/api-keys')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to API Keys
          </button>
        </div>
        
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'details' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-4 py-2 font-medium text-sm flex items-center ${
              activeTab === 'usage' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} className="mr-2" />
            Usage
          </button>
        </div>
        
        <div className="max-w-4xl mx-auto">
          {activeTab === 'details' && (
            <Card>
              <Card.Header 
                title="API Key Details" 
                action={
                  apiKey.isActive && (
                    <button
                      onClick={handleRevokeApiKey}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      <EyeOff size={16} className="mr-2" />
                      Revoke Key
                    </button>
                  )
                }
              />
              
              <Card.Body className="space-y-6">
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">API Key ID</h3>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        apiKey.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {apiKey.isActive ? 'Active' : 'Revoked'}
                      </span>
                      {renderEnvironmentBadge(apiKey.environment)}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <code className="text-sm font-mono text-gray-700">
                      {apiKey._id}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(apiKey._id)}
                      className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                      title="Copy to clipboard"
                    >
                      <ClipboardCheck size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Key</h3>
                    <MaskedKey prefix={apiKey.keyPrefix} className="text-gray-900" />
                    <p className="mt-1 text-xs text-gray-500">The full key is only shown once, when it is created.</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Name</h3>
                    <p className="text-gray-900">{apiKey.name}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Organization</h3>
                    <div className="flex items-center">
                      <Building2 size={16} className="text-gray-400 mr-2" />
                      <p className="text-gray-900">{apiKey.organization.name}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Created By</h3>
                    <div className="flex items-center">
                      <User size={16} className="text-gray-400 mr-2" />
                      <p className="text-gray-900">
                        {apiKey.createdBy ? 
                          `${apiKey.createdBy.firstName} ${apiKey.createdBy.lastName} (${apiKey.createdBy.email})` : 
                          'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Created At</h3>
                    <div className="flex items-center">
                      <Calendar size={16} className="text-gray-400 mr-2" />
                      <p className="text-gray-900">{new Date(apiKey.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {apiKey.lastUsed && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-1">Last Used</h3>
                      <div className="flex items-center">
                        <Clock size={16} className="text-gray-400 mr-2" />
                        <p className="text-gray-900">{new Date(apiKey.lastUsed).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Permissions</h3>
                    {renderPermissionBadges(apiKey.permissions)}
                  </div>
                </div>
                
                {!apiKey.isActive && (
                  <div className="bg-red-50 p-4 rounded border border-red-200">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <EyeOff className="h-5 w-5 text-red-400" aria-hidden="true" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">API Key Revoked</h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>
                            This API key has been revoked and can no longer be used for authentication.
                            Create a new API key if you need to restore access.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
          
          {activeTab === 'usage' && usageStats && (
            <Card>
              <Card.Header title="API Key Usage" />
              
              <Card.Body className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="text-sm text-gray-500">Total Requests</p>
                    <p className="text-2xl font-semibold">{usageStats.totalRequests.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="text-sm text-gray-500">Last 30 Days</p>
                    <p className="text-2xl font-semibold">{usageStats.last30Days.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="text-sm text-gray-500">Last 7 Days</p>
                    <p className="text-2xl font-semibold">{usageStats.last7Days.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="text-sm text-gray-500">Yesterday</p>
                    <p className="text-2xl font-semibold">{usageStats.yesterday.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="text-sm text-gray-500">Today</p>
                    <p className="text-2xl font-semibold">{usageStats.today.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-lg font-medium mb-4">Usage Over Time</h3>
                  <div className="h-64 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
                    <p className="text-gray-500">Usage graph will be available in a future update</p>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}