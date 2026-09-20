// src/lib/auth-server.ts
// 20/09/2026: helper server-side per leggere e verificare la sessione.
// Il cookie "pi_session" contiene JSON url-encoded con: role, name, email,
// clientId (uid Odoo), partnerId, token (JWT HS256 firmato da Odoo).
// Verifichiamo la firma con il secret condiviso (api.jwt_secret).

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import type { UserRole } from './permissions';

export interface Session {
    uid: number;
    role: UserRole;
    partnerId: number | null;
    name: string;
    email: string;
    token: string;
}

export class UnauthorizedError extends Error {
    constructor(msg = 'Non autenticato') { super(msg); }
}
export class ForbiddenError extends Error {
    constructor(msg = 'Permesso negato') { super(msg); }
}

function verifyJwt(token: string): any | null {
    const secret = process.env.ODOO_JWT_SECRET;
    if (!secret) {
        console.error('ODOO_JWT_SECRET non configurato in .env.local');
        return null;
    }
    try {
        return jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
        return null;
    }
}

export async function getSession(): Promise<Session | null> {
    try {
        const cookieStore = cookies();
        const raw = cookieStore.get('pi_session')?.value;
        if (!raw) return null;

        const data = JSON.parse(decodeURIComponent(raw));
        if (!data.token || !data.clientId) return null;

        const payload = verifyJwt(data.token);
        if (!payload) return null;

        // Verifica che il role nel payload corrisponda a quello in sessione
        if (payload.user_id !== parseInt(data.clientId, 10)) return null;

        return {
            uid: payload.user_id,
            role: (payload.role || data.role) as UserRole,
            partnerId: data.partnerId ? parseInt(data.partnerId, 10) : null,
            name: data.name || '',
            email: data.email || '',
            token: data.token,
        };
    } catch {
        return null;
    }
}

export async function requireAuth(): Promise<Session> {
    const s = await getSession();
    if (!s) throw new UnauthorizedError();
    return s;
}

export async function requireAdmin(): Promise<Session> {
    const s = await requireAuth();
    if (s.role !== 'admin' && s.role !== 'chief') {
        throw new ForbiddenError('Solo admin');
    }
    return s;
}

export function isAdmin(s: Session): boolean {
    return s.role === 'admin' || s.role === 'chief';
}

export function isConsultant(s: Session): boolean {
    return s.role === 'consultant';
}

export function handleAuthError(e: any): Response | null {
    if (e instanceof UnauthorizedError) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    if (e instanceof ForbiddenError) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return null;
}
