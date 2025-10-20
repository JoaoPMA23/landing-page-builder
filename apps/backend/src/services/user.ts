import { Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { recordAudit } from './audit.js';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email: normalizeEmail(email) } });

export const upsertUser = async (params: { email: string; name?: string | null }) => {
  const email = normalizeEmail(params.email);
  const data: Prisma.UserUpdateInput = {};
  if (params.name && params.name.trim()) {
    data.name = params.name.trim();
  }
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: params.name ?? null,
    },
    update: data,
  });
};

export const createAccountWithOwner = async (params: {
  userId: string;
  accountName: string;
}) => {
  const account = await prisma.account.create({
    data: {
      name: params.accountName,
      users: {
        create: {
          userId: params.userId,
          role: Role.owner,
        },
      },
    },
  });

  await recordAudit({
    accountId: account.id,
    userId: params.userId,
    action: 'account.created',
  });

  return account;
};

export const ensureMembership = async (params: {
  userId: string;
  accountId: string;
  role: Role;
}) => {
  const membership = await prisma.userAccount.findUnique({
    where: {
      userId_accountId: {
        userId: params.userId,
        accountId: params.accountId,
      },
    },
  });

  if (!membership) {
    const created = await prisma.userAccount.create({
      data: {
        userId: params.userId,
        accountId: params.accountId,
        role: params.role,
      },
    });

    await recordAudit({
      accountId: params.accountId,
      userId: params.userId,
      action: 'account.member.added',
      metadata: { role: params.role },
    });
    return created;
  }

  if (membership.role !== params.role) {
    // Upgrade role if the new one is higher in the hierarchy.
    const hierarchy: Record<Role, number> = { editor: 1, admin: 2, owner: 3 };
    if (hierarchy[params.role] > hierarchy[membership.role]) {
      const updated = await prisma.userAccount.update({
        where: { userId_accountId: { userId: params.userId, accountId: params.accountId } },
        data: { role: params.role },
      });

      await recordAudit({
        accountId: params.accountId,
        userId: params.userId,
        action: 'account.member.role-upgrade',
        metadata: { from: membership.role, to: params.role },
      });

      return updated;
    }
  }

  return membership;
};

export const listUserAccounts = (userId: string) =>
  prisma.userAccount.findMany({
    where: { userId },
    include: {
      account: true,
    },
    orderBy: {
      account: { createdAt: 'asc' },
    },
  });

export const getMembership = async (params: { userId: string; accountId?: string }) => {
  if (params.accountId) {
    return prisma.userAccount.findUnique({
      where: {
        userId_accountId: {
          userId: params.userId,
          accountId: params.accountId,
        },
      },
      include: { account: true, user: true },
    });
  }

  return prisma.userAccount.findFirst({
    where: { userId: params.userId },
    include: { account: true, user: true },
    orderBy: { account: { createdAt: 'asc' } },
  });
};

const defaultAccountName = (email: string) => {
  const prefix = email.split('@')[0] ?? 'workspace';
  return `${prefix}'s workspace`;
};

export const ensureDefaultAccount = async (params: {
  userId: string;
  email: string;
  accountName?: string;
}) => {
  const existing = await listUserAccounts(params.userId);
  if (existing.length > 0) {
    return existing[0].account;
  }

  const name = params.accountName?.trim() || defaultAccountName(params.email);
  return createAccountWithOwner({ userId: params.userId, accountName: name });
};
