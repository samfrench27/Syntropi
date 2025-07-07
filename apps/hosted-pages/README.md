# Syntropi Hosted Payment Pages

A standalone payment portal application that provides hosted payment pages for merchants using Syntropi's payment infrastructure.

## Overview

This application provides a secure, branded payment experience similar to Token.io's hosted pages, allowing merchants to redirect customers to a secure payment flow without building their own payment UI.

## Features

- 🔒 **Secure Payment Flow** - Bank-level security with SSL encryption
- 🏦 **Bank Selection** - Dynamic bank selection with real-time availability
- 📱 **Mobile Responsive** - Optimized for both desktop and mobile devices
- 🎨 **Customizable Branding** - Support for merchant logos and branding
- ⚡ **Real-time Status** - Live payment status updates
- 🔄 **Auto-redirect** - Automatic return to merchant after completion
- 🛡️ **Security Headers** - Enhanced security with proper headers

## URL Structure

### Payment Sessions
```
https://your-domain.com/sessions/{paymentId}?redirect_uri={merchantReturnUrl}
```

**Example:**
```
https://hosted.syntropi.com/sessions/pay_dc07678a31104724ad04f36bd5ea4a97?redirect_uri=https://merchant.com/return
```

### Parameters
- `paymentId` - The unique payment identifier
- `redirect_uri` (optional) - Where to redirect the user after payment completion

## Payment Flow

1. **Payment Initiation** - Merchant redirects customer to payment session URL
2. **Payment Details** - Customer reviews payment amount and details
3. **Bank Selection** - Customer selects their preferred bank
4. **Authorization** - Customer is redirected to their bank for authorization
5. **Processing** - Payment is processed via API_ONLY flow
6. **Result** - Customer sees payment result and is redirected back to merchant

## Integration with Syntropi API

The hosted pages application integrates with the main Syntropi API for:

- Fetching payment details
- Retrieving available banks
- Initiating payments with selected banks
- Getting payment status updates

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
cd apps/hosted-pages
npm install
npm run dev
```

The application will start on `http://localhost:3002`

### Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_HOSTED_PAGES_TOKEN=your_token_here
```

## API Endpoints Used

### Payment API
- `GET /payments/{paymentId}` - Get payment details
- `POST /payments/initiate` - Initiate payment with bank
- `GET /payments/{paymentId}/status` - Get payment status

### Banks API
- `GET /banks` - Get available banks
- `GET /banks/{bankId}` - Get specific bank details

## Security

- SSL/TLS encryption for all communications
- CSP headers to prevent XSS attacks
- Frame denial to prevent clickjacking
- Secure session management
- Input validation and sanitization

## Deployment

The application can be deployed as a standalone Next.js application:

```bash
npm run build
npm start
```

For production deployment, ensure:
- Proper SSL certificates
- Environment variables configured
- Security headers enabled
- CORS configured for merchant domains

## Customization

### Branding
- Merchant logos via payment session data
- Custom color schemes via CSS variables
- Branded messaging and terms

### Bank Integration
- Dynamic bank availability
- Custom bank ordering
- Processing time display
- Instant payment indicators

## Monitoring

The application includes:
- Error tracking and reporting
- Payment flow analytics
- Performance monitoring
- Security event logging
