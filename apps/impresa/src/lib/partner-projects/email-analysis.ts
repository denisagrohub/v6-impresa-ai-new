// ═══════════════════════════════════════════════════════════════════
// email-analysis.ts — analisi euristica del contenuto email in uscita.
// Estratto il 29/09/2026 (Refactor C, step C1.e) da:
//   app/admin/partner-projects/[id]/page.tsx
// Funzione pura: regex sul testo per rilevare cosa l'email chiede
// alla controparte (firma / documenti / riscontro). Zero dipendenze.
// ═══════════════════════════════════════════════════════════════════

export type SentEmailAnalysis = {
  needsSignature: boolean;
  needsDocuments: boolean;
  needsReply: boolean;
};

/**
 * Analizza oggetto + corpo email in uscita per stimare cosa attende
 * la controparte. Euristica su keyword italiane, non ML.
 */
export function analyzeSentEmailContent(
  subject: string,
  bodyText: string,
): SentEmailAnalysis {
  const fullText = `subject${subject}subject${bodyText}`.toLowerCase();
  const needsSignature = /(rimandare firmat|restituire firmat|inviare copia firmat|inviare il contratto firmat|ti chiedo di firmare|attesa di firma|inviare modulo firmato)/i.test(fullText);
  const needsDocuments = /(gentilmente inviar|potresti inviar|restiamo in attesa d|attendiamo i seguent|inviaci|mancanti|ci servirebb|documentazione|visura|carta d'identit|codice fiscale)/i.test(fullText);
  const needsReply = /(fammi sapere|facci sapere|in attesa di tua|in attesa di un vostro|fammi avere un riscontro|confermac)/i.test(fullText);
  return { needsSignature, needsDocuments, needsReply };
}
