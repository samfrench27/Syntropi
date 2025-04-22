'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Components
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Hero from '../components/Hero';

export default function Home() {
  const revealRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1 }
    );

    revealRefs.current.forEach((ref) => {
      observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const addToRefs = (el: HTMLDivElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  return (
    <main className="flex flex-col min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <Hero />
      
      {/* About Section */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <div ref={addToRefs} className="text-center mb-12 animate-reveal">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What is <span className="gradient-text">Syntropi</span>?</h2>
            <p className="text-text-secondary max-w-3xl mx-auto text-lg">
              Syntropi is a modern payment infrastructure platform designed to help businesses process 
              payments faster, more securely, and with less overhead. Our API-first approach makes 
              integration simple for developers while providing powerful tools for finance teams.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div ref={addToRefs} className="animate-reveal">
              <h3 className="text-2xl font-bold mb-4">For Businesses</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-1 rounded-full mr-3 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-syntropi-purple" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-text-primary">Reduce payment processing costs by up to 50%</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-1 rounded-full mr-3 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-syntropi-purple" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-text-primary">Settle transactions in real-time, not days</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-1 rounded-full mr-3 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-syntropi-purple" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-text-primary">Comprehensive dashboard for finance teams</span>
                </li>
              </ul>
            </div>
            
            <div ref={addToRefs} className="animate-reveal" style={{ animationDelay: '150ms' }}>
              <h3 className="text-2xl font-bold mb-4">For Developers</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-1 rounded-full mr-3 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-syntropi-purple" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-text-primary">Simple, well-documented RESTful API</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-1 rounded-full mr-3 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-syntropi-purple" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-text-primary">SDKs for popular languages (JavaScript, Python, Ruby, PHP)</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-syntropi-soft-lavender p-1 rounded-full mr-3 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-syntropi-purple" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-text-primary">Sandbox environment for testing</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div ref={addToRefs} className="text-center animate-reveal">
            <Link href="/client-dashboard/register" className="btn-primary text-lg px-8 py-4">
              Start Your Free Trial
            </Link>
            <p className="mt-4 text-text-secondary">No credit card required. 14-day free trial.</p>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="section bg-gradient-to-r from-syntropi-blue to-syntropi-purple text-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div ref={addToRefs} className="animate-reveal">
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
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="section bg-background-light">
        <div className="container mx-auto px-6">
          <div ref={addToRefs} className="text-center mb-16 animate-reveal">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by <span className="gradient-text">industry leaders</span></h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              See what our customers are saying about their experience with Syntropi
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                quote: "Syntropi has revolutionized our payment processing. What used to take days now happens in seconds.",
                author: "Sarah Johnson",
                position: "CFO, TechNova Inc.",
                avatar: "/avatars/avatar-1.jpg"
              },
              {
                quote: "The API is incredibly well-documented and easy to integrate. Our developers were able to implement it in record time.",
                author: "Michael Chen",
                position: "CTO, Quantum Solutions",
                avatar: "/avatars/avatar-2.jpg"
              }
            ].map((testimonial, index) => (
              <div 
                key={index} 
                ref={addToRefs} 
                className="bg-white p-8 rounded-xl border border-syntropi-border shadow-sm animate-reveal"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <blockquote className="text-text-primary text-lg italic mb-6">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full overflow-hidden mr-4 bg-syntropi-soft-lavender">
                    <Image 
                      src={testimonial.avatar} 
                      alt={testimonial.author} 
                      width={48} 
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-text-secondary text-sm">{testimonial.position}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
