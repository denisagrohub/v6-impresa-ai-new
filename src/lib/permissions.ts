// src/lib/permissions.ts

export type UserRole = 'admin' | 'chief' | 'consultant' | 'referral' | 'client';

export type Permission =
    // Admin - Sistema
    | 'settings.configure_system'
    | 'settings.configure_deploy'
    | 'settings.configure_call_ai'
    | 'admin.view_stats'
    | 'admin.deploy_odoo'
    | 'admin.test_odoo'
    | 'admin.manage_demo_mode'
    // Admin/Chief - Partner
    | 'partners.view_all'
    | 'partners.create'
    | 'partners.edit'
    | 'partners.delete'
    // Admin/Chief - Pagamenti
    | 'payments.view_all'
    | 'payments.edit'
    // Admin/Chief - Richieste
    | 'requests.view_all'
    | 'requests.create'
    | 'requests.approve'
    // Admin/Chief - Progetti
    | 'projects.view_all'
    | 'projects.create'
    | 'projects.edit'
    // Admin/Chief - Configurazioni
    | 'config.manage_commissions'
    | 'config.manage_pricing'
    | 'config.manage_scoring'
    // Consultant - Dashboard
    | 'consultant.view_own_dashboard'
    | 'consultant.view_own_projects'
    | 'consultant.manage_own_calendar'
    | 'consultant.manage_own_requests'
    | 'consultant.use_call_ai'
    | 'consultant.view_own_timesheet'
    // Chief - Team
    | 'chief.view_team_availability'
    | 'chief.view_team_projects';

// Matrice permessi: ruolo → lista permessi
const PERMISSIONS_MATRIX: Record<UserRole, Permission[]> = {
    admin: [
        'settings.configure_system',
        'settings.configure_deploy',
        'settings.configure_call_ai',
        'admin.view_stats',
        'admin.deploy_odoo',
        'admin.test_odoo',
        'admin.manage_demo_mode',
        'partners.view_all',
        'partners.create',
        'partners.edit',
        'partners.delete',
        'payments.view_all',
        'payments.edit',
        'requests.view_all',
        'requests.create',
        'requests.approve',
        'projects.view_all',
        'projects.create',
        'projects.edit',
        'config.manage_commissions',
        'config.manage_pricing',
        'config.manage_scoring',
        'consultant.view_own_dashboard',
        'consultant.view_own_projects',
        'consultant.manage_own_calendar',
        'consultant.manage_own_requests',
        'consultant.use_call_ai',
        'consultant.view_own_timesheet',
        'chief.view_team_availability',
        'chief.view_team_projects',
    ],
    chief: [
        'admin.view_stats',
        'partners.view_all',
        'partners.create',
        'partners.edit',
        'payments.view_all',
        'requests.view_all',
        'requests.create',
        'requests.approve',
        'projects.view_all',
        'projects.create',
        'projects.edit',
        'config.manage_commissions',
        'config.manage_pricing',
        'config.manage_scoring',
        'consultant.view_own_dashboard',
        'consultant.view_own_projects',
        'consultant.manage_own_calendar',
        'consultant.manage_own_requests',
        'consultant.use_call_ai',
        'consultant.view_own_timesheet',
        'chief.view_team_availability',
        'chief.view_team_projects',
    ],
    consultant: [
        'consultant.view_own_dashboard',
        'consultant.view_own_projects',
        'consultant.manage_own_calendar',
        'consultant.manage_own_requests',
        'consultant.use_call_ai',
        'consultant.view_own_timesheet',
    ],
    referral: [],
    client: [],
};

/**
 * Verifica se un ruolo ha un permesso specifico
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
    return PERMISSIONS_MATRIX[role]?.includes(permission) ?? false;
}

/**
 * Verifica se un ruolo ha TUTTI i permessi specificati
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
    return permissions.every(p => hasPermission(role, p));
}

/**
 * Verifica se un ruolo ha ALMENO UNO dei permessi specificati
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
    return permissions.some(p => hasPermission(role, p));
}

/**
 * Ritorna tutti i permessi di un ruolo
 */
export function getRolePermissions(role: UserRole): Permission[] {
    return PERMISSIONS_MATRIX[role] ?? [];
}

/**
 * Ritorna tutti i ruoli che hanno un permesso specifico
 */
export function getRolesWithPermission(permission: Permission): UserRole[] {
    return (Object.keys(PERMISSIONS_MATRIX) as UserRole[]).filter(role =>
        hasPermission(role, permission)
    );
}
