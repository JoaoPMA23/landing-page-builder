import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';

export const router = Router();

router.post('/:siteId/:formId', async (req, res) => {
  const schema = z.object({
    pagePath: z.string(),
    data: z.record(z.any()),
    source: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);

  const { siteId } = req.params;
  const lead = await prisma.lead.create({
    data: { siteId, pagePath: parsed.data.pagePath, data: parsed.data.data, source: parsed.data.source },
  });
  res.status(201).json({ ok: true, leadId: lead.id });
});

router.get('/', async (req, res) => {
  const { siteId } = req.query as { siteId?: string };
  const where = siteId ? { siteId } : {};
  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(leads);
});
