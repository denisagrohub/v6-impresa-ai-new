import {
  LayoutDashboard, FolderKanban, Users, Settings,
  CheckCircle2, Mail, Calculator, Landmark, FileText,
  Brain, Shield, UserCog, Phone, PenTool, FileSignature, Code2,
  Palette, Target, AlertTriangle, Package, Briefcase,
} from "lucide-react";

// 27/09/2026: menu admin unificato (era duplicato in 5+ pagine).
// Una sola fonte di verità: aggiungere/modificare voci qui.
export const ADMIN_MENU_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: FolderKanban, label: "Progetti", href: "/admin/projects" },
  { icon: Users, label: "Progetti Partner", href: "/admin/partner-projects" },
  { icon: Briefcase, label: "Deal", href: "/admin/deals" },
  { icon: PenTool, label: "Firme", href: "/admin/firme" },
  { icon: FileText, label: "Documenti", href: "/admin/documenti" },
  { icon: Code2, label: "Template", href: "/admin/template" },
  { icon: FileSignature, label: "Contratti", href: "/admin/contratti" },
  { icon: UserCog, label: "Team", href: "/admin/team" },
  { icon: Phone, label: "Call Prenotate", href: "/admin/bookings" },
  { icon: CheckCircle2, label: "Validazione", href: "/admin/validazione" },
  { icon: Users, label: "Coda Lead", href: "/admin/leads" },
  { icon: Calculator, label: "Pagamenti", href: "/admin/payments" },
  { icon: Landmark, label: "Commissioni", href: "/admin/accounting" },
  { icon: Mail, label: "La mia email", href: "/admin/mia-email" },
  { icon: Brain, label: "Knowledge Base", href: "/admin/kb" },
  { icon: FileText, label: "Libreria", href: "/admin/library" },
  { icon: Palette, label: "Brand Projects", href: "/admin/brand" },
  { icon: Target, label: "Marketing Plans", href: "/admin/marketing" },
  { icon: Shield, label: "Sicurezza", href: "/admin/security" },
  { icon: Settings, label: "Impostazioni", href: "/admin/settings/system" },
  { icon: AlertTriangle, label: "Richieste", href: "/admin/requests" },
  { icon: Package, label: "Prodotti Custom", href: "/admin/products" },
];

export type AdminMenuBadge = {
  href: string;
  count: number;
  color?: string; // default: bg-red-500
};
