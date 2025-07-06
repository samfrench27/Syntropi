// apps/api/src/routes/public/webhook.routes.ts
import { Router } from 'express';
import { 
  handleTokenWebhook,
  webhookHealthCheck
} from '../../controllers/public/webhook.controller';

const router = Router();

// Token.io webhook endpoint - no auth required for webhooks
router.post('/token', handleTokenWebhook);

// Webhook health check
router.get('/health', webhookHealthCheck);

export default router;
