import { Account, AccountType, OAuthProvider } from '../entities/account';

export interface IAccountRepository {
  save(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByUserId(userId: string): Promise<Account[]>;
  findByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<Account | null>;
  findByUserAndProvider(
    userId: string,
    provider: string
  ): Promise<Account | null>;
  findByType(
    type: AccountType,
    limit?: number,
    offset?: number
  ): Promise<Account[]>;
  findExpiredTokens(): Promise<Account[]>;
  findByRefreshToken(refreshToken: string): Promise<Account | null>;
  getAccountStats(): Promise<{
    totalAccounts: number;
    byProvider: Record<string, number>;
    byType: Record<AccountType, number>;
    withValidTokens: number;
    expiredTokens: number;
  }>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteByProvider(userId: string, provider: string): Promise<void>;
}
