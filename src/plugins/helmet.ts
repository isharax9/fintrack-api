import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

export default fp(async (fastify) => {
  fastify.register(helmet, {
    global: true
  });
});
