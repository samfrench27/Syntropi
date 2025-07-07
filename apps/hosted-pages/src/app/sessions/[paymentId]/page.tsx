'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import PaymentDetails from '@/components/PaymentDetails';
import BankSelection from '@/components/BankSelection';
import PaymentProcessing from '@/components/PaymentProcessing';
import PaymentResult from '@/components/PaymentResult';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorDisplay from '@/components/ErrorDisplay';
import { PaymentSession, Bank } from '@/types/payment';
import { paymentAPI, banksAPI } from '@/lib/api';

type PaymentStep = 'loading' | 'details' | 'bank-selection' | 'processing' | 'result' | 'error';

export default function PaymentSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentId = params.paymentId as string;
  
  const [step, setStep] = useState<PaymentStep>('loading');
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  // Extract redirect URL and access token from search params
  useEffect(() => {
    const redirect = searchParams.get('redirect_uri');
    if (redirect) {
      setRedirectUrl(redirect);
    }
    
    // Extract access token for this payment session
    const accessToken = searchParams.get('token');
    if (accessToken) {
      // Store token for API calls
      localStorage.setItem(`payment_token_${paymentId}`, accessToken);
    }
  }, [searchParams, paymentId]);

  // Load payment details and available banks
  useEffect(() => {
    const loadPaymentSession = async () => {
      try {
        setStep('loading');
        setError(null);

        // Load payment details
        const paymentResponse = await paymentAPI.getPayment(paymentId);
        const paymentData = paymentResponse.data;

        if (!paymentData) {
          throw new Error('Payment not found');
        }

        setPayment(paymentData);

        // Load available banks
        const banksResponse = await banksAPI.getAvailableBanks();
        setBanks(banksResponse.data || []);

        setStep('details');
      } catch (err: any) {
        console.error('Error loading payment session:', err);
        setError(err.message || 'Failed to load payment session');
        setStep('error');
      }
    };

    if (paymentId) {
      loadPaymentSession();
    }
  }, [paymentId]);

  const handleContinueToBank = (bank: Bank) => {
    setSelectedBank(bank);
    setStep('bank-selection');
  };

  const handleConfirmPayment = async () => {
    if (!selectedBank || !payment) return;

    try {
      setStep('processing');

      // Initiate payment with selected bank using API_ONLY flow
      const response = await paymentAPI.initiatePayment({
        paymentId: payment.paymentId,
        bankId: selectedBank.id,
        flowType: 'API_ONLY',
        redirectUri: redirectUrl || undefined
      });

      if (response.data.redirectUrl) {
        // Redirect to bank for authorization
        window.location.href = response.data.redirectUrl;
      } else {
        setStep('result');
      }
    } catch (err: any) {
      console.error('Error initiating payment:', err);
      setError(err.message || 'Failed to initiate payment');
      setStep('error');
    }
  };

  const handleRetry = () => {
    setError(null);
    setStep('loading');
    // Reload the page data
    window.location.reload();
  };

  const handleBackToMerchant = () => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      // Fallback if no redirect URL provided
      window.close();
    }
  };

  // Render based on current step
  switch (step) {
    case 'loading':
      return <LoadingSpinner message="Loading payment details..." />;

    case 'error':
      return (
        <ErrorDisplay
          error={error || 'An unexpected error occurred'}
          onRetry={handleRetry}
          onBack={handleBackToMerchant}
        />
      );

    case 'details':
      return (
        <PaymentDetails
          payment={payment!}
          banks={banks}
          onSelectBank={handleContinueToBank}
        />
      );

    case 'bank-selection':
      return (
        <BankSelection
          payment={payment!}
          selectedBank={selectedBank!}
          onConfirm={handleConfirmPayment}
          onBack={() => setStep('details')}
        />
      );

    case 'processing':
      return (
        <PaymentProcessing
          payment={payment!}
          bank={selectedBank!}
        />
      );

    case 'result':
      return (
        <PaymentResult
          payment={payment!}
          onReturnToMerchant={handleBackToMerchant}
        />
      );

    default:
      return <LoadingSpinner message="Initializing..." />;
  }
}
