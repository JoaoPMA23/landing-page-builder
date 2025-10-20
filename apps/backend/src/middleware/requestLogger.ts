import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { logger } from '../logger.js';

/**
 * Express middleware that injects a request-scoped logger and propagates an `x-request-id`.
 * This helps correlate logs across services and satisfies the initial tracing requirement.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const existing = req.headers['x-request-id'];
    const id = Array.isArray(existing) ? existing[0] : existing;
    const requestId = id ?? randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  customLogLevel(_req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`;
  },
});
