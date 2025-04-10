'use client';

import { useEffect } from 'react';
import { Key, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/admin/Card';
import PageHeader from '@/components/admin/PageHeader';

export default function ClientDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // If the user isn't authenticated, wait for auth
    if (!user) return;
  }, [user]);

  return (
    <main className="p-6">
      <PageHeader
        title="Client Dashboard"
        description={`Welcome back${user?.firstName ? ', ' + user.firstName : ''}!`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div 
          onClick={() => router.push('/api-keys')}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <Card>
            <Card.Body className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 mr-4">
                <Key className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
                <p className="text-gray-600">Manage your API keys to access Syntropi services</p>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div
          onClick={() => router.push('/activities')}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <Card>
            <Card.Body className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 mr-4">
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Activity Logs</h3>
                <p className="text-gray-600">View your recent account activities</p>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </main>
  );
} 