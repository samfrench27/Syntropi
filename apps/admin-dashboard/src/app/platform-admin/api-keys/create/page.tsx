// apps/admin-dashboard/src/app/(admin)/api-keys/create/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Copy, AlertCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/admin/Card';
import { apiKeyAPI, organizationAPI } from '@/lib/api';

interface Organization {
  _id: string;
  name: string;
}

export default function CreateApiKeyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    organizationId: '',
    environment: 'sandbox',
    permissions: [] as string[]
  });

  useEffect(() => {
    // Check if there's an organization pre-selected from URL params
    const orgId = searchParams.get('organizationId');
    if (orgId) {
      setFormData(prev => ({
        ...prev,
        organizationId: orgId
      }));
    }
    
    fetchOrganizations();
  }, [searchParams]);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const response = await organizationAPI.getOrganizations({ limit: 100 });
      setOrganizations(response.data.data.organizations);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked 
        ? [...prev.permissions, permission]
        : prev.permissions.filter(p => p !== permission)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
  
    try {
      // Use type assertion to specify that environment is of the required type
      const response = await apiKeyAPI.createApiKey({
        ...formData,
        environment: formData.environment as "sandbox" | "production"
      });
      setNewApiKey(response.data.data.key);
    } catch (err: any) {
      console.error('Failed to create API key:', err);
      setError(err.response?.data?.error?.message || 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <Header title="Create API Key" />
      
      <main className="p-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to API Keys
          </button>
        </div>
        
        <div className="max-w-3xl mx-auto">
          {newApiKey ? (
            <Card>
              <Card.Header title="API Key Created Successfully" />
              <Card.Body className="space-y-6">
                <div className="rounded-md bg-yellow-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          This API key will only be displayed once. Please save it somewhere secure.
                          You won't be able to retrieve it again.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your API Key
                  </label>
                  <div className="flex items-center">
                    <code className="flex-1 p-3 bg-gray-800 text-white text-sm font-mono rounded overflow-x-auto">
                      {newApiKey}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(newApiKey)}
                      className="ml-2 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      title="Copy to clipboard"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <button
                    onClick={() => router.push('/platform-admin/api-keys')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      setNewApiKey(null);
                      setFormData({
                        name: '',
                        organizationId: formData.organizationId, // Keep the same org
                        environment: 'sandbox',
                        permissions: []
                      });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Another Key
                  </button>
                </div>
              </Card.Body>
            </Card>
          ) : (
            <Card>
              <Card.Header title="Create New API Key" />
              
              <form onSubmit={handleSubmit}>
                <Card.Body className="space-y-6">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      API Key Name*
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g., Production API Key, Test Key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Choose a descriptive name to identify this key
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700 mb-1">
                      Organization*
                    </label>
                    {loadingOrgs ? (
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                        Loading organizations...
                      </div>
                    ) : (
                      <select
                        id="organizationId"
                        name="organizationId"
                        value={formData.organizationId}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select an organization</option>
                        {organizations.map(org => (
                          <option key={org._id} value={org._id}>{org.name}</option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      The organization that will own this API key
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-1">
                      Environment*
                    </label>
                    <select
                      id="environment"
                      name="environment"
                      value={formData.environment}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Sandbox is for testing, Production is for live applications
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Permissions
                    </label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="perm-read"
                          checked={formData.permissions.includes('read')}
                          onChange={(e) => handlePermissionChange('read', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="perm-read" className="ml-2 block text-sm text-gray-700">
                          Read (Access account information and transaction data)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="perm-write"
                          checked={formData.permissions.includes('write')}
                          onChange={(e) => handlePermissionChange('write', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="perm-write" className="ml-2 block text-sm text-gray-700">
                          Write (Initiate payments and transfers)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="perm-webhooks"
                          checked={formData.permissions.includes('webhooks')}
                          onChange={(e) => handlePermissionChange('webhooks', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="perm-webhooks" className="ml-2 block text-sm text-gray-700">
                          Webhooks (Receive event notifications)
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Select the permissions for this API key
                    </p>
                  </div>
                </Card.Body>
                
                <Card.Footer className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save size={16} className="mr-2" />
                        Generate API Key
                      </>
                    )}
                  </button>
                </Card.Footer>
              </form>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}