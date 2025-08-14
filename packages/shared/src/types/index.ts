// Base entity interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Export all type modules
export * from './api';
export * from './auth';
export * from './tasks';
export * from './projects';
export * from './users';