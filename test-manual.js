#!/usr/bin/env node

// Simple test to create a hosted page URL and test it manually
// This creates a test URL you can visit in your browser

const API_BASE_URL = 'https://api.syntropi.co.uk';

// Sample test data - you can modify this
const testPaymentData = {
  paymentId: 'test-payment-' + Date.now(),
  organizationId: 'test-org',
  clientId: 'test-client'
};

console.log('🧪 Hosted Pages Manual Test\n');

console.log('Since we need an API key to test the full flow, here are the options:\n');

console.log('Option 1: Test with real API key');
console.log('=================================');
console.log('1. Get an API key from your admin dashboard');
console.log('2. Update test-hosted-pages.js with your API key');
console.log('3. Run: node test-hosted-pages.js');

console.log('\nOption 2: Test the hosted pages directly');
console.log('========================================');
console.log('Visit this URL to test the hosted pages with mock data:');
console.log(`https://hosted-pages-hkz2xir2r-samfrench27s-projects.vercel.app/sessions/demo-payment-id`);

console.log('\nOption 3: Test API endpoints directly');
console.log('====================================');
console.log('Test your new JWT endpoint:');
console.log(`curl -X GET "${API_BASE_URL}/payments/demo-payment-id/hosted" \\`);
console.log(`  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"`);

console.log('\nOption 4: Use admin dashboard to create a payment');
console.log('===============================================');
console.log('1. Go to your admin dashboard');
console.log('2. Create a payment with flowType: "HOSTED_PAGES"');
console.log('3. The response should include a hostedPageUrl with JWT token');
console.log('4. Visit that URL to test the full flow');

console.log('\n💡 The 404 issue should now be resolved with the JWT authentication!');
