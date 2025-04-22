'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/90 backdrop-blur-sm shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-6">
        <nav className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image 
              src="/logo.svg" 
              alt="Syntropi Logo" 
              width={140} 
              height={36} 
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-syntropi-text-primary hover:text-syntropi-purple transition-colors">
              Features
            </Link>
            <Link href="/api-docs" className="text-syntropi-text-primary hover:text-syntropi-purple transition-colors">
              API Docs
            </Link>
            <Link href="/about" className="text-syntropi-text-primary hover:text-syntropi-purple transition-colors">
              About
            </Link>
            <Link href="/client-dashboard/login" className="text-syntropi-text-primary hover:text-syntropi-purple transition-colors">
              Login
            </Link>
            <Link 
              href="/client-dashboard/register" 
              className="px-5 py-2 bg-syntropi-gradient text-white rounded-md hover:opacity-90 transition-opacity"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-syntropi-text-primary"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg">
          <div className="container mx-auto px-6 py-4 flex flex-col space-y-4">
            <Link 
              href="#features" 
              className="block py-2 text-syntropi-text-primary hover:text-syntropi-purple"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link 
              href="/api-docs" 
              className="block py-2 text-syntropi-text-primary hover:text-syntropi-purple"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              API Docs
            </Link>
            <Link 
              href="/about" 
              className="block py-2 text-syntropi-text-primary hover:text-syntropi-purple"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link 
              href="/client-dashboard/login" 
              className="block py-2 text-syntropi-text-primary hover:text-syntropi-purple"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link 
              href="/client-dashboard/register" 
              className="block py-2 px-4 bg-syntropi-gradient text-white rounded-md w-full text-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
} 