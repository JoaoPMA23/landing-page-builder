import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import argon2 from 'argon2';
import type { Role } from '@prisma/client';
import { ISSUER, JWT_ACCESS_MINUTES, JWT_REFRESH_DAYS, JWT_SECRET } from './constants.js';

export interface AccessTokenClaims extends jwt.JwtPayload {
  sub: string;
  accountId: string;
  email: string;
  role: Role;
  sessionId: string;
}

const refreshTtlMs = JWT_REFRESH_DAYS * 24 * 60 * 60 * 1000;

export const signAccessToken = (
  claims: Omit<AccessTokenClaims, 'iat' | 'exp'>
): string =>
  jwt.sign(claims, JWT_SECRET, {
    expiresIn: `${JWT_ACCESS_MINUTES}m`,
    issuer: ISSUER,
  });

export const verifyAccessToken = (token: string): AccessTokenClaims | null => {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: ISSUER }) as AccessTokenClaims;
  } catch {
    return null;
  }
};

export const generateRefreshToken = (): { token: string; expiresAt: Date } => {
  const token = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + refreshTtlMs);
  return { token, expiresAt };
};

export const hashToken = (token: string) => argon2.hash(token);

export const verifyTokenHash = (token: string, hash: string) => argon2.verify(hash, token);

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
}

export const createTokenPair = async (
  claims: Omit<AccessTokenClaims, 'iat' | 'exp'>
): Promise<TokenPair> => {
  const accessToken = signAccessToken(claims);
  const { token: refreshSecret, expiresAt } = generateRefreshToken();
  const refreshToken = `${claims.sessionId}.${refreshSecret}`;
  const refreshTokenHash = await hashToken(refreshSecret);
  return {
    accessToken,
    refreshToken,
    refreshTokenHash,
    refreshExpiresAt: expiresAt,
  };
};

export const parseRefreshToken = (
  token: string
): { sessionId: string; secret: string } | null => {
  const [sessionId, secret] = token.split('.');
  if (!sessionId || !secret) return null;
  return { sessionId, secret };
};
