import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Syntropi Payment Portal
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Secure payment processing for merchants and customers
        </p>
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">For Developers</h2>
            <p className="text-gray-600 mb-4">
              To initiate a payment session, redirect to:
            </p>
            <code className="bg-gray-100 p-2 rounded text-sm">
              /sessions/[paymentId]
            </code>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Example</h2>
            <Link 
              href="/sessions/demo-payment-id"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              Try Demo Payment Flow
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
