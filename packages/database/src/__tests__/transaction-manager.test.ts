import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseConfig } from '../config';
import { DatabaseConnection } from '../connection';
import { TransactionManager } from '../transaction-manager';

describe('TransactionManager', () => {
  let transactionManager: TransactionManager;
  let connection: DatabaseConnection;

  beforeEach(() => {
    const config = createDatabaseConfig('test');
    connection = DatabaseConnection.getInstance(config);
    transactionManager = new TransactionManager(connection);
  });

  afterEach(async () => {
    if (connection) {
      await connection.disconnect();
    }
  });

  describe('executeInTransaction', () => {
    it('should execute operation within transaction', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await transactionManager.executeInTransaction(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(
        transactionManager.executeInTransaction(mockOperation)
      ).rejects.toThrow('Operation failed');
    });

    it('should handle nested transactions', async () => {
      const nestedOperation = vi.fn().mockResolvedValue('nested success');
      const mainOperation = vi.fn().mockImplementation(async () => {
        return await transactionManager.executeInTransaction(nestedOperation);
      });
      
      const result = await transactionManager.executeInTransaction(mainOperation);
      
      expect(result).toBe('nested success');
      expect(mainOperation).toHaveBeenCalled();
      expect(nestedOperation).toHaveBeenCalled();
    });
  });

  describe('begin', () => {
    it('should start new transaction', async () => {
      await transactionManager.begin();
      
      expect(transactionManager.isInTransaction()).toBe(true);
    });

    it('should handle multiple begin calls', async () => {
      await transactionManager.begin();
      await transactionManager.begin();
      
      expect(transactionManager.isInTransaction()).toBe(true);
    });
  });

  describe('commit', () => {
    it('should commit active transaction', async () => {
      await transactionManager.begin();
      await transactionManager.commit();
      
      expect(transactionManager.isInTransaction()).toBe(false);
    });

    it('should handle commit without active transaction', async () => {
      await expect(transactionManager.commit()).resolves.not.toThrow();
    });
  });

  describe('rollback', () => {
    it('should rollback active transaction', async () => {
      await transactionManager.begin();
      await transactionManager.rollback();
      
      expect(transactionManager.isInTransaction()).toBe(false);
    });

    it('should handle rollback without active transaction', async () => {
      await expect(transactionManager.rollback()).resolves.not.toThrow();
    });
  });

  describe('savepoint operations', () => {
    it('should create and release savepoint', async () => {
      await transactionManager.begin();
      
      const savepointName = await transactionManager.createSavepoint();
      expect(savepointName).toBeTruthy();
      
      await transactionManager.releaseSavepoint(savepointName);
      await transactionManager.commit();
    });

    it('should rollback to savepoint', async () => {
      await transactionManager.begin();
      
      const savepointName = await transactionManager.createSavepoint();
      await transactionManager.rollbackToSavepoint(savepointName);
      
      await transactionManager.commit();
    });
  });
});