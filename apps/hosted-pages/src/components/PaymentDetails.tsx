import { useState } from 'react';
import { ChevronRight, CreditCard, Building, Shield, Clock } from 'lucide-react';
import { PaymentSession, Bank } from '@/types/payment';

interface PaymentDetailsProps {
  payment: PaymentSession;
  banks: Bank[];
  onSelectBank: (bank: Bank) => void;
}

export default function PaymentDetails({ payment, banks, onSelectBank }: PaymentDetailsProps) {
  const [selectedBankId, setSelectedBankId] = useState<string>('');

  // Early return if payment data is invalid
  if (!payment || typeof payment !== 'object' || !payment.amount) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-red-600">Invalid payment data</p>
        </div>
      </div>
    );
  }

  const formatAmount = (amount: { value: string; currency: string }) => {
    if (!amount || typeof amount !== 'object' || !amount.value || !amount.currency) {
      return 'Invalid amount';
    }
    
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: amount.currency
      }).format(parseFloat(amount.value));
    } catch (error) {
      console.warn('Error formatting amount:', error);
      return `${amount.currency} ${amount.value}`;
    }
  };

  const handleContinue = () => {
    if (!selectedBankId || !Array.isArray(banks)) {
      console.warn('Cannot continue: no bank selected or invalid banks data');
      return;
    }
    
    const bank = banks.find(b => b && b.id === selectedBankId);
    if (bank && typeof bank === 'object' && bank.id && bank.name) {
      console.log('Selected bank:', bank);
      onSelectBank(bank);
    } else {
      console.warn('Selected bank not found or invalid:', selectedBankId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            {payment.merchant?.logo && typeof payment.merchant.logo === 'string' && (
              <img 
                src={payment.merchant.logo} 
                alt={payment.merchant.name || 'Merchant'}
                className="h-12 mx-auto mb-2"
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900">
              Complete Your Payment
            </h1>
            {payment.merchant?.name && typeof payment.merchant.name === 'string' && (
              <p className="text-gray-600">
                Payment to {payment.merchant.name}
              </p>
            )}
          </div>
        </div>

        {/* Payment Summary Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Details
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <span className="text-gray-700">Amount</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {formatAmount(payment.amount)}
              </span>
            </div>

            {payment.description && typeof payment.description === 'string' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Description</span>
                <span className="text-gray-900 text-right max-w-xs">
                  {payment.description}
                </span>
              </div>
            )}

            {payment.reference && typeof payment.reference === 'string' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Reference</span>
                <span className="text-gray-900 font-mono text-sm">
                  {payment.reference}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building className="h-5 w-5 text-gray-400" />
                <span className="text-gray-700">To Account</span>
              </div>
              <div className="text-right">
                <div className="text-gray-900 font-medium">
                  {payment.toAccount?.accountName || 'Unknown Account'}
                </div>
                {payment.toAccount?.accountNumber && payment.toAccount?.sortCode && (
                  <div className="text-sm text-gray-500">
                    {payment.toAccount.sortCode} {payment.toAccount.accountNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Select Your Bank
          </h2>
          
          <div className="space-y-3">
            {Array.isArray(banks) && banks.length > 0 ? (
              banks.filter(bank => bank && typeof bank === 'object' && bank.available === true).map((bank) => {
                // Ensure all required fields are present and valid
                if (!bank.id || !bank.name) {
                  console.warn('Invalid bank data:', bank);
                  return null;
                }
                
                return (
                  <label
                    key={bank.id}
                    className={`bank-option ${selectedBankId === bank.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="bank"
                      value={bank.id}
                      checked={selectedBankId === bank.id}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3">
                        {bank.logo && typeof bank.logo === 'string' && (
                          <img 
                            src={bank.logo} 
                            alt={bank.name || 'Bank'}
                            className="h-8 w-8 object-contain"
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {bank.displayName || bank.name || 'Unknown Bank'}
                          </div>
                          {bank.processingTime && typeof bank.processingTime === 'string' && (
                            <div className="text-sm text-gray-500 flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{bank.processingTime}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {bank.supportsInstantPayments === true && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Instant
                          </span>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </label>
                );
              }).filter(Boolean)
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No banks available at the moment.</p>
                <p className="text-sm mt-2">Please try again later or contact support.</p>
              </div>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedBankId}
          className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors ${
            selectedBankId 
              ? 'bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue to Bank
        </button>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Secure Payment</p>
              <p>
                Your payment is secured with bank-level encryption. You will be redirected 
                to your bank to authorize the payment using your normal online banking credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Security Badges */}
        <div className="flex justify-center space-x-6 mt-6 text-sm text-gray-500">
          <div className="security-badge">
            <Shield className="h-4 w-4" />
            <span>SSL Encrypted</span>
          </div>
          <div className="security-badge">
            <Building className="h-4 w-4" />
            <span>FCA Regulated</span>
          </div>
        </div>
      </div>
    </div>
  );
}
