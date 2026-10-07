// 07/10/2026 (C-kb-3b-fix2 + C-kb-3c): storage sessione KB multi-purpose.
// Le sessioni read/write/critical sono SEPARATE (backend le isola):
// una sessione read NON autorizza write.
//
// Chiavi (retrocompatibili):
//   read     -> 'kb_session_token'           (invariato da fix2)
//   write    -> 'kb_session_token_write'
//   critical -> 'kb_session_token_critical'

export type KbPurpose = 'read' | 'write' | 'critical';

function keysFor(purpose: KbPurpose): { token: string; exp: string } {
  if (purpose === 'write') {
    return { token: 'kb_session_token_write', exp: 'kb_session_expires_write' };
  }
  if (purpose === 'critical') {
    return { token: 'kb_session_token_critical', exp: 'kb_session_expires_critical' };
  }
  return { token: 'kb_session_token', exp: 'kb_session_expires' };
}

export function saveKbSession(
  token: string,
  expiresAt: string | null,
  purpose: KbPurpose = 'read',
): void {
  if (!token) return;
  try {
    const k = keysFor(purpose);
    localStorage.setItem(k.token, token);
    if (expiresAt) {
      localStorage.setItem(k.exp, expiresAt);
    } else {
      // Rimuovi exp vecchio: altrimenti un exp scaduto cancella il
      // token appena salvato al primo kbSessionHeader().
      localStorage.removeItem(k.exp);
    }
  } catch (e) {
    console.warn('[kb-session] setItem fallito', e);
  }
}

export function clearKbSession(purpose: KbPurpose = 'read'): void {
  try {
    const k = keysFor(purpose);
    localStorage.removeItem(k.token);
    localStorage.removeItem(k.exp);
  } catch {}
}

export function kbSessionHeader(purpose: KbPurpose = 'read'): Record<string, string> {
  try {
    const k = keysFor(purpose);
    const token = localStorage.getItem(k.token);
    const exp = localStorage.getItem(k.exp);
    if (!token) return {};
    if (exp && new Date(exp) < new Date()) {
      clearKbSession(purpose);
      return {};
    }
    return { 'X-Kb-Session': token };
  } catch {
    return {};
  }
}

export function getKbSessionToken(purpose: KbPurpose = 'read'): string | null {
  try {
    return localStorage.getItem(keysFor(purpose).token);
  } catch {
    return null;
  }
}

// Utility: pulisce tutte le sessioni (logout totale).
export function clearAllKbSessions(): void {
  clearKbSession('read');
  clearKbSession('write');
  clearKbSession('critical');
}
