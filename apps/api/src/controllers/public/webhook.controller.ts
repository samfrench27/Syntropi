// apps/api/src/controllers/public/webhook.controller.ts
import { Request, Response, NextFunction } from 'express';
import { createError } from '../../middleware/errorHandler';
import { winstonLogger as logger } from '../../utils/logger';
import * as paymentService from '../../services/payment.service';
import { PaymentStatus } from '../../models/payment.model';

// Token.io webhook event types
interface TokenWebhookEvent {
  id: string;
  type: string;
  created: string;
  data: {
    object: {
      id: string;
      status: string;
      memberId: string;
      initiation: {
        refId: string;
        remittanceInformationPrimary: string;
        amount: {
          value: string;
          currency: string;
        };
        creditor: any;
        debtor?: any;
        callbackUrl: string;
        flowType: string;
      };
      createdDateTime: string;
      updatedDateTime: string;
      statusReasonInformation?: string;
    };
  };
}

// Map Token.io status to Syntropi status
const mapTokenStatusToSyntropi = (tokenStatus: string): PaymentStatus => {
  switch (tokenStatus.toUpperCase()) {
    case 'PENDING':
      return PaymentStatus.PENDING;
    case 'AUTHORIZING':
    case 'AWAITING_AUTHORIZATION':
      return PaymentStatus.AUTHORIZING;
    case 'AUTHORIZED':
      return PaymentStatus.AUTHORIZED;
    case 'SUBMITTED':
    case 'SETTLEMENT_IN_PROGRESS':
      return PaymentStatus.SUBMITTED;
    case 'ACCEPTED':
      return PaymentStatus.ACCEPTED;
    case 'COMPLETED':
    case 'SETTLEMENT_COMPLETED':
      return PaymentStatus.COMPLETED;
    case 'FAILED':
    case 'FAILURE_INSUFFICIENT_FUNDS':
    case 'FAILURE_DECLINED':
      return PaymentStatus.FAILED;
    case 'CANCELLED':
    case 'EXPIRED':
      return PaymentStatus.CANCELLED;
    default:
      logger.warn('Unknown Token.io status:', { tokenStatus });
      return PaymentStatus.PENDING;
  }
};

// Handle Token.io webhooks
export const handleTokenWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const webhookEvent: TokenWebhookEvent = req.body;
    
    logger.info('Received Token.io webhook:', {
      eventId: webhookEvent.id,
      eventType: webhookEvent.type,
      paymentId: webhookEvent.data?.object?.id,
      status: webhookEvent.data?.object?.status,
      refId: webhookEvent.data?.object?.initiation?.refId
    });

    // Validate webhook structure
    if (!webhookEvent.data?.object?.id || !webhookEvent.data?.object?.status) {
      logger.error('Invalid webhook payload structure:', webhookEvent);
      res.status(400).json({ 
        success: false, 
        error: { message: 'Invalid webhook payload' } 
      });
      return;
    }

    const tokenPaymentId = webhookEvent.data.object.id;
    const tokenStatus = webhookEvent.data.object.status;
    const refId = webhookEvent.data.object.initiation?.refId;

    // Map Token.io status to Syntropi status
    const syntropiStatus = mapTokenStatusToSyntropi(tokenStatus);

    // Find payment by refId (which should be our paymentId)
    const payment = await paymentService.findPaymentByRefId(refId);
    
    if (!payment) {
      logger.warn('Payment not found for webhook:', { 
        tokenPaymentId, 
        refId,
        webhookEvent: webhookEvent.id 
      });
      // Still return 200 to acknowledge webhook receipt
      res.status(200).json({ success: true, message: 'Payment not found' });
      return;
    }

    // Update payment status
    await paymentService.updatePaymentStatus(
      payment.paymentId, 
      syntropiStatus, 
      `Token.io webhook: ${tokenStatus}`,
      webhookEvent.data.object.statusReasonInformation
    );

    logger.info('Payment status updated from webhook:', {
      paymentId: payment.paymentId,
      oldStatus: payment.status,
      newStatus: syntropiStatus,
      tokenStatus,
      webhookEventId: webhookEvent.id
    });

    // Return 200 to acknowledge webhook receipt
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      paymentId: payment.paymentId,
      status: syntropiStatus
    });

  } catch (error: any) {
    logger.error('Error processing Token.io webhook:', {
      error: error.message,
      webhookBody: req.body
    });
    
    // Still return 200 to prevent webhook retries for application errors
    res.status(200).json({ 
      success: false, 
      error: { message: 'Webhook processing failed' } 
    });
  }
};

// Health check for webhook endpoint
export const webhookHealthCheck = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ 
    success: true, 
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
};
