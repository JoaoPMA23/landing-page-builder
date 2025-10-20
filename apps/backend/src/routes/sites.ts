import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const router = Router();

router.get('/', async (_req, res) => {
  // IDs are UUIDs, but ordering descending keeps newer records on top without depending on timestamps yet.
  const sites = await prisma.site.findMany({ take: 50, orderBy: { id: 'desc' } });
  res.json(sites);
});

router.post('/', async (req, res) => {
  const bodySchema = z.object({
    accountId: z.string().uuid(),
    name: z.string().min(2),
    subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const site = await prisma.site.create({
    data: { ...parsed.data },
  });
  res.status(201).json(site);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const site = await prisma.site.update({ where: { id }, data });
  res.json(site);
});
