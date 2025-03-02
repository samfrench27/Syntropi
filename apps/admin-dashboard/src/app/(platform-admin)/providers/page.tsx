// apps/admin-dashboard/src/app/(admin)/providers/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw, Edit, Trash2, Database, Globe, Server } from 'lucide-react';
import Header from '@/components/layout/Header';
import { providerAPI } from '@/lib/api';
import { isSuperAdmin } from '@/lib/auth';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';

interface Provider {
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
  createdAt: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const isSuperAdminUser = isSuperAdmin();

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await providerAPI.getProviders();
      
      // Filter providers based on search term if provided
      const allProviders = response.data.data.providers;
      if (searchTerm) {
        const filteredProviders = allProviders.filter((provider: { name: string; code: string; description: string; }) => 
          provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          provider.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          provider.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setProviders(filteredProviders);
      } else {
        setProviders(allProviders);
      }
    } catch (err: any) {
      console.error('Failed to fetch providers:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Re-filter when search term changes
    if (providers.length > 0) {
      const delayDebounceFn = setTimeout(() => {
        fetchProviders();
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm]);

  const handleCreateProvider = () => {
    router.push('/providers/create');
  };

  const handleEditProvider = (id: string) => {
    router.push(`/providers/${id}`);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this provider? This will affect all organizations using this provider.')) {
      return;
    }

    try {
      await providerAPI.deleteProvider(id);
      // Refresh the list after deletion
      fetchProviders();
    } catch (err: any) {
      console.error('Failed to delete provider:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete provider');
    }
  };

  const renderStatusBadge = (status: string) => {
    let badgeClass = '';
    
    switch (status) {
      case 'active':
        badgeClass = 'bg-green-100 text-green-800';
        break;
      case 'maintenance':
        badgeClass = 'bg-yellow-100 text-yellow-800';
        break;
      case 'inactive':
        badgeClass = 'bg-gray-100 text-gray-800';
        break;
      default:
        badgeClass = 'bg-gray-100 text-gray-800';
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
        {status}
      </span>
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <Header title="Providers" />
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={fetchProviders}
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
      <Header title="Open Banking Providers" />
      
      <main className="p-6">
        <PageHeader
          title="Providers"
          description="Manage Open Banking provider integrations"
          action={
            isSuperAdminUser && (
              <button
                onClick={handleCreateProvider}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                Add Provider
              </button>
            )
          }
        />
        
        <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search providers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={fetchProviders}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center my-12">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            title="No providers found"
            description={searchTerm ? "Try a different search term" : "Add your first Open Banking provider to get started"}
            icon={<Database size={24} />}
            action={
              isSuperAdminUser && (
                <button
                  onClick={handleCreateProvider}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-2" />
                  Add Provider
                </button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((provider) => (
              <Card key={provider._id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{provider.name}</h3>
                    {renderStatusBadge(provider.status)}
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-4">{provider.description}</p>
                  
                  <div className="text-xs text-gray-500 space-y-2 mb-4">
                    <div className="flex items-center">
                      <Globe size={14} className="mr-2 text-gray-400" />
                      <span className="font-mono">{provider.apiSpec.baseUrl}</span>
                    </div>
                    <div className="flex items-center">
                      <Server size={14} className="mr-2 text-gray-400" />
                      <span>API Version: {provider.apiSpec.version}</span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {provider.features.map(feature => (
                        <span 
                          key={feature}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={() => handleEditProvider(provider._id)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Edit size={14} className="mr-1.5" />
                      Details
                    </button>
                    
                    {isSuperAdminUser && (
                      <button
                        onClick={() => handleDeleteProvider(provider._id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm rounded-md text-red-700 bg-white hover:bg-gray-50"
                      >
                        <Trash2 size={14} className="mr-1.5" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}