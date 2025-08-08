import { DomainService as CoreDomainService } from '../domain-service';

/**
 * Re-export DomainService for backward compatibility
 */
export abstract class DomainService extends CoreDomainService {
  protected constructor() {
    super();
  }
}
