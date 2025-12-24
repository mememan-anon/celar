import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { health } from './routes/health.ts';
import { pspRoutes } from './routes/psps.ts';
import { merchantRoutes } from './routes/merchants.ts';
import { paymentRoutes } from './routes/payments.ts';
import { riskRoutes } from './routes/risk-route.ts';
import {webhookRoutes} from './routes/webhook.ts'
import fastifyRateLimit from '@fastify/rate-limit';


export function buildApp() {
  const app = Fastify();

  // Register plugins
  app.register(cors);
  app.register(helmet);

  //disabled global rate limit and only on some routes
  app.register(fastifyRateLimit, {
    global: false
  });

  //registered routes
  app.register(health, { prefix: '/api/v1' });
  app.register(pspRoutes, { prefix: '/api/v1' });
  app.register(merchantRoutes, { prefix: '/api/v1' });
  app.register(paymentRoutes, { prefix: '/api/v1' });
  app.register(riskRoutes, { prefix: '/api/v1' });
  app.register(webhookRoutes, { prefix: '/api/v1' });
  return app;
}