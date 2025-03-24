'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import Card from '@/components/admin/Card';
import { providerAPI } from '@/lib/api';
import { isSuperAdmin } from '@/lib/auth';

export default function CreateProviderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feature, setFeature] = useState('');
  const isSuperAdminUser = isSuperAdmin();
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    logoUrl: '',
    apiSpec: {
      baseUrl: '',
      version: '',
      documentation: ''
    },
    features: [] as string[],
    status: 'inactive',
    settings: {}
  });

  useEffect(() => {
    // Redirect if not a super admin
    if (!isSuperAdminUser) {
      router.push('/platform-admin/providers');
    }
  }, [isSuperAdminUser, router]);

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
    setLoading(true);
    setError(null);
  
    try {
      await providerAPI.createProvider({
        ...formData,
        status: formData.status as "inactive" | "active" | "maintenance"
      });
      router.push('/platform-admin/providers');
    } catch (err: any) {
      console.error('Failed to create provider:', err);
      setError(err.response?.data?.error?.message || 'Failed to create provider');
    } finally {
      setLoading(false);
    }
  };

  // Don't render the form if not a super admin
  if (!isSuperAdminUser) {
    return (
      <div className="p-6">
        <div className="flex justify-center my-12">
          <div className="text-center">
            <p className="text-red-600 font-medium">Admin access required</p>
            <p className="text-gray-500 mt-2">You don't have permission to access this page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>      
      <main className="p-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Providers
          </button>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Card>
            <Card.Header title="Add New Provider" />
            
            <form onSubmit={handleSubmit}>
              <Card.Body className="space-y-6">
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                  
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
                      required
                      placeholder="e.g., Token.io, Yapily"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                      Provider Code*
                    </label>
                    <input
                      type="text"
                      id="code"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      placeholder="e.g., token, yapily"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Unique code used to identify this provider in the system
                    </p>
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
                      required
                      placeholder="Brief description of the provider and its services"
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
                      placeholder="https://example.com/logo.png"
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
                      required
                      placeholder="https://api.provider.com"
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
                      required
                      placeholder="e.g., 1.0, v2"
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
                      placeholder="https://docs.provider.com"
                    />
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Features & Status</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Features
                    </label>
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
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.features.map((feat, index) => (
                        <div 
                          key={index} 
                          className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                        >
                          {feat}
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature(index)}
                            className="ml-1 text-blue-700 hover:text-blue-900"
                          >
                            <X size={14} />
                          </button>
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
                      required
                    >
                      <option value="inactive">Inactive</option>
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Set to "Inactive" until the integration is fully tested and ready for use
                    </p>
                  </div>
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
                      Create Provider
                    </>
                  )}
                </button>
              </Card.Footer>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}