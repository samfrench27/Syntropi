// apps/admin-dashboard/src/app/(admin)/users/[id]/page.tsx
'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteParams } from '@/lib/useRouteParams';
import { ArrowLeft, Save, Building2, Activity, Key } from 'lucide-react';
import Card from '@/components/admin/Card';
import { userAPI, organizationAPI } from '@/lib/api';
import { isSuperAdmin } from '@/lib/auth';

interface UserDetails {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  organization: {
    _id: string;
    name: string;
  };
  isVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Organization {
  _id: string;
  name: string;
}

interface Activity {
  _id: string;
  action: string;
  details: any;
  createdAt: string;
}

export default function UserDetailsPage() {
  const params = useRouteParams<{ id: string }>('/platform-admin/users/[id]');
  const [user, setUser] = useState<UserDetails | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const router = useRouter();
  const isSuperAdminUser = isSuperAdmin();
  const userId = params.id;
  
  const isCreateMode = userId === 'create';
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    status: 'active',
    organizationId: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    // Skip fetching if we're in create mode
    if (!isCreateMode) {
      fetchUser();
    }
    fetchOrganizations();
  }, [userId, isCreateMode]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivities();
    }
  }, [activeTab]);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      // Only attempt to fetch if not in create mode
      if (!isCreateMode) {
        const response = await userAPI.getUser(userId);
        const userData = response.data.data.user;
        setUser(userData);
        
        // Update form data with user details
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          role: userData.role || '',
          status: userData.status || 'active',
          organizationId: userData.organization?._id || '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch user:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await organizationAPI.getOrganizations({ limit: 100 });
      setOrganizations(response.data.data.organizations);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      const response = await userAPI.getUserActivities(userId);
      setActivities(response.data.data.activities);
    } catch (err: any) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Check if password fields are filled and match
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      setSaving(false);
      return;
    }

    try {
        if (isCreateMode) {
          // Handle user creation
          await userAPI.createUser({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            role: formData.role,
            organizationId: formData.organizationId,
            password: formData.newPassword, // Required for new users
          });
          alert('User created successfully');
          router.push('/platform-admin/users'); // Redirect to users list
        } else {
          // Handle user update (your existing code)
          const updateData = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            role: formData.role,
            status: formData.status,
            ...(formData.newPassword && { password: formData.newPassword }),
          };
  
          if (isSuperAdminUser && formData.organizationId !== user?.organization?._id) {
            // Organization update logic
          }
  
          await userAPI.updateUser(userId, updateData);
          await fetchUser();
          alert('User updated successfully');
        }
      } catch (err: any) {
        console.error(`Failed to ${isCreateMode ? 'create' : 'update'} user:`, err);
        setError(err.response?.data?.error?.message || `Failed to ${isCreateMode ? 'create' : 'update'} user`);
      } finally {
        setSaving(false);
      }
    };

  const renderRoleBadge = (role: string) => {
    let badgeClass = '';
    
    switch (role) {
      case 'superadmin':
        badgeClass = 'bg-red-100 text-red-800';
        break;
      case 'admin':
        badgeClass = 'bg-purple-100 text-purple-800';
        break;
      case 'user':
        badgeClass = 'bg-blue-100 text-blue-800';
        break;
      default:
        badgeClass = 'bg-gray-100 text-gray-800';
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
        {role}
      </span>
    );
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

  if (loading && !isCreateMode) {
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
            onClick={fetchUser}
            className="ml-4 text-red-700 hover:text-red-900 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user && !isCreateMode) {
  return (
    <div className="p-6">
      <div className="text-center py-12">
        <p className="text-gray-700">User not found</p>
        <button
          onClick={() => router.push('/platform-admin/users')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Back to Users
        </button>
      </div>
    </div>
  );
}

  return (
    <div className="flex flex-col min-h-screen">
      <main className="p-6 flex-1 overflow-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/platform-admin/users')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Users
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
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`px-4 py-2 font-medium text-sm flex items-center ${
              activeTab === 'api-keys' 
                ? 'text-blue-600 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Key size={16} className="mr-2" />
            API Keys
          </button>
        </div>
        
        <div className="max-w-4xl mx-auto">
          {activeTab === 'details' && (
            <Card>
              <form onSubmit={handleSubmit}>
              <Card.Header 
                title={isCreateMode ? "Create New User" : "User Details"}
                description={isCreateMode ? "Add a new user to the platform" : user ? `Created on ${new Date(user.createdAt).toLocaleDateString()}` : ''}
                />
                
                <Card.Body className="space-y-6">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        First Name*
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name*
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address*
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isCreateMode ? 'bg-gray-50' : ''}`}
                        disabled={!isCreateMode} // Only disabled in edit mode
                        required
                        />
                        {!isCreateMode && <p className="text-xs text-gray-500 mt-1">Email address cannot be changed</p>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                        Role*
                      </label>
                      <select
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={!isSuperAdminUser && user?.role === 'superadmin'}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        {isSuperAdminUser && <option value="superadmin">Super Admin</option>}
                      </select>
                      {!isSuperAdminUser && user?.role === 'superadmin' && (
                        <p className="text-xs text-gray-500 mt-1">Only super admins can edit super admin roles</p>
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
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700 mb-1">
                      Organization*
                    </label>
                    <select
                      id="organizationId"
                      name="organizationId"
                      value={formData.organizationId}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={!isSuperAdminUser}
                    >
                      <option value="">Select an organization</option>
                      {organizations.map(org => (
                        <option key={org._id} value={org._id}>{org.name}</option>
                      ))}
                    </select>
                    {!isSuperAdminUser && (
                      <p className="text-xs text-gray-500 mt-1">Only super admins can change organizations</p>
                    )}
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                    <p className="text-sm text-gray-500">Leave blank to keep the current password.</p>
                    
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        minLength={8}
                      />
                      <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                    </div>
                    
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            {isCreateMode ? "Create User" : "Save Changes"}
                        </>
                        )}
                  </button>
                </Card.Footer>
              </form>
            </Card>
          )}
          
          {activeTab === 'activity' && (
            <Card>
              <Card.Header title="User Activity" />
              
              {loadingActivities ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading activity...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>No activity recorded for this user.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activities.map((activity) => (
                        <tr key={activity._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">{activity.action}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500">
                              {JSON.stringify(activity.details)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(activity.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
          
          {activeTab === 'api-keys' && (
            <Card>
              <Card.Header 
                title="API Keys" 
                action={
                  <button
                    onClick={() => router.push(`/platform-admin/api-keys/create?userId=${user?._id}`)}
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
        </div>
      </main>
    </div>
  );
}