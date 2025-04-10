// src/app/(auth)/layout.tsx
import React from 'react';

export default function AuthLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="min-h-screen bg-background-light flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div style={{
            backgroundColor: 'white',
            padding: '2rem 2.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 5px 10px rgba(79, 140, 255, 0.05)',
            border: '1px solid rgba(229, 231, 235, 0.5)'
          }}>
            <div className="mb-6 text-center">
              <h1 style={{ 
                background: 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '3rem',
                fontWeight: 'bold'
              }}>
                Syntropi
              </h1>
            </div>
            {children}
          </div>
        </div>
      </div>
    );
  }