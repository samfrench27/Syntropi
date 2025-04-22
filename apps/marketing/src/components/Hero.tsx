'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-syntropi-blue to-syntropi-purple opacity-10" />
      
      {/* Animated shapes */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-syntropi-blue rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute top-32 -left-24 w-72 h-72 bg-syntropi-purple rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 right-36 w-72 h-72 bg-syntropi-blue rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      
      <div className="relative container mx-auto px-6 pt-32 pb-24 sm:pt-40 sm:pb-32">
        <div className="max-w-4xl mx-auto">
          <div 
            className={`text-center transition-all duration-1000 ease-out transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
            }`}
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-6">
              <span className="gradient-text">
                Revolutionize 
              </span> your payment infrastructure
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
              Syntropi provides real-time payment solutions for modern businesses. 
              Streamline your workflows and unlock efficiency with our powerful API.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                href="/dashboard"
                className="btn-primary"
              >
                Get Started
              </Link>
              <Link 
                href="/api-docs"
                className="btn-secondary"
              >
                Explore API
              </Link>
            </div>
          </div>
          
          {/* Key Benefits */}
          <div className={`mt-20 grid md:grid-cols-3 gap-8 transition-all duration-1000 ease-out delay-300 transform ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            <div className="bg-white rounded-xl shadow-md p-6 border border-syntropi-border">
              <div className="w-12 h-12 rounded-full bg-syntropi-soft-lavender flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-syntropi-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
              <p className="text-text-secondary">Process transactions in milliseconds with our high-performance infrastructure</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 border border-syntropi-border">
              <div className="w-12 h-12 rounded-full bg-syntropi-soft-lavender flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-syntropi-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Bank-Grade Security</h3>
              <p className="text-text-secondary">Enterprise security with advanced encryption and fraud protection</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 border border-syntropi-border">
              <div className="w-12 h-12 rounded-full bg-syntropi-soft-lavender flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-syntropi-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Developer Friendly</h3>
              <p className="text-text-secondary">Simple, well-documented API that integrates with your existing systems</p>
            </div>
          </div>
          
          {/* Stats */}
          <div className={`mt-16 bg-white shadow-xl rounded-xl p-6 grid grid-cols-3 gap-4 transition-all duration-1000 ease-out delay-500 transform ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}>
            <div className="text-center">
              <p className="text-4xl font-bold text-syntropi-blue">99.9%</p>
              <p className="text-text-secondary text-sm mt-1">Uptime</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-4xl font-bold text-syntropi-purple">50ms</p>
              <p className="text-text-secondary text-sm mt-1">Avg Response</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-syntropi-blue">10k+</p>
              <p className="text-text-secondary text-sm mt-1">API Requests/sec</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 