import { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  // Add security headers for hosted payment pages
  const response = new Response()
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  return response
}
 
export const config = {
  matcher: [
    '/sessions/:path*',
    '/payment/:path*'
  ]
}
