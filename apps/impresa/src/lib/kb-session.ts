// 07/10/2026 (C-kb-3b-fix2): storage sessione KB unificato.
// Usato da OtpVerifyModal (write) e KbListPage (read).
// Chiavi: 'kb_session_token' + 'kb_session_expires'.

export const KB_SESSION_KEY = 'kb_session_token';
export const KB_SESSION_EXP_KEY = 'kb_session_expires';

export function saveKbSession(token: string, expiresAt: string | null): void {
  if (!token) return;
  try {
    localStorage.setItem(KB_SESSION_KEY, token);
    if (expiresAt) localStorage.setItem(KB_SESSION_EXP_KEY, expiresAt);
  } catch (e) {
    console.warn('[kb-session] setItem fallito', e);
  }
}

export function clearKbSession(): void {
  try {
    localStorage.removeItem(KB_SESSION_KEY);
    localStorage.removeItem(KB_SESSION_EXP_KEY);
  } catch {}
}

export function kbSessionHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem(KB_SESSION_KEY);
    const exp = localStorage.getItem(KB_SESSION_EXP_KEY);
    if (!token) return {};
    if (exp && new Date(exp) < new Date()) {
      clearKbSession();
      return {};
    }
    return { 'X-Kb-Session': token };
  } catch {
    return {};
  }
}

export function getKbSessionToken(): string | null {
  try {
    return localStorage.getItem(KB_SESSION_KEY);
  } catch {
    return null;
  }
}
