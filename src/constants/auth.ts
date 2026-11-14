export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
} as const;

export const ADMIN = ROLES.ADMIN;
export const MANAGER = ROLES.MANAGER;
export const CASHIER = ROLES.CASHIER;

export const ALL_ROLES = [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER] as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export function isValidRole(role: any): role is UserRole {
  return role === ROLES.ADMIN || role === ROLES.MANAGER || role === ROLES.CASHIER;
}
