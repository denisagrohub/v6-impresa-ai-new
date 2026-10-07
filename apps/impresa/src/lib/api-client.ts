// 07/10/2026 (C-auth-401): fetch wrapper con gestione JWT.
// - Pre-check: se JWT scaduto → clearAuthAndRedirect, no fetch
// - Inietta Authorization: JWT <token> da pi_session
// - Post-check: se 401 con error 'Invalid JWT' → clearAuthAndRedirect
//
// NON gestisce il 401 kb_session_* (KB OTP) — quello è gestito
// dai componenti KB con la logica OTP dedicata.

import { getPiSession, isJwtExpired, clearAuthAndRedirect } from './auth';

export class AuthExpiredError extends Error {
  constructor() {
    super('Sessione scaduta');
    this.name = 'AuthExpiredError';
  }
}

export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const session = getPiSession();

  // Pre-check: JWT scaduto/mancante
  if (isJwtExpired(session?.token)) {
    clearAuthAndRedirect();
    throw new AuthExpiredError();
  }

  const headers = new Headers(init.headers || {});
  if (session?.token && !headers.has('Authorization')) {
    headers.set('Authorization', 'JWT ' + session.token);
  }
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const r = await fetch(input, { ...init, headers });

  // Post-check: 401 con error 'Invalid JWT' → sessione non valida
  if (r.status === 401) {
    try {
      const clone = r.clone();
      const j = await clone.json();
      const err = (j?.data || j)?.error;
      if (err === 'Invalid JWT' || err === 'Authentication required') {
        clearAuthAndRedirect();
        throw new AuthExpiredError();
      }
    } catch (e) {
      if (e instanceof AuthExpiredError) throw e;
      // JSON non parsabile: passa oltre (401 sarà gestito dal chiamante)
    }
  }

  return r;
}
