import { Hono } from 'hono';
import { z } from 'zod';
import { signupDto } from './dtos/signup.dto.js';
import { loginDto } from './dtos/login.dto.js';
import { signup, login } from '../domain/services/auth.service.js';

export const authRouter = new Hono();

authRouter.post('/signup', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (raw === null) return c.json({ error: 'Invalid JSON body' }, 400);

  const parsed = signupDto.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: z.flattenError(parsed.error).fieldErrors }, 400);
  }

  try {
    const result = await signup(parsed.data.name, parsed.data.email, parsed.data.password);
    return c.json(result, 201);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number };
    return c.json({ error: e.message }, (e.status ?? 500) as 400 | 409 | 500);
  }
});

authRouter.post('/login', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (raw === null) return c.json({ error: 'Invalid JSON body' }, 400);

  const parsed = loginDto.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: z.flattenError(parsed.error).fieldErrors }, 400);
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password);
    return c.json(result, 200);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number };
    return c.json({ error: e.message }, (e.status ?? 500) as 400 | 401 | 500);
  }
});
