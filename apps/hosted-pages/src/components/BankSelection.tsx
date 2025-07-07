import { ArrowLeft, ExternalLink } from 'lucide-react';
import { PaymentSession, Bank } from '@/types/payment';

interface BankSelectionProps {
  payment: PaymentSession;
  selectedBank: Bank;
  onConfirm: () => void;
  onBack: () => void;
}

export default function BankSelection({ payment, selectedBank, onConfirm, onBack }: BankSelectionProps) {
  const formatAmount = (amount: { value: string; currency: string }) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: amount.currency
    }).format(parseFloat(amount.value));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to bank selection</span>
        </button>

        {/* Confirmation Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Confirm Payment
          </h1>

          {/* Selected Bank */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">You selected</p>
            <div className="flex items-center space-x-3">
              {selectedBank.logo && (
                <img 
                  src={selectedBank.logo} 
                  alt={selectedBank.name}
                  className="h-10 w-10 object-contain"
                />
              )}
              <div>
                <p className="font-semibold text-gray-900">
                  {selectedBank.displayName || selectedBank.name}
                </p>
                {selectedBank.processingTime && (
                  <p className="text-sm text-gray-500">
                    Processing time: {selectedBank.processingTime}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="border-t pt-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold text-gray-900">
                  {formatAmount(payment.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">To</span>
                <span className="text-gray-900">
                  {payment.toAccount.accountName}
                </span>
              </div>
              {payment.reference && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Reference</span>
                  <span className="text-gray-900 font-mono text-sm">
                    {payment.reference}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. You'll be redirected to {selectedBank.displayName || selectedBank.name}</li>
              <li>2. Log in using your normal online banking credentials</li>
              <li>3. Authorize the payment in your banking app</li>
              <li>4. You'll be returned here to see the payment result</li>
            </ol>
          </div>

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center space-x-2 bg-primary-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <span>Continue to {selectedBank.displayName || selectedBank.name}</span>
            <ExternalLink className="h-5 w-5" />
          </button>

          {/* Security Notice */}
          <p className="text-xs text-gray-500 text-center mt-4">
            You will be redirected to {selectedBank.displayName || selectedBank.name}'s secure website. 
            Never enter your banking details on any other website.
          </p>
        </div>
      </div>
    </div>
  );
}
