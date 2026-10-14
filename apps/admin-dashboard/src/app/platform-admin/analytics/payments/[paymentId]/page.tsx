'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteParams } from '@/lib/useRouteParams';
import { ArrowLeft, Clock, CreditCard, Building, User, Calendar, Activity, CheckCircle, XCircle } from 'lucide-react';
import Card from '@/components/admin/Card';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface Payment {
  paymentId: string;
  status: string;
  provider: string;
  organizationId: string;
  amount: { value: string; currency: string };
  toAccount: { accountName: string; accountNumber?: string; sortCode?: string };
  fromAccount?: { accountName: string; accountNumber?: string; sortCode?: string };
  reference?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    details?: string;
  }>;
}

interface Organization {
  _id: string;
  name: string;
}

export default function PlatformAdminPaymentDetailPage() {
  const params = useRouteParams<{ paymentId: string }>('/platform-admin/analytics/payments/[paymentId]');
  const router = useRouter();
  const { user } = useAuth();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paymentId = params.paymentId as string;

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchData = async () => {
      if (!paymentId) return;
      
      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
        }

        // Fetch payment details with abort signal
        const paymentResponse = await api.get(`/admin/payments/${paymentId}`, {
          signal: abortController.signal
        });
        
        const paymentData = paymentResponse.data?.data?.payment;
        if (!paymentData) throw new Error('Payment not found');
        
        // Only update state if component is still mounted
        if (isMounted) {
          setPayment(paymentData);
        }

        // Fetch organization details if we have organizationId
        if (paymentData?.organizationId && isMounted) {
          try {
            const orgResponse = await api.get(`/admin/organizations/${paymentData.organizationId}`, {
              signal: abortController.signal
            });
            const orgData = orgResponse.data?.data?.organization;
            if (isMounted) {
              setOrganization(orgData);
            }
          } catch (orgError: any) {
            if (orgError.name !== 'AbortError' && orgError.code !== 'ERR_CANCELED') {
              console.error('Error fetching organization:', orgError);
            }
            // Don't fail the whole page if org fetch fails
          }
        }
      } catch (error: any) {
        // Don't log errors if request was aborted
        if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
          console.error('❌ Platform Payment Detail: Error fetching payment details:', error);
          if (isMounted) {
            setError(error?.response?.status === 404 ? 'We could not find that payment.' : error?.response?.data?.error?.message || 'Failed to load payment details');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to prevent state updates and abort requests
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [paymentId]);

  const formatCurrency = (amount: { value: string; currency: string }) => {
    try {
      if (!amount || !amount.value || !amount.currency) {
        return 'N/A';
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: amount.currency
      }).format(parseFloat(amount.value));
    } catch (error) {
      console.warn('Error formatting currency:', error);
      return amount ? `${amount.currency || ''} ${amount.value || ''}` : 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'CANCELLED': return 'text-gray-600 bg-gray-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return dateString;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'PENDING': return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'FAILED': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'CANCELLED': return <XCircle className="h-5 w-5 text-gray-600" />;
      default: return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => router.push('/platform-admin/analytics')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Analytics</span>
          </button>
        </div>
        <Card>
          <Card.Body>
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error || 'Payment not found'}</p>
              <button
                onClick={() => router.push('/platform-admin/analytics')}
                className="text-blue-600 hover:text-blue-800"
              >
                Return to Analytics
              </button>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <button
          onClick={() => router.push('/platform-admin/analytics')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Analytics</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
          <p className="text-gray-600">Payment ID: {payment.paymentId}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(payment.status)}`}>
            {payment.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Information */}
        <Card>
          <Card.Header title="Payment Information" />
          <Card.Body>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-lg font-semibold">{payment.amount ? formatCurrency(payment.amount) : 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Building className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Provider</p>
                  <p className="font-medium">{payment.provider || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Organization</p>
                  <p className="font-medium">{organization?.name || payment.organizationId || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium">{payment.createdAt ? formatDate(payment.createdAt) : 'N/A'}</p>
                </div>
              </div>

              {payment.reference && (
                <div>
                  <p className="text-sm text-gray-500">Reference</p>
                  <p className="font-medium">
                    {typeof payment.reference === 'string' ? payment.reference : JSON.stringify(payment.reference)}
                  </p>
                </div>
              )}

              {payment.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="font-medium">
                    {typeof payment.description === 'string' ? payment.description : JSON.stringify(payment.description)}
                  </p>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>

        {/* Account Information */}
        <Card>
          <Card.Header title="Account Information" />
          <Card.Body>
            <div className="space-y-6">
              {payment.toAccount && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">To Account</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium">{payment.toAccount.accountName || 'N/A'}</p>
                    {payment.toAccount.accountNumber && (
                      <p className="text-sm text-gray-600">Account: {payment.toAccount.accountNumber}</p>
                    )}
                    {payment.toAccount.sortCode && (
                      <p className="text-sm text-gray-600">Sort Code: {payment.toAccount.sortCode}</p>
                    )}
                  </div>
                </div>
              )}

              {payment.fromAccount && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">From Account</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium">{payment.fromAccount.accountName}</p>
                    {payment.fromAccount.accountNumber && (
                      <p className="text-sm text-gray-600">Account: {payment.fromAccount.accountNumber}</p>
                    )}
                    {payment.fromAccount.sortCode && (
                      <p className="text-sm text-gray-600">Sort Code: {payment.fromAccount.sortCode}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Status History */}
      <Card>
        <Card.Header title="Status History" />
        <Card.Body>
          <div className="flow-root">
            <ul className="-mb-8">
              {payment.statusHistory && payment.statusHistory.length > 0 ? (
                payment.statusHistory
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((history, index) => (
                    <li key={`${history.status}-${history.timestamp}-${index}`}>
                      <div className="relative pb-8">
                        {index !== payment.statusHistory.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                              {getStatusIcon(history.status)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900">
                                Status changed to{' '}
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(history.status)}`}>
                                  {history.status}
                                </span>
                                {index === 0 && (
                                  <span className="ml-2 text-xs text-blue-600 font-medium">Current</span>
                                )}
                              </p>
                              {history.details && (
                                <p className="mt-1 text-sm text-gray-500">{history.details}</p>
                              )}
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time dateTime={history.timestamp}>
                                {formatDate(history.timestamp)}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No status history available</p>
                </div>
              )}
            </ul>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
