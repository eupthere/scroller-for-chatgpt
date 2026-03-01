import type { Role } from '../types/timeline';

export function normalizeRole(rawRole: string | null | undefined): Role | null {
  if (rawRole === 'user' || rawRole === 'assistant') {
    return rawRole;
  }

  return null;
}
