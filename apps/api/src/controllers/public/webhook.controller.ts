// apps/api/src/controllers/public/webhook.controller.ts
import { Request, Response } from 'express';
import { winstonLogger as logger } from '../../utils/logger';
import * as paymentService from '../../services/payment.service';
import { PaymentStatus } from '../../models/payment.model';

// Token.io v2 payments webhook payload interface
interface TokenWebhookEvent {
  id: string;
  type: string;
  version: string;
  livemode: boolean;
  created: number;
  data: {
    object: {
      id: string;
      object: string;
      livemode: boolean;
      created: number;
      updated: number;
      status: string;
      provider_payment_id: string;
      currency: string;
      amount: number;
      reference: string;
      description?: string;
      initiation: {
        refId: string;
        endToEndId?: string;
        instructionId?: string;
        instructedAmount: {
          amount: number;
          currency: string;
        };
        creditorAccount: {
          iban: string;
          ownerName: string;
        };
        debtorAccount?: {
          iban: string;
          ownerName: string;
        };
        remittanceInformation?: {
          unstructured?: string;
          structured?: {
            creditorReferenceInformation?: {
              reference?: string;
            };
          };
        };
      };
      statusReasonInformation?: string;
      execution?: {
        statusDetail?: string;
        providerPaymentId?: string;
      };
    };
  };
}

// Map Token.io status to Syntropi status
const mapTokenStatusToSyntropi = (tokenStatus: string): PaymentStatus => {
  switch (tokenStatus.toUpperCase()) {
    // Initial pending states - all authorization/initiation steps
    case 'INITIATION_PENDING':
    case 'INITIATION_PENDING_REDIRECT_AUTH':
    case 'INITIATION_PENDING_REDIRECT_AUTH_VERIFICATION':
    case 'INITIATION_PENDING_REDIRECT_HP':
    case 'INITIATION_PENDING_EMBEDDED_AUTH':
    case 'INITIATION_PENDING_EMBEDDED_AUTH_VERIFICATION':
    case 'INITIATION_PENDING_DECOUPLED_AUTH':
      return PaymentStatus.AUTHORIZING;
    
    // Ready for redemption - authorized but not yet submitted
    case 'INITIATION_PENDING_REDEMPTION':
    case 'INITIATION_PENDING_REDEMPTION_VERIFICATION':
      return PaymentStatus.AUTHORIZED;
    
    // Processing states - payment has been submitted to bank
    case 'INITIATION_PROCESSING':
      return PaymentStatus.SUBMITTED;
    
    // Initiation completed - payment accepted by bank
    case 'INITIATION_COMPLETED':
      return PaymentStatus.ACCEPTED;
    
    // Settlement states - payment is being processed for final settlement
    case 'SETTLEMENT_IN_PROGRESS':
      return PaymentStatus.SUBMITTED;
    
    // Final success state - payment fully completed
    case 'SETTLEMENT_COMPLETED':
      return PaymentStatus.COMPLETED;
    
    // Failed states - various failure reasons
    case 'INITIATION_REJECTED':
    case 'INITIATION_REJECTED_INSUFFICIENT_FUNDS':
    case 'INITIATION_FAILED':
    case 'SETTLEMENT_INCOMPLETE':
      return PaymentStatus.FAILED;
    
    // Cancelled/declined states
    case 'INITIATION_DECLINED':
    case 'INITIATION_EXPIRED':
      return PaymentStatus.CANCELLED;
    
    // Uncertain final state - treat as pending for manual review
    case 'INITIATION_NO_FINAL_STATUS_AVAILABLE':
      return PaymentStatus.PENDING;
    
    default:
      logger.warn('Unknown Token.io status:', { tokenStatus });
      return PaymentStatus.PENDING;
  }
};

// Handle Token.io webhooks
export const handleTokenWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookEvent: TokenWebhookEvent = req.body;
    
    logger.info('Received Token.io webhook:', {
      eventId: webhookEvent.id,
      eventType: webhookEvent.type,
      version: webhookEvent.version,
      livemode: webhookEvent.livemode,
      paymentId: webhookEvent.data?.object?.id,
      providerPaymentId: webhookEvent.data?.object?.provider_payment_id,
      status: webhookEvent.data?.object?.status,
      refId: webhookEvent.data?.object?.initiation?.refId,
      amount: webhookEvent.data?.object?.amount,
      currency: webhookEvent.data?.object?.currency
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
    const providerPaymentId = webhookEvent.data.object.provider_payment_id;
    const statusDetail = webhookEvent.data.object.execution?.statusDetail;

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

    // Prepare status message with additional details
    const statusMessage = [
      `Token.io webhook: ${tokenStatus}`,
      providerPaymentId ? `Provider ID: ${providerPaymentId}` : null,
      statusDetail ? `Detail: ${statusDetail}` : null,
      webhookEvent.data.object.statusReasonInformation ? `Reason: ${webhookEvent.data.object.statusReasonInformation}` : null
    ].filter(Boolean).join(' | ');

    // Update payment status
    await paymentService.updatePaymentStatus(
      payment.paymentId, 
      syntropiStatus, 
      statusMessage,
      webhookEvent.data.object.statusReasonInformation
    );

    logger.info('Payment status updated from webhook:', {
      paymentId: payment.paymentId,
      oldStatus: payment.status,
      newStatus: syntropiStatus,
      tokenStatus,
      providerPaymentId,
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
      stack: error.stack,
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
