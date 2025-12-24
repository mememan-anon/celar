import { FastifyInstance } from 'fastify';

export async function health(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    reply.send({
      status: 'Hello, everything is ok',
    });
  });
}