import { Prisma, type PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit';
import { requireRole } from '../auth/middleware';
import { MIN_PASSWORD_LENGTH, hashPassword } from '../auth/password';
import { HttpError, parseBody } from '../http';

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['analyst', 'admin']).default('analyst'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200),
});

const publicFields = { id: true, name: true, email: true, role: true, createdAt: true } as const;

/** User management. Admins only; mounted behind requireAuth. */
export function usersRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireRole('admin'));

  router.get('/', async (_req, res) => {
    const users = await prisma.user.findMany({
      select: publicFields,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ users });
  });

  router.post('/', async (req, res) => {
    const { name, email, role, password } = parseBody(req, createUserSchema);
    try {
      const user = await prisma.user.create({
        data: { name, email, role, passwordHash: await hashPassword(password) },
        select: publicFields,
      });
      await audit(prisma, {
        actorId: res.locals.user.id,
        action: 'user.create',
        entity: 'user',
        entityId: user.id,
        detail: { email, role },
      });
      res.status(201).json({ user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'A user with this email already exists');
      }
      throw error;
    }
  });

  return router;
}
