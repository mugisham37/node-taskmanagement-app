import { Specification } from './specification';
import {
  Webhook,
  WebhookDelivery,
  WebhookStatus,
  WebhookEvent,
  WebhookDeliveryStatus,
} from '../entities/webhook';

export class WebhookIsActiveSpecification extends Specification<Webhook> {
  isSatisfiedBy(webhook: Webhook): boolean {
    return webhook.isActive();
  }
}

export class WebhookCanTriggerSpecification extends Specification<Webhook> {
  isSatisfiedBy(webhook: Webhook): boolean {
    return webhook.canTrigger();
  }
}

export class WebhookSupportsEventSpecification extends Specification<Webhook> {
  constructor(private readonly event: WebhookEvent) {
    super();
  }

  isSatisfiedBy(webhook: Webhook): boolean {
    return webhook.supportsEvent(this.event);
  }
}

export class WebhookByStatusSpecification extends Specification<Webhook> {
  constructor(private readonly status: WebhookStatus) {
    super();
  }

  isSatisfiedBy(webhook: Webhook): boolean {
    return webhook.status === this.status;
  }
}

export class WebhookByWorkspaceSpecification extends Specification<Webhook> {
  constructor(private readonly workspaceId: string) {
    super();
  }

  isSatisfiedBy(webhook: Webhook): boolean {
    return webhook.workspaceId === this.workspaceId;
  }
}

export class WebhookIsHealthySpecification extends Specification<Webhook> {
  isSatisfiedBy(webhook: Webhook): boolean {
    const health = webhook.getHealthStatus();
    return health.isHealthy;
  }
}

export class WebhookHasRecentFailuresSpecification extends Specification<Webhook> {
  constructor(private readonly threshold: number = 3) {
    super();
  }

  isSatisfiedBy(webhook: Webhook): boolean {
    return webhook.failureCount >= this.threshold;
  }
}

// Webhook Delivery Specifications

export class WebhookDeliveryCanRetrySpecification extends Specification<WebhookDelivery> {
  isSatisfiedBy(delivery: WebhookDelivery): boolean {
    return delivery.canRetry();
  }
}

export class WebhookDeliveryIsReadyForRetrySpecification extends Specification<WebhookDelivery> {
  isSatisfiedBy(delivery: WebhookDelivery): boolean {
    return delivery.isReadyForRetry();
  }
}

export class WebhookDeliveryByStatusSpecification extends Specification<WebhookDelivery> {
  constructor(private readonly status: WebhookDeliveryStatus) {
    super();
  }

  isSatisfiedBy(delivery: WebhookDelivery): boolean {
    return delivery.status === this.status;
  }
}

export class WebhookDeliveryByEventSpecification extends Specification<WebhookDelivery> {
  constructor(private readonly event: WebhookEvent) {
    super();
  }

  isSatisfiedBy(delivery: WebhookDelivery): boolean {
    return delivery.event === this.event;
  }
}

export class WebhookDeliveryIsSuccessfulSpecification extends Specification<WebhookDelivery> {
  isSatisfiedBy(delivery: WebhookDelivery): boolean {
    return delivery.isSuccess();
  }
}

export class WebhookDeliveryIsFailedSpecification extends Specification<WebhookDelivery> {
  isSatisfiedBy(delivery: WebhookDelivery): boolean {
    return delivery.isFailed();
  }
}

export class WebhookDeliveryCreatedAfterSpecification extends Specification<WebhookDelivery> {
  constructor(private readonly date: Date) {
    super();
  }

  isSatisfiedBy(delivery: WebhookDelivery): boolean {
    return delivery.createdAt > this.date;
  }
}
