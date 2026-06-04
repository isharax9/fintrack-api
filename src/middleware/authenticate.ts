import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../utils/jwt';
import { unauthorized } from '../utils/errors';

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw unauthorized();
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    // Attach user payload to request
    (request as any).user = decoded;
  } catch (error) {
    throw unauthorized();
  }
};
