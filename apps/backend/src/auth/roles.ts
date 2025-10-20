import type { Role } from '@prisma/client';

const ROLE_WEIGHT: Record<Role, number> = {
  editor: 1,
  admin: 2,
  owner: 3,
};

export const hasRequiredRole = (current: Role, required: Role | Role[]): boolean => {
  const targets = Array.isArray(required) ? required : [required];
  return targets.some((role) => ROLE_WEIGHT[current] >= ROLE_WEIGHT[role]);
};

export const canAssignRole = (actor: Role, target: Role): boolean =>
  ROLE_WEIGHT[actor] >= ROLE_WEIGHT[target];
