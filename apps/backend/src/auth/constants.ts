import { logger } from '../logger.js';

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
if (!process.env.JWT_SECRET) {
  logger.warn(
    { env: 'JWT_SECRET' },
    'JWT_SECRET not set, falling back to insecure development secret'
  );
}

export const JWT_ACCESS_MINUTES = parseNumber(process.env.JWT_ACCESS_MINUTES, 15);
export const JWT_REFRESH_DAYS = parseNumber(process.env.JWT_REFRESH_DAYS, 30);
export const MAGIC_LINK_MINUTES = parseNumber(process.env.MAGIC_LINK_MINUTES, 15);
export const INVITE_DAYS = parseNumber(process.env.INVITE_DAYS, 7);

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

export const ISSUER = process.env.JWT_ISSUER ?? 'landing-builder';
