// src/components/PermissionGuard.tsx

"use client";

import { ReactNode, useEffect, useState } from 'react';
import { UserRole, Permission, hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/permissions';

interface PermissionGuardProps {
    children: ReactNode;
    permission?: Permission;
    anyOf?: Permission[];
    allOf?: Permission[];
    roles?: UserRole[];
    fallback?: ReactNode;
}

/**
 * Componente che mostra i children SOLO se l'utente ha i permessi richiesti.
 *
 * Uso:
 * <PermissionGuard permission="projects.create">
 *   <button>Crea Progetto</button>
 * </PermissionGuard>
 *
 * <PermissionGuard anyOf={['projects.edit', 'projects.create']}>
 *   <button>Modifica o Crea</button>
 * </PermissionGuard>
 *
 * <PermissionGuard roles={['admin', 'chief']} fallback={<p>Solo admin</p>}>
 *   <AdminPanel />
 * </PermissionGuard>
 */
export function PermissionGuard({
    children,
    permission,
    anyOf,
    allOf,
    roles,
    fallback = null,
}: PermissionGuardProps) {
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        try {
            const session = localStorage.getItem('pi_session');
            if (session) {
                const parsed = JSON.parse(session);
                setUserRole(parsed.role as UserRole);
            }
        } catch (error) {
            console.error('Errore lettura sessione:', error);
        }
    }, []);

    // Durante SSR o prima del mount, non renderizzare nulla
    if (!isClient) return null;

    // Se non c'è un ruolo, mostra il fallback
    if (!userRole) return <>{fallback}</>;

    // Controlla permessi
    let hasAccess = true;

    if (permission) {
        hasAccess = hasPermission(userRole, permission);
    } else if (anyOf && anyOf.length > 0) {
        hasAccess = hasAnyPermission(userRole, anyOf);
    } else if (allOf && allOf.length > 0) {
        hasAccess = hasAllPermissions(userRole, allOf);
    } else if (roles && roles.length > 0) {
        hasAccess = roles.includes(userRole);
    }

    if (!hasAccess) return <>{fallback}</>;

    return <>{children}</>;
}

/**
 * Hook per controllare i permessi in componenti functional
 *
 * Uso:
 * const { canCreate, canEdit } = usePermissions();
 * if (canCreate) { ... }
 */
export function usePermissions() {
    const [userRole, setUserRole] = useState<UserRole | null>(null);

    useEffect(() => {
        try {
            const session = localStorage.getItem('pi_session');
            if (session) {
                const parsed = JSON.parse(session);
                setUserRole(parsed.role as UserRole);
            }
        } catch (error) {
            console.error('Errore lettura sessione:', error);
        }
    }, []);

    const can = (permission: Permission) =>
        userRole ? hasPermission(userRole, permission) : false;

    const canAny = (permissions: Permission[]) =>
        userRole ? hasAnyPermission(userRole, permissions) : false;

    const canAll = (permissions: Permission[]) =>
        userRole ? hasAllPermissions(userRole, permissions) : false;

    const isRole = (role: UserRole) => userRole === role;
    const isAnyRole = (roles: UserRole[]) => userRole ? roles.includes(userRole) : false;

    return {
        role: userRole,
        can,
        canAny,
        canAll,
        isRole,
        isAnyRole,
        // Shortcut comuni
        isAdmin: userRole === 'admin',
        isChief: userRole === 'chief',
        isConsultant: userRole === 'consultant',
        isReferral: userRole === 'referral',
        isClient: userRole === 'client',
    };
}
