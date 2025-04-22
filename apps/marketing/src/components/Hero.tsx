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
          
          {/* Dashboard Preview */}
          <div 
            className={`mt-16 relative transition-all duration-1000 ease-out delay-300 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
            }`}
          >
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100">
              <div className="relative w-full h-[400px] sm:h-[500px]">
                <div className="bg-white rounded-xl border border-syntropi-border p-4 shadow-lg">
                  <div className="bg-soft-lavender rounded-t-lg p-3 mb-4 flex items-center">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="text-syntropi-blue text-sm font-medium ml-4">Syntropi Dashboard</div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <div className="bg-gray-100 rounded-lg p-3 h-full">
                        <div className="h-6 w-24 bg-syntropi-light-blue rounded mb-4"></div>
                        <div className="space-y-2">
                          <div className="h-4 w-full bg-gray-200 rounded"></div>
                          <div className="h-4 w-full bg-gray-200 rounded"></div>
                          <div className="h-4 w-full bg-gray-200 rounded"></div>
                          <div className="h-4 w-full bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="bg-gradient-to-r from-syntropi-blue to-syntropi-purple h-8 w-32 rounded mb-4"></div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-soft-lavender h-20 rounded p-3">
                            <div className="h-4 w-16 bg-white rounded mb-2"></div>
                            <div className="h-6 w-24 bg-white rounded"></div>
                          </div>
                          <div className="bg-soft-lavender h-20 rounded p-3">
                            <div className="h-4 w-16 bg-white rounded mb-2"></div>
                            <div className="h-6 w-24 bg-white rounded"></div>
                          </div>
                          <div className="bg-soft-lavender h-20 rounded p-3">
                            <div className="h-4 w-16 bg-white rounded mb-2"></div>
                            <div className="h-6 w-24 bg-white rounded"></div>
                          </div>
                        </div>
                        <div className="border border-gray-200 rounded-lg">
                          <div className="grid grid-cols-4 gap-4 p-3 border-b border-gray-200 bg-gray-50">
                            <div className="h-4 w-full bg-gray-200 rounded"></div>
                            <div className="h-4 w-full bg-gray-200 rounded"></div>
                            <div className="h-4 w-full bg-gray-200 rounded"></div>
                            <div className="h-4 w-full bg-gray-200 rounded"></div>
                          </div>
                          <div className="p-3">
                            <div className="space-y-3">
                              <div className="grid grid-cols-4 gap-4">
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                              </div>
                              <div className="grid grid-cols-4 gap-4">
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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