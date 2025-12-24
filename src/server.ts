(async () => {
  try {
    const { buildApp } = await import('./gatewayModule/app.ts');
    const { PORT } = await import('./gatewayModule/utils/config.ts');

    const app = buildApp();

    await app.listen({ port: PORT });
    console.log(`🚀 Fastify server running at http://localhost:${PORT}`);
  } catch (err) {
    console.error('🔥 Top-level error during startup:', err);
    process.exit(1);
  }
})();
