import { DomainService } from './domain-service';

/**
 * Base service class for backward compatibility
 */
export abstract class BaseService extends DomainService {
  protected constructor() {
    super();
  }
}
