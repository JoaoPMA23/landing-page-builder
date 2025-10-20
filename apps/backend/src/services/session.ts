import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '../prisma.js';
import {
  AccessTokenClaims,
  createTokenPair,
  parseRefreshToken,
  verifyTokenHash,
} from '../auth/jwt.js';
import { recordAudit } from './audit.js';

interface SessionContext {
  userId: string;
  accountId: string;
  email: string;
  role: Role;
}

export const startSession = async (ctx: SessionContext) => {
  const sessionId = randomUUID();
  const tokens = await createTokenPair({
    sub: ctx.userId,
    accountId: ctx.accountId,
    email: ctx.email,
    role: ctx.role,
    sessionId,
  });

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: ctx.userId,
      accountId: ctx.accountId,
      refreshTokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshExpiresAt,
    },
  });

  await recordAudit({
    userId: ctx.userId,
    accountId: ctx.accountId,
    action: 'auth.session.started',
  });

  return tokens;
};

export const rotateSession = async (sessionId: string, claims: AccessTokenClaims) => {
  const tokens = await createTokenPair({
    ...claims,
    sessionId,
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshExpiresAt,
    },
  });

  await recordAudit({
    userId: claims.sub,
    accountId: claims.accountId,
    action: 'auth.session.rotated',
  });

  return tokens;
};

export const exchangeRefreshToken = async (refreshToken: string) => {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: parsed.sessionId },
    include: {
      user: true,
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  const membership = await prisma.userAccount.findUnique({
    where: {
      userId_accountId: {
        userId: session.userId,
        accountId: session.accountId,
      },
    },
  });

  if (!membership) return null;

  const match = await verifyTokenHash(parsed.secret, session.refreshTokenHash);
  if (!match) return null;

  const claims: AccessTokenClaims = {
    sub: membership.userId,
    accountId: membership.accountId,
    email: session.user.email,
    role: membership.role,
    sessionId: session.id,
  };

  const tokens = await rotateSession(session.id, claims);

  return {
    tokens,
    claims,
  };
};

export const endSession = async (sessionId: string) => {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return;

  await prisma.session.delete({ where: { id: sessionId } });
  await recordAudit({
    accountId: session.accountId,
    userId: session.userId,
    action: 'auth.session.ended',
  });
};
