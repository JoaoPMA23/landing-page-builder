import pino from 'pino';

const serviceName = process.env.APP_NAME ?? 'backend';

/**
 * Shared logger configured for JSON output and optional redaction.
 * Aligns observability requirements (RNF-O1) by providing structured logs with a stable service identifier.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: serviceName },
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
