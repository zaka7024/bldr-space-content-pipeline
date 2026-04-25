import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../../config/config.js';
import { UserModel } from '../models/user.model.js';

export interface AuthResult {
  token: string;
  user:  { _id: string; name: string; email: string };
}

export async function signup(name: string, email: string, password: string): Promise<AuthResult> {
  const existing = await UserModel.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already in use'), { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.create({ name, email, passwordHash });

  const token = signToken(user._id.toString());
  return { token, user: { _id: user._id.toString(), name: user.name, email: user.email } };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await UserModel.findOne({ email });
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const token = signToken(user._id.toString());
  return { token, user: { _id: user._id.toString(), name: user.name, email: user.email } };
}

function signToken(userId: string): string {
  return jwt.sign({ userId }, getConfig().jwtSecret, { expiresIn: '30d' });
}
