'use client';

import Link from 'next/link';

// Components
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Hero from '../components/Hero';

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <Hero />
      
      {/* About Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What is <span className="gradient-text">Syntropi</span>?</h2>
            <p className="text-text-secondary max-w-3xl mx-auto text-lg">
              Syntropi is a modern payment infrastructure platform designed to help businesses process 
              payments faster, more securely, and with less overhead. Our API-first approach makes 
              integration simple for developers while providing powerful tools for finance teams.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h3 className="text-2xl font-bold mb-4">For Businesses</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-2 rounded-full mr-3 mt-1">✓</div>
                  <span className="text-text-primary">Reduce payment processing costs by up to 50%</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-2 rounded-full mr-3 mt-1">✓</div>
                  <span className="text-text-primary">Settle transactions in real-time, not days</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-2 rounded-full mr-3 mt-1">✓</div>
                  <span className="text-text-primary">Comprehensive dashboard for finance teams</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold mb-4">For Developers</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-2 rounded-full mr-3 mt-1">✓</div>
                  <span className="text-text-primary">Simple, well-documented RESTful API</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-2 rounded-full mr-3 mt-1">✓</div>
                  <span className="text-text-primary">SDKs for popular languages (JavaScript, Python, Ruby, PHP)</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-2 rounded-full mr-3 mt-1">✓</div>
                  <span className="text-text-primary">Sandbox environment for testing</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="text-center">
            <Link href="/client-dashboard/register" className="btn-primary text-lg px-8 py-4">
              Start Your Free Trial
            </Link>
            <p className="mt-4 text-text-secondary">No credit card required. 14-day free trial.</p>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="bg-syntropi-gradient py-16 text-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your payment experience?</h2>
            <p className="text-white/80 text-lg mb-8">
              Join thousands of businesses already using Syntropi for their payment needs.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/client-dashboard/register" className="inline-block px-8 py-4 bg-white text-syntropi-blue font-semibold rounded-md hover:bg-opacity-90 transition-all">
                Get Started Now
              </Link>
              <Link href="/api-docs" className="inline-block px-8 py-4 border border-white text-white font-semibold rounded-md hover:bg-white/10 transition-all">
                Read Documentation
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
