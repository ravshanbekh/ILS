import { PrismaClient } from '@prisma/client';
import { env } from './env';

const prisma = new PrismaClient({
  log: env.isDev ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;
