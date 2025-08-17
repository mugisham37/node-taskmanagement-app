import { router } from '../trpc/router';
import { authRouter } from './auth';
import { tasksRouter } from './tasks';
import { projectsRouter } from './projects';
import { usersRouter } from './users';

export const appRouter = router({
  auth: authRouter,
  tasks: tasksRouter,
  projects: projectsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;

