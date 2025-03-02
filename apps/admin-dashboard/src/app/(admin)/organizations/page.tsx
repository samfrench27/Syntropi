// apps/admin-dashboard/src/app/(admin)/organizations/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, RefreshCw, Edit, Trash2, MoreHorizontal, Building } from 'lucide-react';
import Header from '@/components/layout/Header';
import { organizationAPI } from '@/lib/api';
import { isSuperAdmin } from '@/lib/auth';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';

interface Organization {
  _id: string;
  name: string;
  plan: string;
  status: string;
  contactEmail: string;
  createdAt: string;
  ownerId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();
  const isSuperAdminUser = isSuperAdmin();

  useEffect(() => {
    fetchOrganizations();
  }, [currentPage, searchTerm]);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await organizationAPI.getOrganizations({
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined
      });
      
      setOrganizations(response.data.data.organizations);
      setTotalPages(response.data.data.pagination.pages);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = () => {
    router.push('/organizations/create');
  };

  const handleEditOrganization = (id: string) => {
    router.push(`/organizations/${id}`);
  };

  const handleDeleteOrganization = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this organization?')) {
      return;
    }

    try {
      await organizationAPI.deleteOrganization(id);
      // Refresh the list after deletion
      fetchOrganizations();
    } catch (err: any) {
      console.error('Failed to delete organization:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete organization');
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

  if (error) {
    return (
      <div className="p-6">
        <Header title="Organizations" />
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
          <button 
            onClick={fetchOrganizations}
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
      <Header title="Organizations" />
      
      <main className="p-6">
        <PageHeader
          title="Organizations"
          description="Manage all organizations on the platform"
          action={
            <button
              onClick={handleCreateOrganization}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={16} className="mr-2" />
              New Organization
            </button>
          }
        />
        
        <div className="mb-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={fetchOrganizations}
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
        ) : organizations.length === 0 ? (
          <EmptyState
            title="No organizations found"
            description="Get started by creating your first organization."
            icon={<Building size={24} />}
            action={
              <button
                onClick={handleCreateOrganization}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                New Organization
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
                      Owner
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {organizations.map((org) => (
                    <tr key={org._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-sm text-gray-500">{org.contactEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {org.ownerId ? (
                          <div className="text-sm text-gray-900">
                            {org.ownerId.firstName} {org.ownerId.lastName}
                            <div className="text-xs text-gray-500">{org.ownerId.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No owner</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderPlanBadge(org.plan)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(org.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditOrganization(org._id)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Edit size={16} />
                        </button>
                        {isSuperAdminUser && (
                          <button
                            onClick={() => handleDeleteOrganization(org._id)}
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