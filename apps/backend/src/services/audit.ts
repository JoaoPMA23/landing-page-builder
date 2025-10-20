import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

/**
 * Persists an audit log entry and mirrors it to the structured logger.
 * Centralizing here keeps behaviour consistent across routes.
 */
export const recordAudit = async (params: {
  accountId?: string;
  userId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) => {
  const entry = await prisma.auditLog.create({
    data: {
      accountId: params.accountId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      metadata: params.metadata,
    },
  });
  logger.info(
    { auditId: entry.id, accountId: entry.accountId, userId: entry.userId, action: entry.action },
    'audit event recorded'
  );
  return entry;
};
