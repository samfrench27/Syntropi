// Test script to verify the hosted pages JWT integration
// Run this with: node test-hosted-pages.js

const axios = require('axios');

const API_BASE_URL = 'https://api.syntropi.co.uk';
const API_KEY = 'your_api_key_here'; // You'll need to replace this with a real API key

async function testHostedPagesFlow() {
  console.log('🧪 Testing Hosted Pages JWT Integration...\n');

  try {
    // Step 1: Create a payment with HOSTED_PAGES flow
    console.log('1️⃣ Creating payment with HOSTED_PAGES flow...');
    
    const paymentRequest = {
      amount: {
        value: "100.50",
        currency: "GBP"
      },
      toAccount: {
        accountName: "Test Merchant Ltd",
        accountNumber: "12345678",
        sortCode: "12-34-56"
      },
      reference: "Test payment for hosted pages",
      flowType: "HOSTED_PAGES",
      redirectUrl: "https://example.com/payment-success",
      provider: "token",
      bankId: "test-bank"
    };

    const createResponse = await axios.post(`${API_BASE_URL}/payments`, paymentRequest, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const payment = createResponse.data.data;
    console.log('✅ Payment created:', payment.paymentId);
    console.log('🔗 Hosted Page URL:', payment.hostedPageUrl);

    if (!payment.hostedPageUrl) {
      console.log('❌ No hostedPageUrl returned. Check if flowType is HOSTED_PAGES');
      return;
    }

    // Step 2: Extract token from URL
    const url = new URL(payment.hostedPageUrl);
    const token = url.searchParams.get('token');
    const paymentId = payment.paymentId;

    console.log('\n2️⃣ Testing hosted pages API access...');
    console.log('🎫 Token:', token ? 'Present' : 'Missing');

    if (!token) {
      console.log('❌ No token found in hostedPageUrl');
      return;
    }

    // Step 3: Test the hosted pages endpoint
    const hostedResponse = await axios.get(`${API_BASE_URL}/payments/${paymentId}/hosted`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const hostedPayment = hostedResponse.data.data;
    console.log('✅ Hosted pages API call successful!');
    console.log('💰 Payment details:', {
      paymentId: hostedPayment.paymentId,
      amount: hostedPayment.amount,
      status: hostedPayment.status,
      merchant: hostedPayment.merchant?.name
    });

    console.log('\n🎉 Test completed successfully!');
    console.log('\nNext steps:');
    console.log('- Visit the hostedPageUrl in a browser to test the full UI');
    console.log('- The hosted pages should now load without 404 errors');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Tip: Make sure you have a valid API key set in the script');
    }
    if (error.response?.status === 404) {
      console.log('\n💡 Tip: The API endpoint might not be deployed yet');
    }
  }
}

// Run the test
testHostedPagesFlow();
