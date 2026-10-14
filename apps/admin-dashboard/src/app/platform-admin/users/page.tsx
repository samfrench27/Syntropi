// apps/admin-dashboard/src/app/(admin)/users/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw, Edit, Trash2, Building2, Users } from 'lucide-react';
import { userAPI, organizationAPI } from '@/lib/api';
import { isSuperAdmin } from '@/lib/auth';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  organization: {
    _id: string;
    name: string;
  };
  lastLogin?: string;
  createdAt: string;
}

interface Organization {
  _id: string;
  name: string;
}

function UsersPageContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterOrg, setFilterOrg] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperAdminUser = isSuperAdmin();
  
  useEffect(() => {
    // Check if there's an organization filter in URL
    const orgId = searchParams.get('organizationId');
    if (orgId) {
      setFilterOrg(orgId);
    }
    
    fetchOrganizations();
    fetchUsers();
  }, [searchParams]);
  
  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, filterRole, filterOrg, filterStatus]);

  const fetchOrganizations = async () => {
    try {
      const response = await organizationAPI.getOrganizations({ limit: 100 });
      setOrganizations(response.data.data.organizations);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userAPI.getUsers({
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined,
        role: filterRole || undefined,
        organizationId: filterOrg || undefined,
        status: filterStatus || undefined
      });
      
      setUsers(response.data.data.users);
      setTotalPages(response.data.data.pagination.pages);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    router.push('/platform-admin/users/create');
  };

  const handleEditUser = (id: string) => {
    router.push(`/platform-admin/users/${id}`);
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await userAPI.deleteUser(id);
      // Refresh the list after deletion
      fetchUsers();
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete user');
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={fetchUsers}
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
          title="Users"
          description="Manage all users on the platform"
          action={
            <button
              onClick={handleCreateUser}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={16} className="mr-2" />
              New User
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
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={fetchUsers}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                {isSuperAdminUser && <option value="superadmin">Super Admin</option>}
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center my-12">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try changing your search filters or create a new user."
            icon={<Users size={24} />}
            action={
              <button
                onClick={handleCreateUser}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                New User
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
                      Organization
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.organization ? (
                          <div className="text-sm text-gray-900 flex items-center">
                            <Building2 size={14} className="mr-1 text-gray-400" />
                            {user.organization.name}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(user.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditUser(user._id)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Edit size={16} />
                        </button>
                        {(isSuperAdminUser || user.role !== 'superadmin') && (
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
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
export default function UsersPage() {
  return (
    <React.Suspense fallback={null}>
      <UsersPageContent />
    </React.Suspense>
  );
}
