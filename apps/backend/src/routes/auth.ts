import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../prisma.js';
import { createMagicToken, hashMagicToken } from '../auth/magicLink.js';
import { startSession, exchangeRefreshToken, endSession } from '../services/session.js';
import {
  upsertUser,
  ensureDefaultAccount,
  ensureMembership,
  getMembership,
  listUserAccounts,
  normalizeEmail,
} from '../services/user.js';
import { recordAudit } from '../services/audit.js';
import { validateInviteToken, markInviteAccepted } from '../services/invite.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import { GOOGLE_CLIENT_ID } from '../auth/constants.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../logger.js';

const router = Router();

const buildAuthResponse = async ({
  userId,
  accountId,
  email,
  tokens,
}: {
  userId: string;
  accountId: string;
  email: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
  };
}) => {
  const membership = await prisma.userAccount.findUnique({
    where: { userId_accountId: { userId, accountId } },
    include: {
      account: true,
      user: true,
    },
  });

  if (!membership) {
    throw new Error('membership not found after session creation');
  }

  const accounts = await listUserAccounts(userId);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresAt: tokens.refreshExpiresAt.toISOString(),
    user: {
      id: membership.user.id,
      email,
      name: membership.user.name,
    },
    account: {
      id: membership.account.id,
      name: membership.account.name,
      plan: membership.account.plan,
      role: membership.role,
    },
    accounts: accounts.map((item) => ({
      id: item.account.id,
      name: item.account.name,
      role: item.role,
      plan: item.account.plan,
    })),
  };
};

router.post('/magic-link/request', async (req, res, next) => {
  const schema = z.object({
    email: z.string().email(),
    accountName: z.string().min(2).max(80).optional(),
    accountId: z.string().uuid().optional(),
    inviteToken: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error);
  }

  try {
    const { email, accountName, accountId, inviteToken } = parsed.data;

    const invite = inviteToken ? await validateInviteToken(inviteToken) : null;
    if (inviteToken && !invite) {
      return res.status(400).json({ error: 'Convite inválido ou expirado' });
    }

    if (invite && normalizeEmail(email) !== invite.email) {
      return res.status(400).json({ error: 'Convite e e-mail não conferem' });
    }

    const user = await upsertUser({ email });

    let targetAccountId = invite?.accountId ?? accountId ?? undefined;

    if (invite && invite.role === null) {
      return res.status(400).json({ error: 'Convite sem papel associado' });
    }

    if (!targetAccountId) {
      const defaultAccount = await ensureDefaultAccount({
        userId: user.id,
        email,
        accountName,
      });
      targetAccountId = defaultAccount.id;
    } else {
      const membership = await getMembership({ userId: user.id, accountId: targetAccountId });
      if (!membership && !invite) {
        return res
          .status(403)
          .json({ error: 'Usuário não pertence à conta solicitada' });
      }
    }

    const { token, tokenHash, expiresAt } = createMagicToken();
    await prisma.magicLinkToken.create({
      data: {
        email: normalizeEmail(email),
        userId: user.id,
        tokenHash,
        accountId: targetAccountId,
        role: invite?.role ?? null,
        expiresAt,
      },
    });

    await recordAudit({
      userId: user.id,
      accountId: targetAccountId,
      action: 'auth.magic_link.requested',
    });

    // Para MVP retornamos o token para facilitar o consumo manual.
    return res.json({
      message: 'Link mágico gerado',
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/magic-link/verify', async (req, res, next) => {
  const schema = z.object({
    token: z.string().min(10),
    accountId: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const { token, accountId } = parsed.data;
    const tokenHash = hashMagicToken(token);

    const record = await prisma.magicLinkToken.findUnique({
      where: { tokenHash },
    });
    if (!record) return res.status(400).json({ error: 'Token inválido' });

    if (record.consumedAt) return res.status(400).json({ error: 'Token já utilizado' });
    if (record.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    const user = await prisma.user.findUnique({ where: { id: record.userId ?? '' } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    let targetAccountId = accountId ?? record.accountId ?? undefined;
    let membership = await getMembership({ userId: user.id, accountId: targetAccountId });

    if (!membership) {
      if (record.accountId && record.role) {
        await ensureMembership({
          userId: user.id,
          accountId: record.accountId,
          role: record.role as Role,
        });
        membership = await getMembership({ userId: user.id, accountId: record.accountId });
        targetAccountId = record.accountId ?? membership?.account.id;
      } else if (!targetAccountId) {
        const account = await ensureDefaultAccount({
          userId: user.id,
          email: user.email,
        });
        membership = await getMembership({ userId: user.id, accountId: account.id });
        targetAccountId = account.id;
      }
    }

    if (!membership) {
      return res.status(403).json({ error: 'Usuário não vinculado à conta' });
    }

    const tokens = await startSession({
      userId: membership.user.id,
      email: membership.user.email,
      accountId: membership.account.id,
      role: membership.role,
    });

    await prisma.magicLinkToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const invite = await prisma.accountInvite.findFirst({
      where: { tokenHash, accountId: membership.account.id },
    });
    if (invite) {
      await markInviteAccepted(invite.id, membership.user.id, membership.account.id);
      await ensureMembership({
        userId: membership.user.id,
        accountId: membership.account.id,
        role: invite.role,
      });
    }

    await recordAudit({
      userId: membership.user.id,
      accountId: membership.account.id,
      action: 'auth.magic_link.login',
    });

    const payload = await buildAuthResponse({
      userId: membership.user.id,
      accountId: membership.account.id,
      email: membership.user.email,
      tokens,
    });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

router.post('/google', async (req, res, next) => {
  const schema = z.object({
    idToken: z.string().min(10),
    accountId: z.string().uuid().optional(),
    inviteToken: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth não configurado' });
  }

  try {
    const { idToken, accountId, inviteToken } = parsed.data;
    const profile = await verifyGoogleIdToken(idToken);

    const invite = inviteToken ? await validateInviteToken(inviteToken) : null;
    if (inviteToken && !invite) {
      return res.status(400).json({ error: 'Convite inválido ou expirado' });
    }
    if (invite && normalizeEmail(profile.email) !== invite.email) {
      return res.status(400).json({ error: 'Convite e e-mail não conferem' });
    }

    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
    });

    let targetAccountId = invite?.accountId ?? accountId ?? undefined;
    let membership = await getMembership({ userId: user.id, accountId: targetAccountId });

    if (!membership) {
      if (invite) {
        await ensureMembership({
          userId: user.id,
          accountId: invite.accountId,
          role: invite.role,
        });
        membership = await getMembership({
          userId: user.id,
          accountId: invite.accountId,
        });
        targetAccountId = invite.accountId;
        await markInviteAccepted(invite.id, user.id, invite.accountId);
      } else {
        const account = await ensureDefaultAccount({
          userId: user.id,
          email: user.email,
        });
        membership = await getMembership({ userId: user.id, accountId: account.id });
        targetAccountId = account.id;
      }
    }

    if (!membership) {
      return res.status(403).json({ error: 'Usuário não vinculado à conta' });
    }

    const tokens = await startSession({
      userId: membership.user.id,
      email: membership.user.email,
      accountId: membership.account.id,
      role: membership.role,
    });

    await recordAudit({
      userId: membership.user.id,
      accountId: membership.account.id,
      action: 'auth.google.login',
      metadata: { googleId: profile.sub },
    });

    const payload = await buildAuthResponse({
      userId: membership.user.id,
      accountId: membership.account.id,
      email: membership.user.email,
      tokens,
    });
    return res.json(payload);
  } catch (error) {
    logger.error({ err: error }, 'google login failed');
    return next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  const schema = z.object({
    refreshToken: z.string().min(10),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const result = await exchangeRefreshToken(parsed.data.refreshToken);
    if (!result) return res.status(401).json({ error: 'Refresh token inválido' });

    const payload = await buildAuthResponse({
      userId: result.claims.sub,
      accountId: result.claims.accountId,
      email: result.claims.email,
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        refreshExpiresAt: result.tokens.refreshExpiresAt,
      },
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    if (req.auth) {
      await endSession(req.auth.sessionId);
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export const authRouter = router;
