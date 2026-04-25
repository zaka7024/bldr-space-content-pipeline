import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/config.js';

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getConfig().jwtSecret) as { userId: string };
    c.set('userId', payload.userId);
    await next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}
