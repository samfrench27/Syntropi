// src/app/(auth)/layout.tsx
import Image from 'next/image';

export default function AuthLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="min-h-screen bg-background-light flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Image 
                src="/syntropilogo.png" 
                alt="Syntropi Logo" 
                width={200} 
                height={60} 
                priority
                unoptimized
              />
            </div>
            <p className="mt-2 text-text-secondary">User Portal</p>
          </div>
          {children}
        </div>
      </div>
    );
  }