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

  // Debug logging for banks data
  console.log('PaymentDetails component received banks:', banks);
  console.log('Banks array length:', Array.isArray(banks) ? banks.length : 'not an array');

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
          <div className="mb-6">
            {/* Syntropi branding */}
            <div className="flex items-center justify-center mb-4">
              <img 
                src="/syntropi-logo.svg" 
                alt="Syntropi"
                className="h-8"
              />
            </div>
            
            {payment.merchant?.logo && typeof payment.merchant.logo === 'string' && (
              <img 
                src={payment.merchant.logo} 
                alt={payment.merchant.name || 'Merchant'}
                className="h-10 mx-auto mb-3"
              />
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Payment
            </h1>
            {payment.merchant?.name && typeof payment.merchant.name === 'string' && (
              <p className="text-gray-600 text-lg">
                Payment to {payment.merchant.name}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Secured by Syntropi • Bank-level encryption
            </p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Select Your Bank
          </h2>
          
          <div className="bank-grid">
            {Array.isArray(banks) && banks.length > 0 ? (
              banks.filter(bank => bank && typeof bank === 'object' && bank.available !== false).map((bank) => {
                // Ensure all required fields are present and valid
                if (!bank.id || !bank.name) {
                  console.warn('Invalid bank data:', bank);
                  return null;
                }
                
                return (
                  <label
                    key={bank.id}
                    className={`bank-tile ${selectedBankId === bank.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="bank"
                      value={bank.id}
                      checked={selectedBankId === bank.id}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="bank-tile-content">
                      <div className="bank-logo-container">
                        {bank.logo ? (
                          <img 
                            src={bank.logo} 
                            alt={bank.name || 'Bank'}
                            className="bank-logo"
                            onError={(e) => {
                              // Fallback if logo fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`bank-logo-placeholder ${bank.logo ? 'hidden' : ''}`}>
                          <Building className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                        </div>
                      </div>
                      <div className="bank-info">
                        <div className="bank-name">
                          {bank.displayName || bank.name || 'Unknown Bank'}
                        </div>
                        <div className="bank-features">
                          {bank.supportsInstantPayments === true && (
                            <span className="feature-badge instant">
                              <Clock className="h-3 w-3" />
                              Instant
                            </span>
                          )}
                          {bank.processingTime && typeof bank.processingTime === 'string' && (
                            <span className="processing-time">
                              {bank.processingTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              }).filter(Boolean)
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No banks available</p>
                <p className="text-sm">Please try again later or contact support.</p>
              </div>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedBankId}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
            selectedBankId 
              ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transform hover:scale-105'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {selectedBankId ? 'Continue with Selected Bank' : 'Select a Bank to Continue'}
        </button>

        {/* Security Notice */}
        <div className="mt-6 p-6 bg-primary-50 rounded-xl border border-primary-200">
          <div className="flex items-start space-x-3">
            <Shield className="h-6 w-6 text-primary-600 mt-0.5" />
            <div className="text-sm text-primary-800">
              <p className="font-semibold mb-2">Your payment is secure</p>
              <p>
                Syntropi uses bank-level encryption and Open Banking standards to keep your data safe. 
                You'll be redirected to your bank's secure website to authorize the payment using your 
                normal online banking credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Security Badges */}
        <div className="flex justify-center space-x-8 mt-6 text-sm text-gray-600">
          <div className="security-badge">
            <Shield className="h-5 w-5 text-primary-600" />
            <span>256-bit SSL</span>
          </div>
          <div className="security-badge">
            <Building className="h-5 w-5 text-primary-600" />
            <span>FCA Regulated</span>
          </div>
          <div className="security-badge">
            <CreditCard className="h-5 w-5 text-primary-600" />
            <span>Open Banking</span>
          </div>
        </div>
      </div>
    </div>
  );
}
