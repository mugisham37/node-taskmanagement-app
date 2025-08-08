import { DomainError as CoreDomainError } from './domain-error';

/**
 * Re-export DomainError for backward compatibility
 */
export abstract class DomainError extends CoreDomainError {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
  }
}
