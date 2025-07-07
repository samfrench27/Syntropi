import { useState, useEffect } from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { PaymentSession, Bank } from '@/types/payment';

interface PaymentProcessingProps {
  payment: PaymentSession;
  bank: Bank;
}

export default function PaymentProcessing({ payment, bank }: PaymentProcessingProps) {
  const [dots, setDots] = useState('');
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Track time elapsed
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Processing Animation */}
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              {bank.logo && (
                <img 
                  src={bank.logo} 
                  alt={bank.name}
                  className="h-8 w-8 object-contain"
                />
              )}
              <ArrowRight className="h-6 w-6 text-gray-400" />
              <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-gray-500" />
              </div>
            </div>
            
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary-600 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>

          {/* Status */}
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Processing Payment{dots}
          </h2>
          
          <p className="text-gray-600 mb-4">
            We're waiting for {bank.displayName || bank.name} to confirm your payment authorization.
          </p>

          {/* Time Elapsed */}
          <div className="text-sm text-gray-500 mb-6">
            Time elapsed: {formatTime(timeElapsed)}
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> Please complete the authorization in your banking app or browser. 
              Do not close this window - you'll be redirected back here once complete.
            </p>
          </div>

          {/* What's happening */}
          <div className="text-left bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">What's happening?</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ You were redirected to {bank.displayName || bank.name}</li>
              <li>⏳ Waiting for payment authorization</li>
              <li>⏳ Processing payment confirmation</li>
              <li>⏳ Finalizing transaction</li>
            </ul>
          </div>

          {/* Payment Details */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium text-gray-900">
                {new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: payment.amount.currency
                }).format(parseFloat(payment.amount.value))}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Reference:</span>
              <span className="font-mono text-xs text-gray-900">
                {payment.reference || payment.paymentId}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
