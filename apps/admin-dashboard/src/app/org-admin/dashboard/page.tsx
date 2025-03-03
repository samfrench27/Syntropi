'use client';

import React, { useEffect, useState, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Key, 
  Activity,
  TrendingUp,
  ArrowUpRight,
  Settings,
  RefreshCw
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/admin/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { organizationAPI, userAPI, apiKeyAPI } from '@/lib/api';
import { debugLog } from '@/lib/debug';
import { getOrganizationId } from '@/lib/auth';

interface DashboardStats {
  organizationId: string;
  name: string;
  plan: string;
  userCount: number;
  apiKeyCount: number;
  activeApiCalls: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    positive: boolean;
  };
  icon: ReactNode;
  onClick?: () => void;
  loading?: boolean;
}

export default function OrgAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directFetchInProgress, setDirectFetchInProgress] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const { currentOrganization, loading: orgLoading, error: orgError, refreshOrganization } = useOrganization();
  
  // Add timeout mechanism to prevent infinite loading
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Emergency direct data fetching that doesn't depend on context
  // Emergency direct data fetching that doesn't depend on context
const emergencyFetchData = async () => {
  debugLog('OrgAdminDashboard', 'EMERGENCY FETCH', { userId: user?.id });
  
  if (!user) {
    setLoading(false);
    setError("No user found");
    return;
  }
  
  try {
    // Get organization ID from anywhere possible
    const orgId = getOrganizationId();
    
    // If we don't have an organization ID from getOrganizationId, try direct extraction from user object
    let directOrgId = null;
    if (!orgId && user) {
      // This verbose approach is intentional to capture every possible structure
      if (user.organization) {
        if (typeof user.organization === 'string') {
          directOrgId = user.organization;
          debugLog('OrgAdminDashboard', 'Found org ID as string', { directOrgId });
        } else if (typeof user.organization === 'object') {
          directOrgId = user.organization.id || user.organization._id;
          debugLog('OrgAdminDashboard', 'Found org ID in object', { 
            directOrgId,
            userOrg: user.organization 
          });
        }
      }
    }
    
    // Use either the extracted ID or the direct one
    const finalOrgId = orgId || directOrgId;
    
    if (!finalOrgId) {
      // Log the full user object to help debug
      debugLog('OrgAdminDashboard', 'No organization ID found in user', { 
        user,
        hasOrgField: !!user.organization,
        orgFieldType: typeof user.organization
      }, true);
      throw new Error("No organization ID found");
    }
    
    // Direct fetch organization using the ID we found
    debugLog('OrgAdminDashboard', 'Emergency fetching organization', { finalOrgId });
    
    // Try the API call with the ID we found
    const orgResponse = await organizationAPI.getOrganization(finalOrgId);
    const organization = orgResponse.data.data.organization;
    
    // Set basic stats 
    setStats({
      organizationId: organization._id,
      name: organization.name,
      plan: organization.plan || 'free',
      userCount: orgResponse.data.data.stats?.userCount || 0,
      apiKeyCount: orgResponse.data.data.stats?.apiKeyCount || 0,
      activeApiCalls: 254 // Mock data
    });
    
    setError(null);
  } catch (err: any) {
    debugLog('OrgAdminDashboard', 'Emergency fetch failed', { error: err }, true);
    setError(`Failed to load dashboard data: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

  // Special helper to handle the Emergency Load button click
// In src/app/org-admin/dashboard/page.tsx - add this to the file

const handleEmergencyLoad = async () => {
  debugLog('OrgAdminDashboard', 'Manual emergency load initiated', {});
  
  setLoading(true);
  setError(null);
  
  try {
    // Hard-code the organization ID from the logs for now
    // This is a temporary fix until we resolve the proper data structure
    const orgId = "67c4838d9528d82a26c39dd9"; // Your organization ID here
    
    debugLog('OrgAdminDashboard', 'Using hardcoded organization ID for emergency', { orgId });
    
    // Try to get organization with this ID
    const orgResponse = await organizationAPI.getOrganization(orgId);
    const organization = orgResponse.data.data.organization;
    
    // Log success
    debugLog('OrgAdminDashboard', 'Emergency load with hardcoded ID succeeded', { 
      name: organization.name
    });
    
    // Set stats for display
    setStats({
      organizationId: organization._id,
      name: organization.name,
      plan: organization.plan || 'free',
      userCount: orgResponse.data.data.stats?.userCount || 0,
      apiKeyCount: orgResponse.data.data.stats?.apiKeyCount || 0,
      activeApiCalls: 254 // Mock data
    });
    
    // Store this organization ID in localStorage for future use
    if (typeof window !== 'undefined') {
      localStorage.setItem('emergency_org_id', orgId);
      debugLog('OrgAdminDashboard', 'Saved emergency org ID to localStorage', { orgId });
    }
    
    setError(null);
  } catch (err) {
    debugLog('OrgAdminDashboard', 'Manual emergency load failed', { error: err }, true);
    if (err instanceof Error) {
      setError(`Emergency load failed: ${err.message}`);
    } else {
      setError('Emergency load failed: Unknown error');
    }
  } finally {
    setLoading(false);
  }
};

// Then add this button in the error display section:
{error && (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
    <p className="font-bold">Error Loading Dashboard</p>
    <p>{error}</p>
    <button 
      onClick={handleEmergencyLoad}
      className="mt-2 underline text-red-700 hover:text-red-900"
    >
      Try Emergency Load
    </button>
  </div>
)}


  // Direct data fetching fallback if context approach fails
  const fetchDataDirectly = async () => {
    if (!user || directFetchInProgress) return;
    
    setDirectFetchInProgress(true);
    debugLog('OrgAdminDashboard', 'Fetching data directly', { userId: user.id });
    
    try {
      // Extract organization ID from various possible places
      const orgId = getOrganizationId();
      
      if (!orgId) {
        throw new Error("No organization ID found for direct fetch");
      }
      
      // Fetch organization data directly
      const orgResponse = await organizationAPI.getOrganization(orgId);
      const organization = orgResponse.data.data.organization;
      
      // Get counts directly
      let userCount = 0;
      let apiKeyCount = 0;
      
      try {
        // Default to stats in response if available
        if (orgResponse.data.data.stats) {
          userCount = orgResponse.data.data.stats.userCount || 0;
          apiKeyCount = orgResponse.data.data.stats.apiKeyCount || 0;
        } else {
          // Otherwise fetch counts directly
          const usersResponse = await userAPI.getUsers({ 
            organizationId: orgId,
            limit: 1
          });
          const apiKeysResponse = await apiKeyAPI.getApiKeys({
            organizationId: orgId,
            limit: 1
          });
          
          userCount = usersResponse.data.data.pagination.total || 0;
          apiKeyCount = apiKeysResponse.data.data.pagination.total || 0;
        }
      } catch (countError) {
        debugLog('OrgAdminDashboard', 'Error fetching counts', { error: countError }, true);
        // Continue with zeros if counts fetch fails
      }
      
      // Set stats with the data we have
      setStats({
        organizationId: organization._id,
        name: organization.name,
        plan: organization.plan || 'free',
        userCount: userCount,
        apiKeyCount: apiKeyCount,
        activeApiCalls: 254 // Mock data
      });
      
      setError(null);
    } catch (err) {
      debugLog('OrgAdminDashboard', 'Direct fetch failed', { error: err }, true);
      setError("Failed to load dashboard data directly");
    } finally {
      setLoading(false);
      setDirectFetchInProgress(false);
    }
  };

  // Setup timeout to prevent infinite loading
  useEffect(() => {
    // Set timeout for 3 seconds - if still loading after that, do emergency fetch
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        debugLog('OrgAdminDashboard', 'TIMEOUT TRIGGERED', { loading, orgLoading });
        emergencyFetchData();
      }
    }, 3000);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // First try: Use organization context
  useEffect(() => {
    if (orgLoading) {
      debugLog('OrgAdminDashboard', 'Waiting for organization context', { loading: true });
      return;
    }

    // Clear timeout if context finished loading
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (orgError) {
      debugLog('OrgAdminDashboard', 'Organization context error', { error: orgError }, true);
      setError(`Context error: ${orgError}`);
      // If context fails, try direct fetching
      fetchDataDirectly();
      return;
    }
    
    // If we have an organization from context, use it
    if (currentOrganization) {
      debugLog('OrgAdminDashboard', 'Using organization from context', { 
        org: currentOrganization._id,
        stats: currentOrganization.stats
      });
      
      try {
        setStats({
          organizationId: currentOrganization._id,
          name: currentOrganization.name,
          plan: currentOrganization.plan,
          userCount: (currentOrganization as any).stats?.userCount || 0,
          apiKeyCount: (currentOrganization as any).stats?.apiKeyCount || 0,
          activeApiCalls: 254 // Mock data for now
        });
        setError(null);
      } catch (err) {
        debugLog('OrgAdminDashboard', 'Failed to process organization data', { error: err }, true);
        setError('Failed to process organization data');
        // If processing fails, try direct fetching
        fetchDataDirectly();
      } finally {
        setLoading(false);
      }
    } else {
      debugLog('OrgAdminDashboard', 'No organization in context', {}, true);
      // If no organization in context, try direct fetching
      fetchDataDirectly();
    }
  }, [currentOrganization, orgLoading, orgError]);

  // Refresh handler for manual refresh
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to refresh organization context first
      await refreshOrganization();
      // If that doesn't work, fetchDataDirectly will be triggered by the useEffect
    } catch (err) {
      debugLog('OrgAdminDashboard', 'Refresh failed', { error: err }, true);
      // Direct fetch will happen in the useEffect
    }
  };

  // Stat card component for dashboard metrics
  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon, 
    onClick,
    loading: cardLoading = false
  }: StatCardProps) => (
    <div onClick={onClick} className={onClick ? "cursor-pointer" : ""}>
      <Card className="hover:shadow-md transition-shadow">
        <Card.Body>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-2xl font-semibold mt-1">
                {loading || cardLoading ? (
                  <span className="h-8 w-16 bg-gray-200 rounded animate-pulse"></span>
                ) : (
                  value
                )}
              </p>
              {change && (
                <p className={`text-xs flex items-center mt-1 ${change.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {change.positive ? '+' : '-'}{Math.abs(change.value)}%
                  <TrendingUp size={12} className="ml-1" />
                </p>
              )}
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
              {icon}
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );

  return (
    <div>
      <Header title="Organization Dashboard" />
      
      <main className="p-6">
        {/* Organization header with refresh button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            {stats ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{stats.name}</h1>
                <p className="text-gray-500">
                  Plan: <span className="font-medium">
                    {stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1)}
                  </span>
                </p>
              </>
            ) : loading ? (
              <div className="space-y-2">
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">Organization Dashboard</h1>
            )}
          </div>
          
          <button
            onClick={handleRefresh}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        {/* Error display if applicable */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-bold">Error Loading Dashboard</p>
            <p>{error}</p>
            <button 
              onClick={emergencyFetchData}
              className="mt-2 underline text-red-700 hover:text-red-900"
            >
              Try Emergency Load
            </button>
          </div>
        )}
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title="Users" 
            value={stats?.userCount || 0} 
            change={{ value: 5.2, positive: true }}
            icon={<Users size={24} />} 
            onClick={() => router.push('/org-admin/users')}
            loading={loading}
          />
          <StatCard 
            title="API Keys" 
            value={stats?.apiKeyCount || 0} 
            change={{ value: 3.8, positive: true }}
            icon={<Key size={24} />} 
            onClick={() => router.push('/org-admin/api-keys')}
            loading={loading}
          />
          <StatCard 
            title="API Calls (24h)" 
            value={stats?.activeApiCalls || 0} 
            change={{ value: 5.2, positive: true }}
            icon={<ArrowUpRight size={24} />} 
            onClick={() => router.push('/org-admin/activities')}
            loading={loading}
          />
        </div>

        {/* Activity and Usage cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <Card.Header title="Recent Activity" />
            <Card.Body className="h-64">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse mt-2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-16">
                  <Activity size={36} className="mx-auto mb-2 opacity-40" />
                  <p>Recent activities will appear here</p>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header title="API Usage" />
            <Card.Body className="h-64">
              <div className="text-center text-gray-500 py-16">
                <ArrowUpRight size={36} className="mx-auto mb-2 opacity-40" />
                <p>API usage analytics will appear here</p>
              </div>
            </Card.Body>
          </Card>
        </div>
        
        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onClick={() => router.push('/org-admin/users/create')} className="cursor-pointer">
              <Card className="hover:shadow-md transition-shadow">
                <Card.Body>
                  <div className="flex flex-col items-center justify-center py-4">
                    <Users size={24} className="mb-2 text-blue-600" />
                    <h3 className="font-medium text-center">Add New User</h3>
                  </div>
                </Card.Body>
              </Card>
            </div>
            
            <div onClick={() => router.push('/org-admin/api-keys/create')} className="cursor-pointer">
              <Card className="hover:shadow-md transition-shadow">
                <Card.Body>
                  <div className="flex flex-col items-center justify-center py-4">
                    <Key size={24} className="mb-2 text-blue-600" />
                    <h3 className="font-medium text-center">Create API Key</h3>
                  </div>
                </Card.Body>
              </Card>
            </div>
            
            <div onClick={() => router.push('/org-admin/organization')} className="cursor-pointer">
              <Card className="hover:shadow-md transition-shadow">
                <Card.Body>
                  <div className="flex flex-col items-center justify-center py-4">
                    <Settings size={24} className="mb-2 text-blue-600" />
                    <h3 className="font-medium text-center">Organization Settings</h3>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}