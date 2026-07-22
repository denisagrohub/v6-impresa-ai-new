import { NextRequest, NextResponse } from 'next/server';

export function getSession(req: NextRequest) {
    const sessionCookie = req.cookies.get('pi_session')?.value;
    if (!sessionCookie) return null;
    try {
        return JSON.parse(decodeURIComponent(sessionCookie));
    } catch (e) {
        return null;
    }
}

export function requirePermission(req: NextRequest, allowedRoles: string[]) {
    const session = getSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Non autorizzato. Effettua il login.' }, { status: 401 });
    }
    if (!allowedRoles.includes(session.role)) {
        return NextResponse.json({ error: 'Permesso negato. Ruolo non sufficiente.' }, { status: 403 });
    }
    return session;
}

// ✅ Aggiunta funzione mancante (alias per compatibilità)
export function requireAnyPermission(req: NextRequest, allowedRoles: string[]) {
    return requirePermission(req, allowedRoles);
}

export function handleAuthError(error: any) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Errore interno di autenticazione' }, { status: 500 });
}
