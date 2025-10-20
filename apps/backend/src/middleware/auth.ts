import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import { verifyAccessToken } from '../auth/jwt.js';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { hasRequiredRole } from '../auth/roles.js';

const unauthorized = (res: Response, message = 'Unauthorized') =>
  res.status(401).json({ error: message });

const forbidden = (res: Response, message = 'Forbidden') =>
  res.status(403).json({ error: message });

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return unauthorized(res, 'Missing bearer token');
    }

    const rawToken = header.replace('Bearer ', '').trim();
    const claims = verifyAccessToken(rawToken);
    if (!claims) {
      return unauthorized(res, 'Invalid or expired token');
    }

    const session = await prisma.session.findUnique({
      where: { id: claims.sessionId },
    });
    if (!session) {
      return unauthorized(res, 'Session not found');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      return unauthorized(res, 'Session expired');
    }

    if (session.userId !== claims.sub || session.accountId !== claims.accountId) {
      logger.warn(
        {
          sessionId: session.id,
          tokenAccount: claims.accountId,
          dbAccount: session.accountId,
        },
        'token claims mismatch'
      );
      return unauthorized(res);
    }

    const membership = await prisma.userAccount.findUnique({
      where: {
        userId_accountId: {
          userId: claims.sub,
          accountId: claims.accountId,
        },
      },
    });

    if (!membership) {
      return forbidden(res, 'Membership revoked');
    }

    req.auth = {
      userId: membership.userId,
      accountId: membership.accountId,
      email: claims.email,
      role: membership.role,
      sessionId: session.id,
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRole = (...roles: Role[]) => {
  const required = roles.length > 0 ? roles : [RoleEnum.editor];
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return unauthorized(res);
    }
    if (!hasRequiredRole(req.auth.role, required)) {
      return forbidden(res, 'Insufficient role');
    }
    return next();
  };
};
