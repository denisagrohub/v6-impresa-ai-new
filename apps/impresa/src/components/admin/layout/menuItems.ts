import {
  LayoutDashboard, FolderKanban, Users, Settings,
  CheckCircle2, Mail, Calculator, Landmark, FileText,
  Brain, Shield, UserCog, Phone, PenTool, FileSignature, Code2,
  Palette, Target, AlertTriangle, Package, Briefcase,
} from "lucide-react";
import type { UserRole } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════════
// Menu admin unificato (29/09/2026: multi-ruolo + categorie).
//
// Ogni voce ha `requiredRoles`: la sidebar mostra la voce SOLO se
// l'utente ha almeno uno di quei ruoli. ADMIN implicito ovunque (se
// sei admin, vedi tutto).
//
// Raggruppato in 5 categorie per ridurre il carico cognitivo (23 voci
// flat erano troppe).
// ═══════════════════════════════════════════════════════════════════

export type AdminMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  // Ruoli autorizzati (chi non è in lista NON vede la voce).
  // Nota: admin è implicito ovunque — la sidebar lo aggiunge in automatico.
  requiredRoles?: UserRole[];
};

export type AdminMenuCategory = {
  label: string | null;   // null = nessuna intestazione (voci top-level)
  items: AdminMenuItem[];
};

const ALL: UserRole[] = [
  'admin', 'chief_projects', 'chief_accounting', 'chief_bandi',
  'chief_marketing', 'chief_kb', 'consultant', 'referral', 'client', 'external',
];

const ADMIN_ONLY: UserRole[] = ['admin'];
const ADMIN_OR_PROJECTS: UserRole[] = ['admin', 'chief_projects'];
const ADMIN_OR_ACCOUNTING: UserRole[] = ['admin', 'chief_accounting'];
const ADMIN_OR_BANDI: UserRole[] = ['admin', 'chief_bandi'];
const ADMIN_OR_MARKETING: UserRole[] = ['admin', 'chief_marketing'];
const ADMIN_OR_KB: UserRole[] = ['admin', 'chief_kb'];
const ADMIN_OR_ANY_CHIEF: UserRole[] = [
  'admin', 'chief_projects', 'chief_accounting', 'chief_bandi',
  'chief_marketing', 'chief_kb',
];
const PROJECTS_OR_CONSULTANT: UserRole[] = ['admin', 'chief_projects', 'consultant'];

// ═══════════════════════════════════════════════════════════════════
// Categorie
// ═══════════════════════════════════════════════════════════════════

export const ADMIN_MENU_CATEGORIES: AdminMenuCategory[] = [
  {
    label: null,  // Dashboard top-level
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard", requiredRoles: ALL },
    ],
  },
  {
    label: "Operativo",
    items: [
      { icon: Briefcase, label: "Deal", href: "/admin/deals", requiredRoles: PROJECTS_OR_CONSULTANT },
      { icon: Users, label: "Progetti Partner", href: "/admin/partner-projects", requiredRoles: PROJECTS_OR_CONSULTANT },
      { icon: PenTool, label: "Firme", href: "/admin/firme", requiredRoles: ADMIN_OR_PROJECTS },
      { icon: FileSignature, label: "Contratti", href: "/admin/contratti", requiredRoles: ADMIN_OR_PROJECTS },
      { icon: FileText, label: "Documenti", href: "/admin/documenti", requiredRoles: ADMIN_OR_PROJECTS },
    ],
  },
  {
    label: "Commerciale",
    items: [
      { icon: FolderKanban, label: "Progetti", href: "/admin/projects", requiredRoles: ADMIN_OR_PROJECTS },
      { icon: UserCog, label: "Team", href: "/admin/team", requiredRoles: ADMIN_OR_PROJECTS },
      { icon: Phone, label: "Call Prenotate", href: "/admin/bookings", requiredRoles: PROJECTS_OR_CONSULTANT },
      { icon: Users, label: "Coda Lead", href: "/admin/leads", requiredRoles: ADMIN_OR_PROJECTS },
      { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione", requiredRoles: ADMIN_OR_PROJECTS },
      { icon: Target, label: "Bandi", href: "/admin/bandi", requiredRoles: ADMIN_OR_BANDI },
    ],
  },
  {
    label: "Amministrazione",
    items: [
      { icon: Calculator, label: "Pagamenti", href: "/admin/payments", requiredRoles: ADMIN_OR_ACCOUNTING },
      { icon: Landmark, label: "Commissioni", href: "/admin/accounting", requiredRoles: ADMIN_OR_ACCOUNTING },
    ],
  },
  {
    label: "Contenuti",
    items: [
      { icon: Brain, label: "Knowledge Base", href: "/admin/kb", requiredRoles: ADMIN_OR_KB },
      { icon: FileText, label: "Libreria", href: "/admin/library", requiredRoles: ADMIN_OR_KB },
      { icon: Target, label: "Marketing Plans", href: "/admin/marketing", requiredRoles: ADMIN_OR_MARKETING },
      { icon: Palette, label: "Brand Projects", href: "/admin/brand", requiredRoles: ADMIN_OR_MARKETING },
    ],
  },
  {
    label: "Comunicazione",
    items: [
      { icon: Mail, label: "La mia email", href: "/admin/mia-email", requiredRoles: ALL },
      { icon: AlertTriangle, label: "Richieste", href: "/admin/requests", requiredRoles: ADMIN_OR_ANY_CHIEF },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: Code2, label: "Template", href: "/admin/template", requiredRoles: ADMIN_ONLY },
      { icon: Package, label: "Prodotti Custom", href: "/admin/products", requiredRoles: ADMIN_ONLY },
      { icon: Shield, label: "Sicurezza", href: "/admin/security", requiredRoles: ADMIN_ONLY },
      { icon: Settings, label: "Impostazioni", href: "/admin/settings/system", requiredRoles: ADMIN_ONLY },
    ],
  },
];

// Flat (per compatibilità con codice esistente che itera ADMIN_MENU_ITEMS)
export const ADMIN_MENU_ITEMS: AdminMenuItem[] = ADMIN_MENU_CATEGORIES.flatMap(c => c.items);

export type AdminMenuBadge = {
  href: string;
  count: number;
  color?: string;
};

/**
 * Filtra le categorie in base ai ruoli dell'utente.
 * Regole:
 *   - admin vede tutto
 *   - altrimenti: mostra la voce se `requiredRoles` è vuoto/undefined OPPURE
 *     contiene almeno uno dei ruoli utente
 *   - categoria vuota dopo filtro = nascosta
 */
export function filterMenuForRoles(userRoles: string[]): AdminMenuCategory[] {
  const isAdmin = userRoles.includes('admin');
  return ADMIN_MENU_CATEGORIES
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        if (isAdmin) return true;
        const required = item.requiredRoles;
        if (!required || required.length === 0) return true;
        return required.some(r => userRoles.includes(r));
      }),
    }))
    .filter(cat => cat.items.length > 0);
}
