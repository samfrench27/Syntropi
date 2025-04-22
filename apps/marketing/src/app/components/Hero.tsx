'use client';

import Link from 'next/link';

export default function Hero() {
  return (
    <div className="relative bg-white overflow-hidden">
      <div className="container mx-auto px-4 pt-16 pb-24">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left lg:flex lg:items-center">
            <div>
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
                <span className="block">Open banking,</span>
                <span className="block text-syntropi-blue">simplified</span>
              </h1>
              <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                Build powerful financial applications with our developer-first payments platform. Fast integration, powerful APIs, and enterprise-grade security.
              </p>
              <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
                <div className="flex flex-col sm:flex-row sm:justify-center lg:justify-start gap-4">
                  <Link 
                    href="/signup"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-syntropi-blue hover:bg-syntropi-purple transition-colors duration-150"
                  >
                    Get started
                  </Link>
                  <Link 
                    href="/docs"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-soft-lavender transition-colors duration-150"
                  >
                    Documentation
                  </Link>
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  No credit card required. Free plan available.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
            <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
              <div className="relative block w-full bg-gray-900 rounded-lg overflow-hidden">
                <div className="p-8">
                  <code className="block text-sm font-mono text-gray-200 whitespace-pre overflow-x-auto">
{`// Example: Initialize payment
const syntropi = new Syntropi({
  apiKey: 'sk_test_...',
});

// Create a payment request
const payment = await syntropi.payments.create({
  amount: 1000,  // £10.00
  currency: 'GBP',
  description: 'Order #1234',
  returnUrl: 'https://example.com/return',
});

// Redirect to payment page
window.location = payment.redirectUrl;`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-24">
          <p className="text-center text-base font-semibold uppercase text-gray-600 tracking-wider">
            Trusted by innovative companies
          </p>
          <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-6 lg:grid-cols-5">
            <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
              <img className="h-12 opacity-60" src="https://placehold.co/120x48?text=LOGO" alt="Client" />
            </div>
            <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
              <img className="h-12 opacity-60" src="https://placehold.co/120x48?text=LOGO" alt="Client" />
            </div>
            <div className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
              <img className="h-12 opacity-60" src="https://placehold.co/120x48?text=LOGO" alt="Client" />
            </div>
            <div className="col-span-1 flex justify-center md:col-span-3 lg:col-span-1">
              <img className="h-12 opacity-60" src="https://placehold.co/120x48?text=LOGO" alt="Client" />
            </div>
            <div className="col-span-2 flex justify-center md:col-span-3 lg:col-span-1">
              <img className="h-12 opacity-60" src="https://placehold.co/120x48?text=LOGO" alt="Client" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 