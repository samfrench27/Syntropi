import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, ArrowRight, Shield } from 'lucide-react';
import { PaymentSession } from '@/types/payment';

interface PaymentResultProps {
  payment: PaymentSession;
  onReturnToMerchant: () => void;
}

export default function PaymentResult({ payment, onReturnToMerchant }: PaymentResultProps) {
  const [countdown, setCountdown] = useState(15);
  const [autoRedirect, setAutoRedirect] = useState(true);

  // Auto redirect countdown
  useEffect(() => {
    if (!autoRedirect || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onReturnToMerchant();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, autoRedirect, onReturnToMerchant]);

  const getStatusConfig = () => {
    switch (payment.status) {
      case 'COMPLETED':
        return {
          icon: <CheckCircle className="h-16 w-16 text-green-500" />,
          title: 'Payment Successful',
          description: 'Your payment has been completed successfully.',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800'
        };
      case 'FAILED':
        return {
          icon: <XCircle className="h-16 w-16 text-red-500" />,
          title: 'Payment Failed',
          description: 'Your payment could not be completed. Please try again or contact support.',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800'
        };
      case 'CANCELLED':
        return {
          icon: <XCircle className="h-16 w-16 text-gray-500" />,
          title: 'Payment Cancelled',
          description: 'You cancelled the payment process.',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800'
        };
      default:
        return {
          icon: <Clock className="h-16 w-16 text-yellow-500" />,
          title: 'Payment Pending',
          description: 'Your payment is being processed. You will receive confirmation shortly.',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800'
        };
    }
  };

  const statusConfig = getStatusConfig();

  const formatAmount = (amount: { value: string; currency: string }) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: amount.currency
    }).format(parseFloat(amount.value));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Result Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Status Icon */}
          <div className="mb-6">
            {statusConfig.icon}
          </div>

          {/* Status Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {statusConfig.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-gray-600 mb-8">
            {statusConfig.description}
          </p>

          {/* Payment Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-bold text-2xl text-gray-900">
                  {formatAmount(payment.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">To</span>
                <span className="text-gray-900">{payment.toAccount.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reference</span>
                <span className="text-gray-900 font-mono text-sm">
                  {payment.reference || payment.paymentId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  payment.status === 'COMPLETED' ? 'status-completed' :
                  payment.status === 'FAILED' ? 'status-failed' :
                  'status-pending'
                }`}>
                  {payment.status}
                </span>
              </div>
            </div>
          </div>

          {/* Auto Redirect Notice */}
          {payment.status === 'COMPLETED' && autoRedirect && countdown > 0 && (
            <div className={`${statusConfig.bgColor} ${statusConfig.borderColor} border rounded-lg p-4 mb-6`}>
              <p className={`${statusConfig.textColor} font-medium`}>
                You will be redirected to the merchant in {countdown} seconds.
              </p>
              <button
                onClick={() => setAutoRedirect(false)}
                className="text-sm underline mt-2"
              >
                Cancel auto-redirect
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onReturnToMerchant}
              className="w-full flex items-center justify-center space-x-2 bg-primary-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <span>Return to Merchant</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            {payment.status === 'FAILED' && (
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Try Payment Again
              </button>
            )}
          </div>

          {/* Security Information */}
          {payment.status === 'COMPLETED' && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <Shield className="h-4 w-4" />
                <span>Payment processed securely via Syntropi</span>
              </div>
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            For support or questions about this payment, please contact the merchant directly.
          </p>
          {payment.status === 'COMPLETED' && (
            <p className="mt-2">
              Payment reference: <span className="font-mono">{payment.paymentId}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
