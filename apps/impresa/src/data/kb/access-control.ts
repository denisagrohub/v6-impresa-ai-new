export type UserRole = 'admin' | 'consultant' | 'client' | 'referral';

export const KB_PERMISSIONS: Record<UserRole, string[]> = {
    admin: ['*'],
    consultant: [
        'identity',
        'rules-universal',
        'psychology-PL',
        'psychology-PC',
        'psychology-DISC',
        'psychology-OB',
        'method-6areas',
        'module-c-startup',
        'commercial-windows' // ← AGGIUNTO: ora il consulente può leggere il calendario
    ],
    client: [],
    referral: []
};

export function canAccessKB(role: UserRole, module: string): boolean {
    const perms = KB_PERMISSIONS[role] || [];
    return perms.includes('*') || perms.includes(module);
}
