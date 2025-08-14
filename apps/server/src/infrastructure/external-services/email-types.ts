export interface EmailDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'pending';
  timestamp: Date;
  provider: string;
  error?: string;
  deliveredAt?: Date;
  bouncedAt?: Date;
  failedAt?: Date;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  pending: number;
}

export interface EmailProviderConfig {
  name: string;
  priority: number;
  enabled: boolean;
  rateLimit?: {
    requests: number;
    window: number; // in milliseconds
  };
}

export interface EmailQueueMetrics {
  totalItems: number;
  pendingItems: number;
  failedItems: number;
  processingItems: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  html: string;
  text: string;
}

export type LogContext = Record<string, any>;
