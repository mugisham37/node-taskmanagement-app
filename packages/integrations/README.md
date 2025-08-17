# @taskmanagement/integrations

Comprehensive integrations package for email, SMS, push notifications, calendar, file storage, webhooks, payment, analytics, social media, and AI services.

## Features

- **Email Service**: Multi-provider email sending (SendGrid, Mailgun, Nodemailer)
- **SMS Service**: SMS notifications via Twilio
- **Push Notifications**: Firebase Cloud Messaging and Apple Push Notifications
- **WebSocket Service**: Real-time communication management
- **File Storage**: AWS S3, Google Cloud Storage integration
- **Payment Processing**: Stripe, PayPal integration
- **Calendar Integration**: Google Calendar, Outlook integration
- **AI Services**: OpenAI, Anthropic integration
- **Social Media**: Facebook, Twitter, LinkedIn APIs
- **Analytics**: Google Analytics, custom analytics

## Installation

```bash
npm install @taskmanagement/integrations
```

## Usage

```typescript
import { EmailService, WebSocketService } from '@taskmanagement/integrations';

// Initialize services
const emailService = new EmailService();
const wsService = new WebSocketService();

// Send email
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our platform',
  from: 'noreply@example.com'
});

// WebSocket communication
wsService.broadcast({
  type: 'notification',
  data: { message: 'New update available' }
});

wsService.sendToUser('user123', {
  type: 'personal_message',
  data: { message: 'Hello user!' }
});
```

## Testing

```bash
npm test
npm run test:coverage
npm run test:watch
```

## Dependencies

- Nodemailer, SendGrid, Mailgun for email
- Twilio for SMS
- Firebase Admin for push notifications
- AWS SDK for cloud services
- Stripe for payments
- Various third-party service integrations