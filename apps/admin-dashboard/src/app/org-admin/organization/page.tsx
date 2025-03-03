// src/app/org-admin/organization/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Building2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/admin/Card';
import { organizationAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function OrgAdminOrganizationPage() {
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    billingEmail: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
    settings: {
      webhookUrl: '',
    },
  });

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    setLoading(true);
    setError(null);
    
    if (!currentUser?.organizationId) {
      setError('No organization associated with current user');
      setLoading(false);
      return;
    }
    
    try {
      const response = await organizationAPI.getOrganization(currentUser.organizationId);
      const orgData = response.data.data.organization;
      setOrganization(orgData);
      
      // Update form data with organization details
      setFormData({
        name: orgData.name || '',
        contactEmail: orgData.contactEmail || '',
        billingEmail: orgData.billingEmail || '',
        address: {
          street: orgData.address?.street || '',
          city: orgData.address?.city || '',
          state: orgData.address?.state || '',
          zipCode: orgData.address?.zipCode || '',
          country: orgData.address?.country || '',
        },
        settings: {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev],
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await organizationAPI.updateOrganization(currentUser!.organizationId, formData);
      // Refresh organization data
      await fetchOrganization();
      alert('Organization updated successfully');
    } catch (err: any) {
      console.error('Failed to update organization:', err);
      setError(err.response?.data?.error?.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
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
        <Header title="Organization Settings" />
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Header title="Organization Settings" />
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

  return (
    <div>
      <Header title="Organization Settings" />
      
      <main className="p-6">
        <div className="max-w-4xl mx-auto">
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
                
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-4 rounded-full text-blue-600">
                    <Building2 size={32} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{organization.name}</h2>
                    <div className="mt-1">
                      Plan: {renderPlanBadge(organization.plan)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
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
                    <p className="text-xs text-gray-500 mt-1">Leave blank to use contact email for billing</p>
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
                  <h3 className="text-lg font-medium text-gray-900">Integration Settings</h3>
                  
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
                    <p className="text-xs text-gray-500 mt-1">URL to receive event notifications</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <h4 className="font-medium text-sm">Available Integration Providers</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {organization.settings?.allowedProviders?.map((provider: string) => (
                        <span key={provider} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {provider}
                        </span>
                      )) || (
                        <p className="text-sm text-gray-500">No providers configured</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Contact support to enable additional providers
                    </p>
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
        </div>
      </main>
    </div>
  );
}