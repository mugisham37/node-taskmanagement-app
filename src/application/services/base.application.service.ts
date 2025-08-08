import { ILogger } from '../../shared/interfaces/logger.interface';
import { IUnitOfWork } from '../../shared/interfaces/repository.interface';

export abstract class BaseApplicationService {
    constructor(
        protected readonly logger: ILogger,
        protected readonly unitOfWork: IUnitOfWork
    ) { }

    protected async executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
        try {
            const result = await operation();
            await this.unitOfWork.commit();
            return result;
        } catch (error) {
            await this.unitOfWork.rollback();
            this.logger.error('Transaction failed', error);
            throw error;
        }
    }

    protected logInfo(message: string, data?: any): void {
        this.logger.info(message, data);
    }

    protected logError(message: string, error?: any): void {
        this.logger.error(message, error);
    }

    protected logWarning(message: string, data?: any): void {
        this.logger.warn(message, data);
    }

    protected logDebug(message: string, data?: any): void {
        this.logger.debug(message, data);
    }
}
