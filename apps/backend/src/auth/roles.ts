export const ROLES = ['CONTRIBUTOR', 'MODERATOR'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function assertRole(value: string): Role {
  if (!isRole(value)) {
    throw new Error(`Invalid role: ${value}`);
  }
  return value;
}
