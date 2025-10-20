import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { router as healthRouter } from './routes/health.js';
import { router as sitesRouter } from './routes/sites.js';
import { router as pagesRouter } from './routes/pages.js';
import { router as leadsRouter } from './routes/leads.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use('/health', healthRouter);
app.use('/sites', sitesRouter);
app.use('/pages', pagesRouter);
app.use('/leads', leadsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`[backend] listening on :${port}`));
