import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Syntropi | Open Banking Payment Solutions",
  description: "Syntropi provides open banking payment solutions for businesses across the UK and Europe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="bg-white border-b border-gray-200">
          <div className="container py-4 flex justify-between items-center">
            <div className="text-2xl font-bold text-syntropi-blue">Syntropi</div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-text-secondary hover:text-syntropi-blue transition-colors">Features</a>
              <a href="#products" className="text-text-secondary hover:text-syntropi-blue transition-colors">Products</a>
              <a href="#pricing" className="text-text-secondary hover:text-syntropi-blue transition-colors">Pricing</a>
              <a href="/docs" className="text-text-secondary hover:text-syntropi-blue transition-colors">Documentation</a>
            </nav>
            <div className="hidden md:flex space-x-4">
              <a href="/login" className="btn-secondary !py-2 !px-4">Login</a>
              <a href="/signup" className="btn-primary !py-2 !px-4">Sign up</a>
            </div>
            <button className="md:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>
        <main className="min-h-screen">
          {children}
        </main>
        <footer className="bg-gray-50 border-t border-gray-200 py-12">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              <div className="col-span-2">
                <div className="text-2xl font-bold text-syntropi-blue">Syntropi</div>
                <p className="mt-4 text-gray-600 max-w-xs">
                  A payments network built for growth, connecting banks, people and businesses across the UK and Europe.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Products</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">Payments</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">Payouts</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">Recurring Payments</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Developers</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">Documentation</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">API Reference</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">Guides</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Company</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">About</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">Careers</a></li>
                  <li><a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-600 text-sm">
                © {new Date().getFullYear()} Syntropi Ltd. All rights reserved.
              </p>
              <div className="mt-4 md:mt-0 flex space-x-6">
                <a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors text-sm">Privacy Policy</a>
                <a href="#" className="text-gray-600 hover:text-syntropi-blue transition-colors text-sm">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
} 