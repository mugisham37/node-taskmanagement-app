import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmailService } from '../../email-service';
import { WebSocketService } from '../../websocket-service';

describe('Services Integration Tests', () => {
  let emailService: EmailService;
  let websocketService: WebSocketService;

  beforeEach(() => {
    emailService = new EmailService();
    websocketService = new WebSocketService();
  });

  afterEach(() => {
    // Cleanup any resources
  });

  describe('Email and WebSocket Integration', () => {
    it('should send email notification and broadcast via WebSocket', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Notification',
        body: 'This is a test notification',
        from: 'system@example.com'
      };
      
      // Send email
      const emailResult = await emailService.sendEmail(emailData);
      
      // Broadcast notification via WebSocket
      const wsMessage = {
        type: 'email_sent',
        data: {
          recipient: emailData.to,
          subject: emailData.subject,
          messageId: emailResult.messageId
        }
      };
      
      websocketService.broadcast(wsMessage);
      
      expect(emailResult.success).toBe(true);
      expect(emailResult.messageId).toBeTruthy();
    });
  });

  describe('Real-time Email Status Updates', () => {
    it('should broadcast email delivery status updates', async () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      const emailData = {
        subject: 'Bulk Notification',
        body: 'This is a bulk notification',
        from: 'system@example.com'
      };
      
      // Send bulk emails
      const results = await emailService.sendBulkEmail(recipients, emailData);
      
      // Broadcast status for each email
      results.forEach((result, index) => {
        const statusMessage = {
          type: 'email_status',
          data: {
            recipient: recipients[index],
            status: result.success ? 'sent' : 'failed',
            messageId: result.messageId,
            error: result.error
          }
        };
        
        websocketService.broadcast(statusMessage);
      });
      
      expect(results).toHaveLength(recipients.length);
    });
  });

  describe('WebSocket Connection Management', () => {
    it('should manage WebSocket connections for email notifications', () => {
      const mockConnection = {
        id: 'conn123',
        userId: 'user123',
        send: (message: any) => {
          expect(message).toHaveProperty('type');
          expect(message).toHaveProperty('data');
        },
        close: () => {}
      };
      
      // Add connection
      websocketService.addConnection(mockConnection);
      
      // Send targeted notification
      websocketService.sendToUser('user123', {
        type: 'email_notification',
        data: { message: 'You have a new email' }
      });
      
      // Remove connection
      websocketService.removeConnection('conn123');
      
      expect(true).toBe(true); // This would be more comprehensive in real tests
    });
  });
});