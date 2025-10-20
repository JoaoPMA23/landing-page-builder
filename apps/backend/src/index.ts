import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { router as healthRouter } from './routes/health.js';
import { router as sitesRouter } from './routes/sites.js';
import { router as pagesRouter } from './routes/pages.js';
import { router as leadsRouter } from './routes/leads.js';
import { requestLogger } from './middleware/requestLogger.js';
import { logger } from './logger.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

app.use('/health', healthRouter);
app.use('/sites', sitesRouter);
app.use('/pages', pagesRouter);
app.use('/leads', leadsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => logger.info({ port }, 'backend listening'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});
