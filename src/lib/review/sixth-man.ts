// ================================================================
// SESTO UOMO - Sistema di Revisione Multi-Livello
// ================================================================

export type ReviewerRole = 
  | 'ai'              // Revisore 1: AI Self-Check
  | 'junior'          // Revisore 2: Consulente Junior
  | 'senior'          // Revisore 3: Consulente Senior
  | 'specialist'      // Revisore 4: Specialista di Settore
  | 'external'        // Revisore 5: Revisore Esterno
  | 'client';         // Revisore 6: Cliente

export interface ReviewCheck {
  id: string;
  name: string;
  description: string;
  checked: boolean;
  checkedBy?: ReviewerRole;
  checkedAt?: string;
  notes?: string;
}

export interface SixthManReview {
  id: string;
  documentId: string;
  documentType: 'business_plan' | 'financial_model' | 'pitch_deck' | 'market_analysis';
  currentReviewer: ReviewerRole;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  checks: ReviewCheck[];
  errorsFound: number;
  totalErrors: number;
  startedAt: string;
  completedAt?: string;
  reviewerNotes: Record<ReviewerRole, string>;
  approved: boolean;
}

// Checklist per ogni tipo di documento
const CHECKLISTS: Record<string, ReviewCheck[]> = {
  business_plan: [
    { id: 'bp_01', name: 'Coerenza Metodo V6', description: 'Il documento segue il Metodo V6 in tutte le sezioni', checked: false },
    { id: 'bp_02', name: 'Dati Finanziari', description: 'I dati finanziari sono coerenti e verificati', checked: false },
    { id: 'bp_03', name: 'Analisi Mercato', description: 'L\'analisi di mercato è basata su dati reali', checked: false },
    { id: 'bp_04', name: 'Chiarezza Espositiva', description: 'Il documento è chiaro e ben strutturato', checked: false },
    { id: 'bp_05', name: 'Coerenza Interna', description: 'Non ci sono contraddizioni tra le sezioni', checked: false },
    { id: 'bp_06', name: 'Formattazione', description: 'Il documento è formattato correttamente', checked: false },
    { id: 'bp_07', name: 'Allineamento Brand', description: 'Il documento rispecchia l\'identità del brand', checked: false },
    { id: 'bp_08', name: 'Checklist Banca', description: 'Il documento soddisfa i requisiti bancari', checked: false },
  ],
  financial_model: [
    { id: 'fm_01', name: 'Formule Corrette', description: 'Tutte le formule sono corrette', checked: false },
    { id: 'fm_02', name: 'Coerenza Numeri', description: 'I numeri sono coerenti tra loro', checked: false },
    { id: 'fm_03', name: 'Scenari', description: 'Gli scenari sono realistici e documentati', checked: false },
    { id: 'fm_04', name: 'Driver', description: 'I driver di crescita sono giustificati', checked: false },
  ],
  pitch_deck: [
    { id: 'pd_01', name: 'Storytelling', description: 'La storia è coinvolgente e chiara', checked: false },
    { id: 'pd_02', name: 'Design', description: 'Il design è professionale e coerente', checked: false },
    { id: 'pd_03', name: 'Dati', description: 'I dati sono accurati e ben presentati', checked: false },
    { id: 'pd_04', name: 'Call to Action', description: 'La call to action è chiara e forte', checked: false },
  ],
};

export class SixthManSystem {
  private reviews: Map<string, SixthManReview> = new Map();

  // 1. Avvia un nuovo processo di revisione
  startReview(documentId: string, documentType: string): SixthManReview {
    const review: SixthManReview = {
      id: `REV-${Date.now()}`,
      documentId,
      documentType: documentType as any,
      currentReviewer: 'ai',
      status: 'in_progress',
      checks: CHECKLISTS[documentType] || [],
      errorsFound: 0,
      totalErrors: 0,
      startedAt: new Date().toISOString(),
      reviewerNotes: {
        ai: '',
        junior: '',
        senior: '',
        specialist: '',
        external: '',
        client: '',
      },
      approved: false,
    };

    this.reviews.set(review.id, review);
    return review;
  }

  // 2. Esegue una revisione per un ruolo specifico
  review(
    reviewId: string,
    reviewerRole: ReviewerRole,
    errors: string[],
    notes: string
  ): { success: boolean; nextReviewer: ReviewerRole | null; errorsFound: number } {
    const review = this.reviews.get(reviewId);
    if (!review) return { success: false, nextReviewer: null, errorsFound: 0 };

    // Verifica che il revisore sia quello corretto
    if (review.currentReviewer !== reviewerRole) {
      return { success: false, nextReviewer: null, errorsFound: 0 };
    }

    // Registra gli errori trovati
    const errorCount = errors.length;
    review.errorsFound += errorCount;
    review.totalErrors += errorCount;
    review.reviewerNotes[reviewerRole] = notes;

    // Marca i check come completati
    for (const check of review.checks) {
      if (!check.checked) {
        check.checked = true;
        check.checkedBy = reviewerRole;
        check.checkedAt = new Date().toISOString();
      }
    }

    // Determina il prossimo revisore
    const nextReviewer = this.getNextReviewer(reviewerRole);

    if (nextReviewer === null) {
      // Tutti i revisori hanno completato
      review.status = 'completed';
      review.completedAt = new Date().toISOString();
      review.approved = review.errorsFound === 0;
    } else {
      review.currentReviewer = nextReviewer;
    }

    this.reviews.set(reviewId, review);

    return {
      success: true,
      nextReviewer,
      errorsFound: errorCount,
    };
  }

  // 3. Determina il prossimo revisore
  private getNextReviewer(current: ReviewerRole): ReviewerRole | null {
    const order: ReviewerRole[] = ['ai', 'junior', 'senior', 'specialist', 'external', 'client'];
    const index = order.indexOf(current);
    return index < order.length - 1 ? order[index + 1] : null;
  }

  // 4. Ottieni lo stato della revisione
  getReviewStatus(reviewId: string): SixthManReview | null {
    return this.reviews.get(reviewId) || null;
  }

  // 5. Ottieni il riepilogo degli errori per ruolo
  getErrorSummary(reviewId: string): Record<ReviewerRole, number> {
    const review = this.reviews.get(reviewId);
    if (!review) return {} as any;

    const summary: any = {};
    const roles: ReviewerRole[] = ['ai', 'junior', 'senior', 'specialist', 'external', 'client'];
    let remainingErrors = review.totalErrors;

    // Simula il numero di errori trovati da ogni revisore
    // In realtà, questi vengono registrati durante la revisione
    return summary;
  }

  // 6. Genera un report di revisione
  generateReport(reviewId: string): string {
    const review = this.reviews.get(reviewId);
    if (!review) return 'Revisione non trovata';

    const lines = [
      '=============================================================',
      '📋 RAPPORTO REVISIONE - SESTO UOMO',
      '=============================================================',
      '',
      `Documento: ${review.documentId}`,
      `Tipo: ${review.documentType}`,
      `Stato: ${review.status}`,
      `Approvato: ${review.approved ? '✅ SÌ' : '❌ NO'}`,
      `Errori totali: ${review.totalErrors}`,
      '',
      '📊 REVISORI:',
    ];

    const roles: ReviewerRole[] = ['ai', 'junior', 'senior', 'specialist', 'external', 'client'];
    const roleLabels: Record<ReviewerRole, string> = {
      ai: '1️⃣ AI Self-Check',
      junior: '2️⃣ Consulente Junior',
      senior: '3️⃣ Consulente Senior',
      specialist: '4️⃣ Specialista Settore',
      external: '5️⃣ Revisore Esterno',
      client: '6️⃣ Cliente (Finale)',
    };

    for (const role of roles) {
      const isComplete = review.reviewerNotes[role] !== '';
      const status = isComplete ? '✅ Completato' : '⏳ In attesa';
      lines.push(`   ${roleLabels[role]}: ${status}`);
    }

    lines.push('');
    lines.push('📝 CHECKLIST:');
    for (const check of review.checks) {
      const status = check.checked ? '✅' : '⬜';
      const by = check.checkedBy ? ` (da ${check.checkedBy})` : '';
      lines.push(`   ${status} ${check.name}${by}`);
    }

    lines.push('');
    lines.push('=============================================================');

    return lines.join('\n');
  }
}

export const sixthManSystem = new SixthManSystem();
