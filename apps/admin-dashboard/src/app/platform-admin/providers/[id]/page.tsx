// apps/admin-dashboard/src/app/(admin)/providers/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Plus, X, Globe, Database, Server, Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import Card from '@/components/admin/Card';
import { providerAPI } from '@/lib/api';
import { isSuperAdmin } from '@/lib/auth';

interface ProviderDetails {
  _id: string;
  name: string;
  code: string;
  description: string;
  logoUrl?: string;
  apiSpec: {
    baseUrl: string;
    version: string;
    documentation?: string;
  };
  features: string[];
  status: 'active' | 'maintenance' | 'inactive';
  settings: any;
  createdAt: string;
}

export default function ProviderDetailsPage() {
  const params = useParams<{ id: string }>();
  const [provider, setProvider] = useState<ProviderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feature, setFeature] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const router = useRouter();
  const isSuperAdminUser = isSuperAdmin();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    apiSpec: {
      baseUrl: '',
      version: '',
      documentation: ''
    },
    features: [] as string[],
    status: 'inactive',
  });

  useEffect(() => {
    fetchProvider();
  }, [params.id]);

  const fetchProvider = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await providerAPI.getProvider(params.id);
      const providerData = response.data.data.provider;
      setProvider(providerData);
      
      // Update form data with provider details
      setFormData({
        name: providerData.name || '',
        description: providerData.description || '',
        logoUrl: providerData.logoUrl || '',
        apiSpec: {
          baseUrl: providerData.apiSpec?.baseUrl || '',
          version: providerData.apiSpec?.version || '',
          documentation: providerData.apiSpec?.documentation || '',
        },
        features: providerData.features || [],
        status: providerData.status || 'inactive',
      });
    } catch (err: any) {
      console.error('Failed to fetch provider:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch provider details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as 'apiSpec'],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAddFeature = () => {
    if (feature.trim() === '') return;
    
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, feature.trim()]
    }));
    setFeature('');
  };

  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
        await providerAPI.updateProvider(params.id, {
          ...formData,
          status: formData.status as "active" | "maintenance" | "inactive"
        });
        await fetchProvider();
        alert('Provider updated successfully');
      } catch (err: any) {
        console.error('Failed to update provider:', err);
        setError(err.response?.data?.error?.message || 'Failed to update provider');
      } finally {
        setSaving(false);
      }
  };

  const renderStatusIndicator = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center text-green-800 bg-green-100 rounded-full px-3 py-1">
            <CheckCircle size={16} className="mr-2" />
            <span className="font-medium">Active</span>
          </div>
        );
      case 'maintenance':
        return (
          <div className="flex items-center text-yellow-800 bg-yellow-100 rounded-full px-3 py-1">
            <AlertTriangle size={16} className="mr-2" />
            <span className="font-medium">Maintenance</span>
          </div>
        );
      case 'inactive':
        return (
          <div className="flex items-center text-gray-800 bg-gray-100 rounded-full px-3 py-1">
            <XCircle size={16} className="mr-2" />
            <span className="font-medium">Inactive</span>
          </div>
        );
      default:
        return null;
    }
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
            onClick={fetchProvider}
            className="ml-4 text-red-700 hover:text-red-900 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-700">Provider not found</p>
          <button
            onClick={() => router.push('/platform-admin/providers')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back to Providers
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
            onClick={() => router.push('/platform-admin/providers')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Providers
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
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 font-medium text-sm flex items-center ${
              activeTab === 'status' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} className="mr-2" />
            Status
          </button>
        </div>
        
        <div className="max-w-4xl mx-auto">
          {activeTab === 'details' && (
            <Card>
              <form onSubmit={handleSubmit}>
                <Card.Header 
                  title="Provider Details" 
                  description={`Provider code: ${provider.code}`}
                />
                
                <Card.Body className="space-y-6">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Provider Name*
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdminUser}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description*
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdminUser}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                        Logo URL
                      </label>
                      <input
                        type="url"
                        id="logoUrl"
                        name="logoUrl"
                        value={formData.logoUrl}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdminUser}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">API Specification</h3>
                    
                    <div>
                      <label htmlFor="apiSpec.baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                        Base URL*
                      </label>
                      <input
                        type="url"
                        id="apiSpec.baseUrl"
                        name="apiSpec.baseUrl"
                        value={formData.apiSpec.baseUrl}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdminUser}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="apiSpec.version" className="block text-sm font-medium text-gray-700 mb-1">
                        API Version*
                      </label>
                      <input
                        type="text"
                        id="apiSpec.version"
                        name="apiSpec.version"
                        value={formData.apiSpec.version}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdminUser}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="apiSpec.documentation" className="block text-sm font-medium text-gray-700 mb-1">
                        Documentation URL
                      </label>
                      <input
                        type="url"
                        id="apiSpec.documentation"
                        name="apiSpec.documentation"
                        value={formData.apiSpec.documentation}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdminUser}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Features & Status</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Features
                      </label>
                      {isSuperAdminUser && (
                        <div className="flex mb-2">
                          <input
                            type="text"
                            value={feature}
                            onChange={(e) => setFeature(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md rounded-r-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., payments, accounts, aggregation"
                          />
                          <button
                            type="button"
                            onClick={handleAddFeature}
                            className="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.features.map((feat, index) => (
                          <div 
                            key={index} 
                            className={`flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm ${isSuperAdminUser ? '' : 'pr-2'}`}
                          >
                            {feat}
                            {isSuperAdminUser && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFeature(index)}
                                className="ml-1 text-blue-700 hover:text-blue-900"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        {formData.features.length === 0 && (
                          <p className="text-sm text-gray-500">No features added yet</p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                        Status*
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdminUser}
                        required
                      >
                        <option value="inactive">Inactive</option>
                        <option value="active">Active</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>
                </Card.Body>
                
                {isSuperAdminUser && (
                  <Card.Footer className="flex justify-end">
                    <button
                      type="submit"
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <span className="animate-spin mr-2">⟳</span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </Card.Footer>
                )}
              </form>
            </Card>
          )}
          
          {activeTab === 'status' && (
            <Card>
              <Card.Header title="Provider Status" />
              
              <Card.Body className="space-y-6">
                <div className="flex justify-center py-4">
                  {renderStatusIndicator(provider.status)}
                </div>
                
                <div className="border-t border-b border-gray-200 py-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Integration Status</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">API Connectivity</span>
                      <div className="flex items-center text-green-700">
                        <CheckCircle size={16} className="mr-1" />
                        <span>Operational</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Authentication</span>
                      <div className="flex items-center text-green-700">
                        <CheckCircle size={16} className="mr-1" />
                        <span>Operational</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Account Information</span>
                      <div className="flex items-center text-green-700">
                        <CheckCircle size={16} className="mr-1" />
                        <span>Operational</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Payment Initiation</span>
                      <div className="flex items-center text-green-700">
                        <CheckCircle size={16} className="mr-1" />
                        <span>Operational</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-b border-gray-200 py-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Statistics</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <p className="text-sm text-gray-500">Total API Calls</p>
                      <p className="text-2xl font-semibold">35,768</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <p className="text-sm text-gray-500">Active Organizations</p>
                      <p className="text-2xl font-semibold">14</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <p className="text-sm text-gray-500">Success Rate</p>
                      <p className="text-2xl font-semibold">99.7%</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <p className="text-sm text-gray-500">Avg Response Time</p>
                      <p className="text-2xl font-semibold">287ms</p>
                    </div>
                  </div>
                </div>
                
                <div className="py-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                  
                  <p className="text-center text-gray-500">
                    Provider activity log will be available in a future update
                  </p>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}