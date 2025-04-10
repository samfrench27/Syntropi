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
          <div className="bg-white py-8 px-4 shadow rounded-lg sm:px-10">
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