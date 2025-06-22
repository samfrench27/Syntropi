import React from "react";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-white overflow-hidden">
        <div className="container pt-16 pb-24">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left lg:flex lg:items-center">
              <div>
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
                  <span className="block">Open banking,</span>
                  <span className="block text-syntropi-blue">simplified</span>
                </h1>
                <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                  Build powerful financial applications with our developer-first payments platform. Fast integration, powerful APIs, and enterprise-grade security.
                </p>
                <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
                  <div className="flex flex-col sm:flex-row sm:justify-center lg:justify-start gap-4">
                    <a 
                      href="/signup"
                      className="btn-primary"
                    >
                      Get started
                    </a>
                    <a 
                      href="/docs"
                      className="btn-secondary"
                    >
                      Documentation
                    </a>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    No credit card required. Free plan available.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
                <div className="relative block w-full bg-gray-900 rounded-lg overflow-hidden">
                  <div className="p-8">
                    <code className="block text-sm font-mono text-gray-200 whitespace-pre overflow-x-auto">
{`// Example: Initialize payment
const syntropi = new Syntropi({
  apiKey: 'sk_test_...',
});

// Create a payment request
const payment = await syntropi.payments.create({
  amount: 1000,  // £10.00
  currency: 'GBP',
  description: 'Order #1234',
  returnUrl: 'https://example.com/return',
});

// Redirect to payment page
window.location = payment.redirectUrl;`}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-24">
            <p className="text-center text-base font-semibold uppercase text-gray-600 tracking-wider">
              Trusted by innovative companies
            </p>
            <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-6 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="col-span-1 flex justify-center md:col-span-2 lg:col-span-1">
                  <div className="h-12 w-36 bg-gray-200 rounded flex items-center justify-center">LOGO</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50" id="features">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Payments
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to build, manage, and scale your payment infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Developer API",
                description: "Build applications faster with our intuitive and fully documented API. Easy to integrate and scale.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-syntropi-purple">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                  </svg>
                )
              },
              {
                title: "Enterprise Security",
                description: "Industry-leading security with end-to-end encryption, OAuth integration, and compliance with standards.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-syntropi-purple">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                )
              },
              {
                title: "Payment Solutions",
                description: "Accept payments, send payouts, and set up recurring payments with a single integration.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-syntropi-purple">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                )
              },
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="w-12 h-12 bg-syntropi-soft-lavender rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-20 bg-white" id="products">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              A suite of powerful payment products
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Build with confidence on a platform designed for businesses that want to scale and innovate in open banking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Payments",
                description: "Accept instant, secure bank payments online with a seamless checkout experience.",
                benefits: [
                  "Instant confirmation",
                  "Lower transaction costs",
                  "Higher conversion rate"
                ]
              },
              {
                title: "Payouts",
                description: "Send fast, reliable payments to customers, suppliers, or partners across Europe.",
                benefits: [
                  "Bulk payment support",
                  "Scheduled transfers",
                  "Real-time notifications"
                ]
              },
              {
                title: "Analytics",
                description: "Gain actionable insights from comprehensive payment data and reports.",
                benefits: [
                  "Real-time dashboards",
                  "Customisable reports",
                  "Export capabilities"
                ]
              }
            ].map((product, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.title}</h3>
                  <p className="text-gray-600 mb-4">{product.description}</p>
                </div>
                <div className="mb-6 flex-grow">
                  <ul className="space-y-2">
                    {product.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start">
                        <svg className="w-5 h-5 text-syntropi-blue mt-0.5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <a href="#" className="inline-flex items-center text-syntropi-blue hover:text-syntropi-purple transition-colors">
                  Learn more
                  <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-syntropi-blue">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to get started with Syntropi?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses building the future of finance.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-syntropi-blue bg-white hover:bg-gray-100 transition-colors duration-150"
            >
              Contact sales
            </a>
            <a 
              href="/docs"
              className="inline-flex items-center justify-center px-8 py-3 border border-white text-base font-medium rounded-md text-white bg-transparent hover:bg-white/10 transition-colors duration-150"
            >
              Read the docs
            </a>
          </div>
        </div>
      </section>
    </>
  );
} 