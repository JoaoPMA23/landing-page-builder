import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

export const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { siteId } = req.query as { siteId?: string };
    const pages = await prisma.page.findMany({
      where: {
        ...(siteId ? { siteId } : {}),
        site: { accountId: req.auth!.accountId },
      },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });
    return res.json(pages);
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const schema = z.object({
    siteId: z.string().uuid(),
    path: z.string(),
    title: z.string(),
    meta: z.any().optional(),
    tree: z.any(),
    status: z.enum(['draft', 'published']).default('draft'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  try {
    const { siteId, path, title, meta, tree, status } = parsed.data;
    const site = await prisma.site.findFirst({
      where: { id: siteId, accountId: req.auth!.accountId },
    });
    if (!site) return res.status(404).json({ error: 'Site não encontrado' });

    const page = await prisma.page.create({
      data: {
        siteId,
        path,
        title,
        meta,
        tree: tree ?? {},
        status,
      },
    });

    await recordAudit({
      accountId: req.auth!.accountId,
      userId: req.auth!.userId,
      action: 'page.created',
      metadata: { pageId: page.id, siteId },
    });

    return res.status(201).json(page);
  } catch (error) {
    return next(error);
  }
});
