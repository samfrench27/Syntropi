'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import Card from '@/components/admin/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import api from '@/lib/api';

interface Payment {
  paymentId: string;
  status: string;
  provider: string;
  organizationId: string;
  amount: { value: string; currency: string };
  toAccount: { accountName: string; sortCode?: string; accountNumber?: string };
  fromAccount?: { accountName: string; sortCode?: string; accountNumber?: string };
  description?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    details?: string;
  }>;
}

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  const paymentId = params.paymentId as string;

  useEffect(() => {
    if (paymentId) {
      fetchPaymentDetails();
    }
  }, [paymentId]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch payment details
      const paymentResponse = await api.get(`/admin/payments/${paymentId}`);
      const paymentData = paymentResponse.data?.data?.payment || paymentResponse.data?.payment;
      
      if (!paymentData) {
        console.error('Payment not found');
        return;
      }
      
      setPayment(paymentData);
    } catch (error) {
      console.error('Error fetching payment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      setTimeout(() => setCopying(false), 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopying(false);
    }
  };

  const formatCurrency = (amount: { value: string; currency: string }) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: amount.currency
    }).format(parseFloat(amount.value));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': case 'ACCEPTED': return 'text-green-600 bg-green-100';
      case 'PENDING': case 'AUTHORIZING': return 'text-yellow-600 bg-yellow-100';
      case 'FAILED': case 'REJECTED': return 'text-red-600 bg-red-100';
      case 'CANCELLED': return 'text-gray-600 bg-gray-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': case 'ACCEPTED': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED': case 'REJECTED': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'PENDING': case 'AUTHORIZING': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4 text-gray-600" />;
      default: return <AlertCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>
        <Card>
          <Card.Body>
            <div className="text-center py-12">
              <p className="text-gray-500">Payment not found</p>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
            <p className="text-gray-600">Complete payment information and status history</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchPaymentDetails}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Payment Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Details */}
        <Card>
          <Card.Header title="Payment Information" />
          <Card.Body>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Payment ID</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-900 font-mono">{payment.paymentId}</span>
                  <button
                    onClick={() => copyToClipboard(payment.paymentId)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Status</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(payment.status)}
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                    {payment.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Amount</span>
                <span className="text-lg font-semibold text-gray-900">{formatCurrency(payment.amount)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Provider</span>
                <span className="text-sm text-gray-900">{payment.provider}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Organization</span>
                <span className="text-sm text-gray-900">{currentOrganization?.name || 'Unknown'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Created</span>
                <span className="text-sm text-gray-900">
                  {new Date(payment.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Last Updated</span>
                <span className="text-sm text-gray-900">
                  {new Date(payment.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Account Details */}
        <Card>
          <Card.Header title="Account Information" />
          <Card.Body>
            <div className="space-y-6">
              {/* To Account */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">To Account</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Account Name</span>
                    <span className="text-sm text-gray-900">{payment.toAccount.accountName}</span>
                  </div>
                  {payment.toAccount.sortCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Sort Code</span>
                      <span className="text-sm text-gray-900 font-mono">{payment.toAccount.sortCode}</span>
                    </div>
                  )}
                  {payment.toAccount.accountNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Account Number</span>
                      <span className="text-sm text-gray-900 font-mono">{payment.toAccount.accountNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* From Account */}
              {payment.fromAccount && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">From Account</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Account Name</span>
                      <span className="text-sm text-gray-900">{payment.fromAccount.accountName}</span>
                    </div>
                    {payment.fromAccount.sortCode && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Sort Code</span>
                        <span className="text-sm text-gray-900 font-mono">{payment.fromAccount.sortCode}</span>
                      </div>
                    )}
                    {payment.fromAccount.accountNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Account Number</span>
                        <span className="text-sm text-gray-900 font-mono">{payment.fromAccount.accountNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Details */}
              {(payment.description || payment.reference) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Additional Information</h4>
                  <div className="space-y-2">
                    {payment.description && (
                      <div className="flex items-start justify-between">
                        <span className="text-sm text-gray-500">Description</span>
                        <span className="text-sm text-gray-900 text-right max-w-xs">{payment.description}</span>
                      </div>
                    )}
                    {payment.reference && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Reference</span>
                        <span className="text-sm text-gray-900 font-mono">{payment.reference}</span>
                      </div>
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
              {payment.statusHistory.map((history, index) => (
                <li key={index}>
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
                          </p>
                          {history.details && (
                            <p className="mt-1 text-sm text-gray-500">{history.details}</p>
                          )}
                        </div>
                        <div className="text-right text-sm whitespace-nowrap text-gray-500">
                          <time dateTime={history.timestamp}>
                            {new Date(history.timestamp).toLocaleString()}
                          </time>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card.Body>
      </Card>

      {copying && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}
