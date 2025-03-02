'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Users, Key, Activity } from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/admin/Card';
import { organizationAPI, userAPI, apiKeyAPI } from '@/lib/api';
import { isSuperAdmin } from '@/lib/auth';

interface OrganizationDetails {
  _id: string;
  name: string;
  contactEmail: string;
  billingEmail?: string;
  plan: string;
  status: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  settings?: {
    allowedProviders: string[];
    rateLimit: number;
    webhookUrl?: string;
  };
  ownerId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  stats?: {
    userCount: number;
    apiKeyCount: number;
  };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
}

export default function OrganizationDetailsPage({ params }: { params: { id: string } }) {
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const router = useRouter();
  const isSuperAdminUser = isSuperAdmin();
  const organizationId = params.id;
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    billingEmail: '',
    plan: 'free',
    status: 'active',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
    settings: {
      allowedProviders: [] as string[],
      rateLimit: 100,
      webhookUrl: '',
    },
  });
  useEffect(() => {
    fetchOrganization();
  }, [organizationId]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchOrganization = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await organizationAPI.getOrganization(organizationId);
      const orgData = response.data.data.organization;
      setOrganization({
        ...orgData,
        stats: response.data.data.stats
      });
      
      // Update form data with organization details
      setFormData({
        name: orgData.name || '',
        contactEmail: orgData.contactEmail || '',
        billingEmail: orgData.billingEmail || '',
        plan: orgData.plan || 'free',
        status: orgData.status || 'active',
        address: {
          street: orgData.address?.street || '',
          city: orgData.address?.city || '',
          state: orgData.address?.state || '',
          zipCode: orgData.address?.zipCode || '',
          country: orgData.address?.country || '',
        },
        settings: {
          allowedProviders: orgData.settings?.allowedProviders || [],
          rateLimit: orgData.settings?.rateLimit || 100,
          webhookUrl: orgData.settings?.webhookUrl || '',
        },
      });
    } catch (err: any) {
      console.error('Failed to fetch organization:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch organization details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await organizationAPI.getOrganizationUsers(organizationId);
      setUsers(response.data.data.users);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as 'address' | 'settings'],
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

  const handleProviderChange = (provider: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        allowedProviders: checked 
          ? [...prev.settings.allowedProviders, provider]
          : prev.settings.allowedProviders.filter(p => p !== provider)
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await organizationAPI.updateOrganization(organizationId, formData);
      // Refresh data
      await fetchOrganization();
      alert('Organization updated successfully');
    } catch (err: any) {
      console.error('Failed to update organization:', err);
      setError(err.response?.data?.error?.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    let badgeClass = '';
    
    switch (status) {
      case 'active':
        badgeClass = 'bg-green-100 text-green-800';
        break;
      case 'inactive':
        badgeClass = 'bg-gray-100 text-gray-800';
        break;
      case 'suspended':
        badgeClass = 'bg-red-100 text-red-800';
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

  const renderPlanBadge = (plan: string) => {
    let badgeClass = '';
    
    switch (plan) {
      case 'free':
        badgeClass = 'bg-gray-100 text-gray-800';
        break;
      case 'starter':
        badgeClass = 'bg-blue-100 text-blue-800';
        break;
      case 'growth':
        badgeClass = 'bg-purple-100 text-purple-800';
        break;
      case 'enterprise':
        badgeClass = 'bg-indigo-100 text-indigo-800';
        break;
      default:
        badgeClass = 'bg-gray-100 text-gray-800';
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
        {plan}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <Header title="Organization Details" />
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Header title="Organization Details" />
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={fetchOrganization}
            className="ml-4 text-red-700 hover:text-red-900 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-6">
        <Header title="Organization Details" />
        <div className="text-center py-12">
          <p className="text-gray-700">Organization not found</p>
          <button
            onClick={() => router.push('/organizations')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back to Organizations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title={`Organization: ${organization.name}`} />
      
      <main className="p-6">
        <div className="mb-6">
          <button
            onClick={() => router.push('/organizations')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Organizations
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
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium text-sm flex items-center ${
              activeTab === 'users' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} className="mr-2" />
            Users ({organization.stats?.userCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`px-4 py-2 font-medium text-sm flex items-center ${
              activeTab === 'api-keys' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Key size={16} className="mr-2" />
            API Keys ({organization.stats?.apiKeyCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 font-medium text-sm flex items-center ${
              activeTab === 'activity' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} className="mr-2" />
            Activity
          </button>
        </div>
        
        <div className="max-w-6xl mx-auto">
          {activeTab === 'details' && (
            <Card>
              <form onSubmit={handleSubmit}>
                <Card.Header 
                  title="Organization Details" 
                  description={`Created on ${new Date(organization.createdAt).toLocaleDateString()}`}
                />
                
                <Card.Body className="space-y-6">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Organization Name*
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Email*
                      </label>
                      <input
                        type="email"
                        id="contactEmail"
                        name="contactEmail"
                        value={formData.contactEmail}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="billingEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Billing Email
                      </label>
                      <input
                        type="email"
                        id="billingEmail"
                        name="billingEmail"
                        value={formData.billingEmail}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
                        Subscription Plan*
                      </label>
                      <select
                        id="plan"
                        name="plan"
                        value={formData.plan}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={!isSuperAdminUser}
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                      {!isSuperAdminUser && (
                        <p className="text-sm text-gray-500 mt-1">Only super admins can change plan</p>
                      )}
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
                        disabled={!isSuperAdminUser}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      {!isSuperAdminUser && (
                        <p className="text-sm text-gray-500 mt-1">Only super admins can change status</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Address Information</h3>
                    
                    <div>
                      <label htmlFor="address.street" className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        id="address.street"
                        name="address.street"
                        value={formData.address.street}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="address.city" className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          id="address.city"
                          name="address.city"
                          value={formData.address.city}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="address.state" className="block text-sm font-medium text-gray-700 mb-1">
                          State/Province
                        </label>
                        <input
                          type="text"
                          id="address.state"
                          name="address.state"
                          value={formData.address.state}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="address.zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                          Postal/Zip Code
                        </label>
                        <input
                          type="text"
                          id="address.zipCode"
                          name="address.zipCode"
                          value={formData.address.zipCode}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="address.country" className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <input
                          type="text"
                          id="address.country"
                          name="address.country"
                          value={formData.address.country}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Provider Settings</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed Providers
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="provider-token"
                            checked={formData.settings.allowedProviders.includes('token')}
                            onChange={(e) => handleProviderChange('token', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="provider-token" className="ml-2 block text-sm text-gray-700">
                            Token.io
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="provider-yapily"
                            checked={formData.settings.allowedProviders.includes('yapily')}
                            onChange={(e) => handleProviderChange('yapily', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="provider-yapily" className="ml-2 block text-sm text-gray-700">
                            Yapily
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="provider-truelayer"
                            checked={formData.settings.allowedProviders.includes('truelayer')}
                            onChange={(e) => handleProviderChange('truelayer', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="provider-truelayer" className="ml-2 block text-sm text-gray-700">
                            TrueLayer
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="provider-tink"
                            checked={formData.settings.allowedProviders.includes('tink')}
                            onChange={(e) => handleProviderChange('tink', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="provider-tink" className="ml-2 block text-sm text-gray-700">
                            Tink
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="settings.rateLimit" className="block text-sm font-medium text-gray-700 mb-1">
                        API Rate Limit (requests per minute)
                      </label>
                      <input
                        type="number"
                        id="settings.rateLimit"
                        name="settings.rateLimit"
                        value={formData.settings.rateLimit}
                        onChange={handleChange}
                        min="10"
                        max="10000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="settings.webhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook URL
                      </label>
                      <input
                        type="url"
                        id="settings.webhookUrl"
                        name="settings.webhookUrl"
                        value={formData.settings.webhookUrl}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/webhook"
                      />
                    </div>
                  </div>
                </Card.Body>
                
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
              </form>
            </Card>
          )}
          
          {activeTab === 'users' && (
            <Card>
              <Card.Header 
                title="Organization Users" 
                action={
                  <button
                    onClick={() => router.push(`/users/create?organizationId=${organization._id}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add User
                  </button>
                }
              />
              <div className="overflow-x-auto">
                {loadingUsers ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading users...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>No users found in this organization.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderStatusBadge(user.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => router.push(`/users/${user.id}`)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )}
          
          {activeTab === 'api-keys' && (
            <Card>
              <Card.Header 
                title="API Keys" 
                action={
                  <button
                    onClick={() => router.push(`/api-keys/create?organizationId=${organization._id}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create API Key
                  </button>
                }
              />
              <Card.Body>
                <p className="text-center text-gray-500 py-4">
                  API keys management will be implemented in a future update.
                </p>
              </Card.Body>
            </Card>
          )}
          
          {activeTab === 'activity' && (
            <Card>
              <Card.Header title="Activity Log" />
              <Card.Body>
                <p className="text-center text-gray-500 py-4">
                  Activity log will be implemented in a future update.
                </p>
              </Card.Body>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}