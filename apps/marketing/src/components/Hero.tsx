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
              <span className="bg-clip-text text-transparent bg-syntropi-gradient">
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
                className="bg-syntropi-gradient text-white font-medium py-3 px-6 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
              >
                Get Started
              </Link>
              <Link 
                href="/api-docs"
                className="bg-transparent border border-syntropi-blue text-syntropi-blue font-medium py-3 px-6 rounded-lg hover:bg-soft-lavender transition-colors"
              >
                Explore API
              </Link>
            </div>
          </div>
          
          {/* Dashboard Preview */}
          <div 
            className={`mt-16 relative transition-all duration-1000 ease-out delay-300 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
            }`}
          >
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">
              <div className="relative w-full h-[400px] sm:h-[500px]">
                <Image
                  src="/dashboard-preview.png"
                  alt="Syntropi Dashboard Preview"
                  fill
                  style={{ objectFit: 'cover', objectPosition: 'top' }}
                  className="rounded-b-xl"
                  priority
                />
              </div>
            </div>
            
            {/* Stats */}
            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-[90%] max-w-3xl">
              <div className="bg-white shadow-xl rounded-xl p-6 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-syntropi-blue">99.9%</p>
                  <p className="text-text-secondary text-sm mt-1">Uptime</p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-4xl font-bold text-syntropi-purple">50ms</p>
                  <p className="text-text-secondary text-sm mt-1">Average Response</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-syntropi-blue">10k+</p>
                  <p className="text-text-secondary text-sm mt-1">API Requests/sec</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 