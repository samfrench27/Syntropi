'use client';

import Link from 'next/link';
import { CheckIcon } from './Icons';

export default function Products() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            A suite of powerful payment products
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Build with confidence on a platform designed for businesses that want to scale and innovate in open banking.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Payments */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
            <div className="mb-4">
              <div className="w-12 h-12 bg-soft-lavender rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-syntropi-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Payments</h3>
              <p className="text-gray-600 mb-4">
                Accept instant, secure bank payments online with a seamless checkout experience.
              </p>
            </div>
            <div className="mb-6 flex-grow">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Instant confirmation</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Lower transaction costs</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Higher conversion rate</span>
                </li>
              </ul>
            </div>
            <Link href="/products/payments" className="inline-flex items-center text-syntropi-blue hover:text-syntropi-purple transition-colors">
              Learn more
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Payouts */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
            <div className="mb-4">
              <div className="w-12 h-12 bg-soft-lavender rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-syntropi-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Payouts</h3>
              <p className="text-gray-600 mb-4">
                Send fast, reliable payments to customers, suppliers, or partners across Europe.
              </p>
            </div>
            <div className="mb-6 flex-grow">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Bulk payment support</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Scheduled transfers</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Real-time notifications</span>
                </li>
              </ul>
            </div>
            <Link href="/products/payouts" className="inline-flex items-center text-syntropi-blue hover:text-syntropi-purple transition-colors">
              Learn more
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Analytics */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
            <div className="mb-4">
              <div className="w-12 h-12 bg-soft-lavender rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-syntropi-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics</h3>
              <p className="text-gray-600 mb-4">
                Gain actionable insights from comprehensive payment data and reports.
              </p>
            </div>
            <div className="mb-6 flex-grow">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Real-time dashboards</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Customisable reports</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" />
                  <span className="text-gray-600">Export capabilities</span>
                </li>
              </ul>
            </div>
            <Link href="/products/analytics" className="inline-flex items-center text-syntropi-blue hover:text-syntropi-purple transition-colors">
              Learn more
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}