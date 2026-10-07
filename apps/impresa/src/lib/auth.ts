// 07/10/2026 (C-auth-401): helper client-side per sessione + JWT.
// Coerente con:
//   - login/page.tsx: localStorage 'pi_session' + cookie 'pi_session' + 'token'
//   - middleware.ts: verifica firma JWT (jose.jwtVerify)
//   - lib/auth-server.ts: stesso JSON in 'pi_session'

export interface PiSession {
  token: string;
  role?: string;
  name?: string;
  email?: string;
  emailSlug?: string;
  clientId?: number | string;
  partnerId?: number | string;
  [k: string]: unknown;
}

export function getPiSession(): PiSession | null {
  try {
    const raw = localStorage.getItem('pi_session');
    if (!raw) return null;
    return JSON.parse(raw) as PiSession;
  } catch {
    return null;
  }
}

export function getPiToken(): string | null {
  return getPiSession()?.token || null;
}

export function isJwtExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    // base64url → base64 + padding
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (!payload.exp) return true;
    // exp è in secondi, Date.now in ms. Margine 5s per skew clock.
    return payload.exp * 1000 + 5000 < Date.now();
  } catch {
    return true;
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem('pi_session');
  } catch {}
  try {
    document.cookie = 'pi_session=; Max-Age=0; path=/';
    document.cookie = 'token=; Max-Age=0; path=/';
  } catch {}
}

// 07/10/2026: redirect a /login (coerente col middleware), con
// ?redirect=<path corrente> per tornare dopo il login.
export function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return;
  clearAuth();
  const current = window.location.pathname + window.location.search;
  if (current.startsWith('/login') || current.startsWith('/admin/login')) {
    return; // già sulla pagina login
  }
  window.location.href = '/login?redirect=' + encodeURIComponent(current);
}
