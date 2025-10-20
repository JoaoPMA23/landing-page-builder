import { Role, InviteStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../prisma.js';
import { hashMagicToken } from '../auth/magicLink.js';
import { normalizeEmail } from './user.js';
import { recordAudit } from './audit.js';
import { logger } from '../logger.js';
import { INVITE_DAYS } from '../auth/constants.js';

const inviteTtlMs = INVITE_DAYS * 24 * 60 * 60 * 1000;

export const createInvite = async (params: {
  accountId: string;
  email: string;
  role: Role;
  invitedBy: string;
}) => {
  const email = normalizeEmail(params.email);
  const existingMember = await prisma.userAccount.findFirst({
    where: { accountId: params.accountId, user: { email } },
  });
  if (existingMember) {
    throw Object.assign(new Error('Usuário já faz parte da conta'), { status: 409 });
  }

  const rawToken = randomBytes(24).toString('hex');
  const hashed = hashMagicToken(rawToken);
  const expiresAt = new Date(Date.now() + inviteTtlMs);

  const invite = await prisma.accountInvite.create({
    data: {
      accountId: params.accountId,
      email,
      role: params.role,
      tokenHash: hashed,
      expiresAt,
    },
  });

  await recordAudit({
    accountId: params.accountId,
    userId: params.invitedBy,
    action: 'account.invite.created',
    metadata: { inviteId: invite.id, email, role: params.role },
  });

  return { invite, token: rawToken };
};

export const listInvites = (accountId: string) =>
  prisma.accountInvite.findMany({
    where: {
      accountId,
      status: InviteStatus.pending,
    },
    orderBy: { createdAt: 'desc' },
  });

export const revokeInvite = async (params: { inviteId: string; accountId: string; userId: string }) => {
  const invite = await prisma.accountInvite.findFirst({
    where: { id: params.inviteId, accountId: params.accountId },
  });
  if (!invite) {
    throw Object.assign(new Error('Convite não encontrado'), { status: 404 });
  }

  const updated = await prisma.accountInvite.update({
    where: { id: invite.id },
    data: {
      status: InviteStatus.revoked,
      revokedAt: new Date(),
    },
  });

  await recordAudit({
    accountId: params.accountId,
    userId: params.userId,
    action: 'account.invite.revoked',
    metadata: { inviteId: invite.id },
  });

  return updated;
};

export const validateInviteToken = async (token: string) => {
  const tokenHash = hashMagicToken(token);
  const invite = await prisma.accountInvite.findFirst({
    where: {
      tokenHash,
    },
  });

  if (!invite) return null;

  if (invite.status === InviteStatus.revoked || invite.status === InviteStatus.accepted) {
    logger.warn({ inviteId: invite.id }, 'invite no longer valid');
    return null;
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.accountInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.expired },
    });
    return null;
  }

  return invite;
};

export const markInviteAccepted = async (inviteId: string, userId: string, accountId: string) => {
  await prisma.accountInvite.update({
    where: { id: inviteId },
    data: {
      status: InviteStatus.accepted,
      acceptedAt: new Date(),
    },
  });

  await recordAudit({
    accountId,
    action: 'account.invite.accepted',
    metadata: { inviteId, userId },
  });
};
