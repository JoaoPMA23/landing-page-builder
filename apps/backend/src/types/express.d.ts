import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthContext {
      userId: string;
      accountId: string;
      email: string;
      role: Role;
      sessionId: string;
    }

    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
