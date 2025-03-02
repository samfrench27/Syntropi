export default function AuthLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-blue-600">Syntropi</h1>
            <p className="mt-2 text-gray-600">Admin Dashboard</p>
          </div>
          {children}
        </div>
      </div>
    );
  }