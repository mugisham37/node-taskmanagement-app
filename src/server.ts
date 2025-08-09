/**
 * Server setup and configuration
 * Sets up Fastify server with all middleware and routes
 */

import Fastify from 'fastify';

const fastify = Fastify({
  logger: true,
});

export async function startServer() {
  try {
    const port = process.env['PORT'] ? parseInt(process.env['PORT']) : 3000;
    const host = process.env['HOST'] || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

export { fastify };
