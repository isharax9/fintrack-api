import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'FinTrack API',
        description: 'Production API contract for FinTrack personal finance workflows.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:5001',
          description: 'Local development',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'Health' },
        { name: 'Auth' },
        { name: 'User' },
        { name: 'Accounts' },
        { name: 'Transactions' },
        { name: 'Categories' },
        { name: 'Tags' },
        { name: 'Transfers' },
        { name: 'Budgets' },
        { name: 'Reports' },
        { name: 'Savings' },
        { name: 'Recurring' },
        { name: 'Exports' },
        { name: 'Audit' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  fastify.get('/openapi.json', {
    schema: {
      hide: true,
    },
  }, async () => fastify.swagger());
});
