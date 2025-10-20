import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const router = Router();

router.get('/', async (req, res) => {
  const { siteId } = req.query as { siteId?: string };
  const where = siteId ? { siteId } : {};
  const pages = await prisma.page.findMany({ where, take: 100, orderBy: { updatedAt: 'desc' } });
  res.json(pages);
});

router.post('/', async (req, res) => {
  const schema = z.object({
    siteId: z.string().uuid(),
    path: z.string(),
    title: z.string(),
    meta: z.any().optional(),
    tree: z.any(),
    status: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { siteId, path, title, meta, tree, status } = parsed.data;
  // Persisting the page explicitly guarantees Prisma receives all required fields (notably tree).
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
  res.status(201).json(page);
});
