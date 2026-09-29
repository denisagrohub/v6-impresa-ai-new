// ═══════════════════════════════════════════════════════════════════
// permissions.ts — matrice permessi V6 Impresa.
//
// Modello (29/09/2026): multi-ruolo con unione permessi. Un utente ha
// 1..N ruoli; i suoi permessi effettivi sono l'unione dei permessi di
// tutti i suoi ruoli. Esempio: Christian = chief_projects + consultant
// → vede i deal del network + ha la sua area consulente personale.
//
// BACKWARD COMPAT: le vecchie funzioni hasPermission(role, p) e
// getRolePermissions(role) restano per i consumer esistenti (singolo
// ruolo). Le nuove funzioni getUserPermissions(roles[]) e
// hasAnyRole(roles, allowed) sono il pattern per il futuro.
// ═══════════════════════════════════════════════════════════════════

export type UserRole =
    | 'admin'
    | 'chief_projects'
    | 'chief_accounting'
    | 'chief_bandi'
    | 'chief_marketing'
    | 'chief_kb'
    | 'consultant'
    | 'referral'
    | 'client'
    | 'external';

// Alias legacy: 'chief' era il vecchio singolo ruolo "manager generico".
// Mappato su chief_projects per i consumer esistenti che lo referenziano.
export type LegacyUserRole = 'chief';

export type Permission =
    // ─── Sistema (admin only) ───
    | 'settings.configure_system'
    | 'settings.configure_deploy'
    | 'settings.configure_call_ai'
    | 'admin.view_stats'
    | 'admin.deploy_odoo'
    | 'admin.test_odoo'
    | 'admin.manage_demo_mode'

    // ─── Partner ───
    | 'partners.view_all'
    | 'partners.create'
    | 'partners.edit'
    | 'partners.delete'

    // ─── Pagamenti ───
    | 'payments.view_all'
    | 'payments.edit'
    | 'payments.approve'

    // ─── Richieste ───
    | 'requests.view_all'
    | 'requests.create'
    | 'requests.approve'

    // ─── Progetti ───
    | 'projects.view_all'
    | 'projects.create'
    | 'projects.edit'

    // ─── Contratti / Firme ───
    | 'contracts.view_all'
    | 'contracts.edit'

    // ─── Configurazioni ───
    | 'config.manage_commissions'
    | 'config.manage_pricing'
    | 'config.manage_scoring'

    // ─── Bandi (chief_bandi) ───
    | 'bandi.view_all'
    | 'bandi.create'
    | 'bandi.edit'
    | 'bandi.match'

    // ─── Marketing (chief_marketing) ───
    | 'marketing.view_all'
    | 'marketing.edit'
    | 'marketing.publish'

    // ─── Knowledge Base (chief_kb) ───
    | 'kb.view_all'
    | 'kb.edit'
    | 'kb.publish'

    // ─── Consultant (area propria) ───
    | 'consultant.view_own_dashboard'
    | 'consultant.view_own_projects'
    | 'consultant.manage_own_calendar'
    | 'consultant.manage_own_requests'
    | 'consultant.use_call_ai'
    | 'consultant.view_own_timesheet'

    // ─── Chief (verticali) ───
    | 'chief.view_team_availability'
    | 'chief.view_team_projects'
    | 'chief.approve_deal'
    | 'chief.approve_payment_below_threshold';

/** Ruoli "chief" (manager verticali). Utile per gate rapidi. */
export const CHIEF_ROLES: UserRole[] = [
    'chief_projects', 'chief_accounting', 'chief_bandi',
    'chief_marketing', 'chief_kb',
];

/** Ruoli admin-equivalenti (admin + tutti i chief). */
export const ADMIN_OR_CHIEF_ROLES: UserRole[] = ['admin', ...CHIEF_ROLES];

const PERMISSIONS_MATRIX: Record<UserRole, Permission[]> = {

    // ───────────────────────────────────────────────────────────
    // ADMIN — tutto. Sblocca implicitamente tutto il resto.
    // ───────────────────────────────────────────────────────────
    admin: [
        // Sistema
        'settings.configure_system',
        'settings.configure_deploy',
        'settings.configure_call_ai',
        'admin.view_stats',
        'admin.deploy_odoo',
        'admin.test_odoo',
        'admin.manage_demo_mode',
        // Partner
        'partners.view_all', 'partners.create', 'partners.edit', 'partners.delete',
        // Pagamenti
        'payments.view_all', 'payments.edit', 'payments.approve',
        // Richieste
        'requests.view_all', 'requests.create', 'requests.approve',
        // Progetti
        'projects.view_all', 'projects.create', 'projects.edit',
        // Contratti
        'contracts.view_all', 'contracts.edit',
        // Configurazioni
        'config.manage_commissions', 'config.manage_pricing', 'config.manage_scoring',
        // Bandi
        'bandi.view_all', 'bandi.create', 'bandi.edit', 'bandi.match',
        // Marketing
        'marketing.view_all', 'marketing.edit', 'marketing.publish',
        // KB
        'kb.view_all', 'kb.edit', 'kb.publish',
        // Consultant
        'consultant.view_own_dashboard', 'consultant.view_own_projects',
        'consultant.manage_own_calendar', 'consultant.manage_own_requests',
        'consultant.use_call_ai', 'consultant.view_own_timesheet',
        // Chief
        'chief.view_team_availability', 'chief.view_team_projects',
        'chief.approve_deal', 'chief.approve_payment_below_threshold',
    ],

    // ───────────────────────────────────────────────────────────
    // CHIEF_PROJECTS — gestione progetti, deal, team.
    // Es. Christian. Vede tutti i deal e progetti, approva deal,
    // approva pagamenti sotto soglia, vede team availability.
    // ───────────────────────────────────────────────────────────
    chief_projects: [
        'admin.view_stats',
        'partners.view_all', 'partners.create', 'partners.edit',
        'payments.view_all', 'payments.approve',
        'requests.view_all', 'requests.create', 'requests.approve',
        'projects.view_all', 'projects.create', 'projects.edit',
        'contracts.view_all', 'contracts.edit',
        'config.manage_commissions',
        'consultant.view_own_dashboard', 'consultant.view_own_projects',
        'consultant.manage_own_calendar', 'consultant.manage_own_requests',
        'consultant.use_call_ai', 'consultant.view_own_timesheet',
        'chief.view_team_availability', 'chief.view_team_projects',
        'chief.approve_deal', 'chief.approve_payment_below_threshold',
    ],

    // ───────────────────────────────────────────────────────────
    // CHIEF_ACCOUNTING — contabilità, fatture, pagamenti, commissioni.
    // Es. Stefania (futuro).
    // ───────────────────────────────────────────────────────────
    chief_accounting: [
        'admin.view_stats',
        'partners.view_all',
        'payments.view_all', 'payments.edit', 'payments.approve',
        'contracts.view_all',
        'config.manage_commissions',
        'consultant.view_own_timesheet',
    ],

    // ───────────────────────────────────────────────────────────
    // CHIEF_BANDI — bandi e candidature.
    // Oggi tu, poi altri.
    // ───────────────────────────────────────────────────────────
    chief_bandi: [
        'admin.view_stats',
        'partners.view_all', 'partners.create',
        'bandi.view_all', 'bandi.create', 'bandi.edit', 'bandi.match',
        'requests.view_all', 'requests.create',
    ],

    // ───────────────────────────────────────────────────────────
    // CHIEF_MARKETING — blog, marketing, brand.
    // ───────────────────────────────────────────────────────────
    chief_marketing: [
        'admin.view_stats',
        'marketing.view_all', 'marketing.edit', 'marketing.publish',
        'kb.view_all',
    ],

    // ───────────────────────────────────────────────────────────
    // CHIEF_KB — knowledge base, libreria, methodology.
    // ───────────────────────────────────────────────────────────
    chief_kb: [
        'admin.view_stats',
        'kb.view_all', 'kb.edit', 'kb.publish',
        'contracts.view_all',
    ],

    // ───────────────────────────────────────────────────────────
    // CONSULTANT — area personale consulente.
    // Es. Enzo, altri consulenti.
    // ───────────────────────────────────────────────────────────
    consultant: [
        'consultant.view_own_dashboard',
        'consultant.view_own_projects',
        'consultant.manage_own_calendar',
        'consultant.manage_own_requests',
        'consultant.use_call_ai',
        'consultant.view_own_timesheet',
    ],

    // ───────────────────────────────────────────────────────────
    // REFERRAL — solo dashboard referral.
    // ───────────────────────────────────────────────────────────
    referral: [],

    // ───────────────────────────────────────────────────────────
    // CLIENT — portale cliente esterno.
    // ───────────────────────────────────────────────────────────
    client: [],

    // ───────────────────────────────────────────────────────────
    // EXTERNAL — avvocato, commercialista esterno.
    // Lettura contratti assegnati + firma documenti.
    // ───────────────────────────────────────────────────────────
    external: [
        'contracts.view_all',
        'kb.view_all',
    ],
};

// ═══════════════════════════════════════════════════════════════════
// FUNZIONI LEGACY (single-role) — mantengono compatibilità coi consumer
// esistenti che usano hasPermission(role, p).
// ═══════════════════════════════════════════════════════════════════

/** Mappa 'chief' legacy → 'chief_projects' per backward compat. */
function normalizeLegacyRole(role: string): UserRole {
    if (role === 'chief') return 'chief_projects';
    return role as UserRole;
}

export function hasPermission(role: UserRole | LegacyUserRole, permission: Permission): boolean {
    const normalized = normalizeLegacyRole(role);
    return PERMISSIONS_MATRIX[normalized]?.includes(permission) ?? false;
}

export function hasAllPermissions(role: UserRole | LegacyUserRole, permissions: Permission[]): boolean {
    return permissions.every(p => hasPermission(role, p));
}

export function hasAnyPermission(role: UserRole | LegacyUserRole, permissions: Permission[]): boolean {
    return permissions.some(p => hasPermission(role, p));
}

export function getRolePermissions(role: UserRole | LegacyUserRole): Permission[] {
    const normalized = normalizeLegacyRole(role);
    return PERMISSIONS_MATRIX[normalized] ?? [];
}

export function getRolesWithPermission(permission: Permission): UserRole[] {
    return (Object.keys(PERMISSIONS_MATRIX) as UserRole[]).filter(role =>
        hasPermission(role, permission)
    );
}

// ═══════════════════════════════════════════════════════════════════
// FUNZIONI MULTI-RUOLO (nuove) — usare queste per il futuro.
// ═══════════════════════════════════════════════════════════════════

/**
 * Ritorna l'unione dei permessi di tutti i ruoli passati.
 * Deduplica automaticamente. Tollerante a ruoli sconosciuti (li ignora).
 */
export function getUserPermissions(roles: string[]): Permission[] {
    const all = new Set<Permission>();
    for (const r of roles) {
        const normalized = normalizeLegacyRole(r);
        const perms = PERMISSIONS_MATRIX[normalized];
        if (perms) perms.forEach(p => all.add(p));
    }
    return Array.from(all);
}

/** True se l'utente ha il permesso tramite almeno uno dei suoi ruoli. */
export function userHasPermission(roles: string[], permission: Permission): boolean {
    return getUserPermissions(roles).includes(permission);
}

/** True se l'utente ha almeno uno dei ruoli passati in `allowed`. */
export function hasAnyRole(userRoles: string[], allowed: string[]): boolean {
    return userRoles.some(r => allowed.includes(r));
}

/** True se l'utente ha TUTTI i ruoli passati in `required`. */
export function hasAllRoles(userRoles: string[], required: string[]): boolean {
    return required.every(r => userRoles.includes(r));
}
