'use client';

import Link from 'next/link';

export default function CTA() {
  return (
    <section className="py-16 bg-syntropi-blue">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          Ready to get started with Syntropi?
        </h2>
        <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
          Join thousands of businesses building the future of finance.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-syntropi-blue bg-white hover:bg-gray-100 transition-colors duration-150"
          >
            Contact sales
          </Link>
          <Link 
            href="/docs"
            className="inline-flex items-center justify-center px-8 py-3 border border-white text-base font-medium rounded-md text-white bg-transparent hover:bg-white/10 transition-colors duration-150"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
} 