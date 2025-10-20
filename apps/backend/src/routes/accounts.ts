import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createInvite, listInvites, revokeInvite } from '../services/invite.js';
import { listUserAccounts } from '../services/user.js';
import { canAssignRole } from '../auth/roles.js';
import { recordAudit } from '../services/audit.js';

const router = Router();

router.use(requireAuth);

router.post('/', async (req, res, next) => {
  const schema = z.object({
    name: z.string().min(2).max(80),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const account = await prisma.account.create({
      data: {
        name: parsed.data.name,
        users: {
          create: {
            userId: req.auth!.userId,
            role: Role.owner,
          },
        },
      },
    });

    await recordAudit({
      accountId: account.id,
      userId: req.auth!.userId,
      action: 'account.created',
      metadata: { name: account.name },
    });

    return res.status(201).json(account);
  } catch (error) {
    return next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });
    const account = await prisma.account.findUnique({
      where: { id: req.auth.accountId },
    });
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });

    const memberships = await listUserAccounts(req.auth.userId);

    return res.json({
      account,
      memberships: memberships.map((item) => ({
        accountId: item.accountId,
        accountName: item.account.name,
        role: item.role,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/members', requireRole(Role.admin), async (req, res, next) => {
  try {
    const members = await prisma.userAccount.findMany({
      where: { accountId: req.auth!.accountId },
      include: { user: true },
      orderBy: { user: { email: 'asc' } },
    });
    return res.json(
      members.map(({ user, role, userId }) => ({
        userId,
        email: user.email,
        name: user.name,
        role,
        joinedAt: user.createdAt,
      }))
    );
  } catch (error) {
    return next(error);
  }
});

router.patch('/me/members/:userId', requireRole(Role.admin), async (req, res, next) => {
  const schema = z.object({
    role: z.nativeEnum(Role),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const targetUserId = req.params.userId;
    const newRole = parsed.data.role;

    if (req.auth?.userId === targetUserId && newRole !== Role.owner) {
      return res.status(400).json({ error: 'Não é possível rebaixar a si mesmo' });
    }

    const targetMembership = await prisma.userAccount.findUnique({
      where: { userId_accountId: { userId: targetUserId, accountId: req.auth!.accountId } },
    });
    if (!targetMembership) {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }

    if (!canAssignRole(req.auth!.role, newRole)) {
      return res.status(403).json({ error: 'Permissão insuficiente para atribuir papel' });
    }

    const updated = await prisma.userAccount.update({
      where: { userId_accountId: { userId: targetUserId, accountId: req.auth!.accountId } },
      data: { role: newRole },
    });

    await recordAudit({
      accountId: req.auth!.accountId,
      userId: req.auth!.userId,
      action: 'account.member.role-changed',
      metadata: { targetUserId, from: targetMembership.role, to: newRole },
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete('/me/members/:userId', requireRole(Role.admin), async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (req.auth?.userId === targetUserId) {
      return res.status(400).json({ error: 'Não é possível remover a si mesmo' });
    }

    const membership = await prisma.userAccount.findUnique({
      where: { userId_accountId: { userId: targetUserId, accountId: req.auth!.accountId } },
    });
    if (!membership) {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }

    if (!canAssignRole(req.auth!.role, membership.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }

    await prisma.userAccount.delete({
      where: { userId_accountId: { userId: targetUserId, accountId: req.auth!.accountId } },
    });

    await recordAudit({
      accountId: req.auth!.accountId,
      userId: req.auth!.userId,
      action: 'account.member.removed',
      metadata: { targetUserId },
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get('/me/invites', requireRole(Role.admin), async (req, res, next) => {
  try {
    const invites = await listInvites(req.auth!.accountId);
    return res.json(invites);
  } catch (error) {
    return next(error);
  }
});

router.post('/me/invites', requireRole(Role.admin), async (req, res, next) => {
  const schema = z.object({
    email: z.string().email(),
    role: z.nativeEnum(Role).default(Role.editor),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    if (!canAssignRole(req.auth!.role, parsed.data.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente para atribuir papel' });
    }

    const { invite, token } = await createInvite({
      accountId: req.auth!.accountId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: req.auth!.userId,
    });

    return res.status(201).json({
      invite,
      token,
    });
  } catch (error) {
    const status = (error as any).status ?? 500;
    return res.status(status).json({ error: (error as Error).message });
  }
});

router.post(
  '/me/invites/:inviteId/revoke',
  requireRole(Role.admin),
  async (req, res, next) => {
    try {
      const invite = await revokeInvite({
        inviteId: req.params.inviteId,
        accountId: req.auth!.accountId,
        userId: req.auth!.userId,
      });
      return res.json(invite);
    } catch (error) {
      const status = (error as any).status ?? 500;
      return res.status(status).json({ error: (error as Error).message });
    }
  }
);

export const accountsRouter = router;
