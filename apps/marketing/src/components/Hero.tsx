'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-syntropi-blue to-syntropi-purple opacity-10" />
      
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
        </div>
      </div>
    </div>
  );
} 