import { beforeEach, describe, expect, it } from 'vitest';
import { EmailService } from '../email-service';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        from: 'sender@example.com'
      };
      
      const result = await emailService.sendEmail(emailData);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('messageId');
    });

    it('should handle email sending errors', async () => {
      const invalidEmailData = {
        to: 'invalid-email',
        subject: 'Test Subject',
        body: 'Test Body',
        from: 'sender@example.com'
      };
      
      await expect(emailService.sendEmail(invalidEmailData)).rejects.toThrow();
    });
  });

  describe('sendBulkEmail', () => {
    it('should send bulk emails successfully', async () => {
      const recipients = ['test1@example.com', 'test2@example.com'];
      const emailData = {
        subject: 'Bulk Test Subject',
        body: 'Bulk Test Body',
        from: 'sender@example.com'
      };
      
      const results = await emailService.sendBulkEmail(recipients, emailData);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(recipients.length);
    });
  });

  describe('validateEmailAddress', () => {
    it('should validate correct email addresses', () => {
      const validEmail = 'test@example.com';
      
      const isValid = emailService.validateEmailAddress(validEmail);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const invalidEmail = 'invalid-email';
      
      const isValid = emailService.validateEmailAddress(invalidEmail);
      
      expect(isValid).toBe(false);
    });
  });
});