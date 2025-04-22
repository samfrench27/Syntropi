'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Components
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Hero from '@/components/Hero';

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
      
      {/* Features Section */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <div ref={addToRefs} className="text-center mb-16 animate-reveal">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for <span className="gradient-text">modern businesses</span></h2>
            <p className="text-syntropi-text-secondary max-w-2xl mx-auto">
              Powerful features that help you streamline payment workflows and enhance your financial operations
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Real-time Payments',
                description: 'Process and settle payments instantly, 24/7, without traditional banking delays',
                icon: '/icons/lightning.svg'
              },
              {
                title: 'Developer-friendly API',
                description: 'Easily integrate our platform with your existing systems using our robust API',
                icon: '/icons/code.svg'
              },
              {
                title: 'Enhanced Security',
                description: 'Enterprise-grade security with advanced encryption and fraud protection',
                icon: '/icons/shield.svg'
              }
            ].map((feature, index) => (
              <div 
                key={index} 
                ref={addToRefs} 
                className="bg-white p-8 rounded-xl border border-syntropi-border shadow-sm card-hover animate-reveal"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="w-14 h-14 bg-syntropi-soft-lavender rounded-lg flex items-center justify-center mb-6">
                  <Image src={feature.icon} alt={feature.title} width={28} height={28} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-syntropi-text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="section bg-syntropi-gradient text-white">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div ref={addToRefs} className="animate-reveal">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your payment experience?</h2>
              <p className="text-white/80 text-lg mb-8">
                Join thousands of businesses already using Syntropi for their payment needs.
              </p>
              <Link href="/client-dashboard" className="inline-block px-8 py-4 bg-white text-syntropi-blue font-semibold rounded-md hover:bg-opacity-90 transition-all">
                Get Started Now
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="section bg-background-light">
        <div className="container mx-auto px-6">
          <div ref={addToRefs} className="text-center mb-16 animate-reveal">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by <span className="gradient-text">industry leaders</span></h2>
            <p className="text-syntropi-text-secondary max-w-2xl mx-auto">
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
                <blockquote className="text-syntropi-text-primary text-lg italic mb-6">
                  "{testimonial.quote}"
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
                    <p className="text-syntropi-text-secondary text-sm">{testimonial.position}</p>
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
