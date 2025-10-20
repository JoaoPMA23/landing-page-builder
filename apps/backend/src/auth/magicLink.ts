import { createHash, randomBytes } from 'crypto';
import { MAGIC_LINK_MINUTES } from './constants.js';

const tokenValidityMs = MAGIC_LINK_MINUTES * 60 * 1000;

export const hashMagicToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface MagicTokenBundle {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export const createMagicToken = (): MagicTokenBundle => {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashMagicToken(token);
  const expiresAt = new Date(Date.now() + tokenValidityMs);
  return { token, tokenHash, expiresAt };
};
