// src/app/org-admin/api-keys/create/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, X, Copy, AlertCircle } from 'lucide-react';
import Card from '@/components/admin/Card';
import ApiKeyReveal from '@/components/admin/ApiKeyReveal';
import { apiKeyAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function CreateApiKeyPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    environment: 'sandbox',
    permissions: [] as string[]
  });

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
    
    // Check for organization ID
    if (!currentUser?.organizationId) {
      setError('No organization associated with current user');
      setLoading(false);
      return;
    }

    try {
      const response = await apiKeyAPI.createApiKey({
        ...formData,
        organizationId: currentUser.organizationId,
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
    alert('API key copied to clipboard');
  };
  
  const downloadApiKey = (text: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = 'secret.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
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
        <Card>
          {newApiKey ? (
            <>
              <Card.Header title="API Key Created Successfully" />
              <Card.Body className="space-y-6">
                <ApiKeyReveal apiKey={newApiKey} />

                <div className="flex justify-between">
                  <button
                    onClick={() => router.push('/org-admin/api-keys')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      setNewApiKey(null);
                      setFormData({
                        name: '',
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
            </>
          ) : (
            <>
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
            </>
          )}
        </Card>
      </div>
    </main>
  );
}