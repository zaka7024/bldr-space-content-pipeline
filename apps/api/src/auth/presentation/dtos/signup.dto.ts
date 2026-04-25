import { z } from 'zod';

export const signupDto = z.object({
  name:     z.string().min(1).max(100),
  email:    z.email(),
  password: z.string().min(8).max(128),
});
