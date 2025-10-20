import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

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
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });

  const lead = await prisma.lead.create({
    data: {
      siteId,
      pagePath: parsed.data.pagePath,
      data: parsed.data.data,
      source: parsed.data.source,
    },
  });

  await recordAudit({
    accountId: site.accountId,
    action: 'lead.captured',
    metadata: { siteId, leadId: lead.id },
  });

  res.status(201).json({ ok: true, leadId: lead.id });
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { siteId } = req.query as { siteId?: string };
    const leads = await prisma.lead.findMany({
      where: {
        ...(siteId ? { siteId } : {}),
        site: { accountId: req.auth!.accountId },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(leads);
  } catch (error) {
    next(error);
  }
});
