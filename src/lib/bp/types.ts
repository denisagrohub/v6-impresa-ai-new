// Tipi per la generazione del Business Plan

export type PackageLevel = 'L1' | 'L2' | 'L3' | 'Custom';
export type PackageId = 'base' | 'starter' | 'premium' | 'executive' | 'custom';
export type AudienceType = 'bank' | 'investor' | 'partner' | 'internal';

export interface BPSection {
  id: string;
  title: string;
  content: string;
  order: number;
  aiGenerated: boolean;
}

export interface BPData {
  // Dati aziendali
  companyName: string;
  sector: string;
  foundingYear?: number;
  legalForm?: string;
  vatNumber?: string;

  // Dati di contatto
  contactName: string;
  contactEmail: string;
  contactPhone?: string;

  // Dati finanziari
  revenue?: number;
  ebitda?: number;
  employees?: number;
  fundingNeeded?: number;

  // Dati di mercato
  marketSize?: string;
  competitors?: string[];
  competitiveAdvantage?: string;

  // Progetto
  projectType: string;
  audience: AudienceType;
  packageLevel: PackageLevel;
  packageId: PackageId;
  objectives: string[];
  timeline?: string;

  // Additional
  additionalNotes?: string;
  brandColors?: { primary: string; secondary: string };
}

export interface BPGenerationResult {
  id: string;
  title: string;
  packageId: PackageId;
  packageLevel: PackageLevel;
  audience: AudienceType;
  sections: BPSection[];
  summary: string;
  price: number;
  estimatedDelivery: string;
  status: 'draft' | 'review' | 'approved' | 'delivered';
  createdAt: string;
  updatedAt: string;
}
