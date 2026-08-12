export const knowledgeBase = {
  metodologie: {
    'v6-method': {
      name: 'Metodo V6',
      description: '6 fasi per la creazione del business plan',
      phases: [
        { id: 'discovery-dna', name: 'Discovery DNA', description: 'Raccolta visione e obiettivi' },
        { id: 'market-radar', name: 'Market Radar', description: 'Analisi di mercato e competitor' },
        { id: 'strategic-compass', name: 'Strategic Compass', description: 'Definizione strategia' },
        { id: 'financial-engine', name: 'Financial Engine', description: 'Modello finanziario' },
        { id: 'story-craft', name: 'StoryCraft', description: 'Stesura e design' },
        { id: 'impact-launch', name: 'Impact Launch', description: 'Consegna e supporto' },
      ],
      principles: [
        'Ogni fase deve essere completata prima di passare alla successiva',
        'Il cliente deve approvare ogni deliverable',
        'Le modifiche devono essere tracciate e versionate',
      ],
    },
    'kairo-matrix': {
      name: 'Matrice di Kairós',
      description: 'Framework per valutare il momento opportuno',
      quadrants: {
        'kairos-autentico': 'Alta opportunità, basso sforzo → agire subito',
        'quick-win': 'Alta opportunità, alto sforzo → pianificare',
        'prepara': 'Bassa opportunità, basso sforzo → preparare il terreno',
        'parcheggio': 'Bassa opportunità, alto sforzo → posticipare',
      },
    },
    'heinrich-triangle': {
      name: 'Triangolo di Heinrich',
      description: 'Framework per la gestione dei rischi',
      levels: {
        red: 'Rischi critici da mitigare immediatamente',
        yellow: 'Rischi medi da monitorare',
        green: 'Near miss da documentare e prevenire',
      },
    },
  },
  psicologia: {
    disc: {
      description: 'Modello DISC per la valutazione comportamentale',
      dimensions: {
        D: 'Dominanza - Orientato ai risultati',
        I: 'Influenza - Orientato alle relazioni',
        S: 'Stabilità - Orientato alla cooperazione',
        C: 'Conformità - Orientato alla precisione',
      },
    },
    pl: {
      description: 'Programmazione Linguistica',
      patterns: {
        'PL-01': 'Uso del "noi" → coinvolgimento',
        'PL-02': 'Decisione mentalmente presa → pronti all\'azione',
        'PL-05': 'Burn rate preoccupazione → da rassicurare',
        'PL-12': 'Focus sul futuro → visione chiara',
      },
    },
  },
  moduli: {
    'module-A-international': {
      name: 'Modulo A - Internazionalizzazione',
      description: 'Strategie di espansione internazionale',
    },
    'module-C-startup': {
      name: 'Modulo C - Startup',
      description: 'Business plan per startup',
    },
    'module-D-interview': {
      name: 'Modulo D - Intervista',
      description: 'Framework per l\'intervista strategica',
    },
    'module-F-scoring': {
      name: 'Modulo F - Scoring',
      description: 'Sistema di punteggio per la qualificazione dei lead',
    },
  },
  regole: {
    universali: [
      'Il cliente ha sempre ragione, ma i dati hanno l\'ultima parola',
      'Un business plan è uno strumento di comunicazione, non un documento fine a sé stesso',
      'La trasparenza e l\'onestà sono i pilastri della consulenza',
      'Ogni modifica deve essere tracciata e giustificata',
    ],
  },
};
