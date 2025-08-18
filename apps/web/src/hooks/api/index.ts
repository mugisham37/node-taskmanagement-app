// Export all API hooks for easy importing
export { useAuth } from './useAuth';
export { useProjects } from './useProjects';
export { useTasks } from './useTasks';
export { useUsers } from './useUsers';

// Re-export trpc for direct access when needed
export { trpc } from '@/lib/trpc';
