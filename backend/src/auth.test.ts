import { describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { loginSchema, registerSchema } from './validators/schemas';
import { signToken } from './utils/jwt';
import { env } from './config/env';

describe('authentication boundaries', () => {
  it('validates registration credentials and normalizes email', () => {
    const result = registerSchema.parse({ fullName: 'Test Innovator', email: 'TEST@EXAMPLE.COM', password: 'ChangeMe123!', phoneNumber: '+254712345678', identificationId: 'TEST-001' });
    expect(result.email).toBe('test@example.com');
  });

  it('accepts Kenyan mobile numbers beginning with 7 or 1 in international format', () => {
    for (const phoneNumber of ['+254712345678', '+254798765432', '+254110123456']) {
      expect(registerSchema.safeParse({
        fullName: 'Test Innovator',
        email: 'test@example.com',
        password: 'ChangeMe123!',
        phoneNumber,
        identificationId: 'TEST-001'
      }).success).toBe(true);
    }
  });

  it('rejects local, prefixed, malformed, and unsupported Kenyan phone formats', () => {
    for (const phoneNumber of [
      '0712345678',
      '712345678',
      '254712345678',
      '+2540712345678',
      '+25471234567',
      '+254812345678'
    ]) {
      expect(registerSchema.safeParse({
        fullName: 'Test Innovator',
        email: 'test@example.com',
        password: 'ChangeMe123!',
        phoneNumber,
        identificationId: 'TEST-001'
      }).success).toBe(false);
    }
  });

  it('rejects invalid login input', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: '' }).success).toBe(false);
  });

  it('hashes and verifies passwords with bcrypt', async () => {
    const hash = await bcrypt.hash('ChangeMe123!', 4);
    expect(hash).not.toBe('ChangeMe123!');
    expect(await bcrypt.compare('ChangeMe123!', hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });

  it('signs JWTs with user identity and role only', () => {
    const token = signToken('user-123', Role.INNOVATOR);
    const claims = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(claims.userId).toBe('user-123');
    expect(claims.role).toBe(Role.INNOVATOR);
    expect(claims.passwordHash).toBeUndefined();
  });
});
