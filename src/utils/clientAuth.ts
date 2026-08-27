'use client';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const normalized = pad ? padded + '='.repeat(4 - pad) : padded;
  return atob(normalized);
}

export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return typeof payload?.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const exp = decodeJwtExp(token);
  if (exp === null) return true;
  return Math.floor(Date.now() / 1000) >= exp;
}

export function logoutAndRedirect(): void {
  clearAuth();
  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
}

/**
 * Wrap window.fetch so any 401 response clears auth state and bounces the
 * user to `/`. Returns a cleanup function that restores the original fetch.
 *
 * The interceptor deliberately ignores 401s from the login endpoint so a
 * wrong-credentials response doesn't trigger a redirect loop on the login
 * page itself.
 */
export function installAuthFetchInterceptor(): () => void {
  if (typeof window === 'undefined') return () => {};

  const original = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const token = getToken();
    let modifiedInit = init;

    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as any)?.url || '';

    // Auto-attach authorization bearer header to /api/ calls if not provided
    if (token && urlStr.includes('/api/') && !urlStr.includes('/api/auth/login')) {
      const headers = new Headers(init?.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      modifiedInit = { ...init, headers };
    }

    const response = await original(input, modifiedInit);

    if (response.status === 401) {
      if (!urlStr.includes('/api/auth/login')) {
        const currentToken = getToken();
        // Only trigger logout if token is actually missing or expired
        if (!currentToken || isTokenExpired(currentToken)) {
          logoutAndRedirect();
        }
      }
    }

    return response;
  };

  return () => {
    window.fetch = original;
  };
}
