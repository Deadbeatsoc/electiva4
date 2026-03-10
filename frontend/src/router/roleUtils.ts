export type NormalizedRole = 'admin' | 'auxiliar' | 'cobrador' | 'unknown';

export function normalizeRole(roleName?: string | null): NormalizedRole {
  const role = (roleName || '').trim().toLowerCase();

  if (role === 'admin') return 'admin';
  if (role === 'auxiliar') return 'auxiliar';
  if (role === 'cobrador') return 'cobrador';

  return 'unknown';
}

export function getHomeRouteByRole(roleName?: string | null): string {
  const role = normalizeRole(roleName);

  if (role === 'admin' || role === 'auxiliar') {
    return '/dashboard';
  }

  if (role === 'cobrador') {
    return '/cash-register';
  }

  return '/login';
}

export function hasRequiredRole(
  roleName: string | null | undefined,
  allowedRoles?: string[]
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  const normalizedRole = normalizeRole(roleName);
  const normalizedAllowed = allowedRoles.map((role) => role.toLowerCase());

  return normalizedAllowed.includes(normalizedRole);
}
