import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { Role } from '@prisma/client';

export const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const sites = await prisma.site.findMany({
      where: { accountId: req.auth!.accountId },
      take: 50,
      orderBy: { id: 'desc' },
    });
    return res.json(sites);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireRole(Role.editor), async (req, res, next) => {
  const bodySchema = z.object({
    name: z.string().min(2),
    subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const site = await prisma.site.create({
      data: {
        accountId: req.auth!.accountId,
        name: parsed.data.name,
        subdomain: parsed.data.subdomain,
      },
    });

    await recordAudit({
      accountId: req.auth!.accountId,
      userId: req.auth!.userId,
      action: 'site.created',
      metadata: { siteId: site.id },
    });

    return res.status(201).json(site);
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireRole(Role.editor), async (req, res, next) => {
  try {
    const { id } = req.params;
    const site = await prisma.site.findFirst({
      where: { id, accountId: req.auth!.accountId },
    });
    if (!site) return res.status(404).json({ error: 'Site não encontrado' });

    const schema = z.object({
      name: z.string().min(2).optional(),
      subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/).optional(),
      customDomain: z.string().optional(),
      faviconUrl: z.string().url().optional().nullable(),
      ogImageUrl: z.string().url().optional().nullable(),
      isPublished: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const updated = await prisma.site.update({
      where: { id },
      data: parsed.data,
    });

    await recordAudit({
      accountId: req.auth!.accountId,
      userId: req.auth!.userId,
      action: 'site.updated',
      metadata: { siteId: id },
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});
