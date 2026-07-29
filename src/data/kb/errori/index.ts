export const errorsBase = {
  allucinazioni: {
    'factual-001': {
      pattern: 'Invenzione di dati di mercato (TAM, SAM, SOM)',
      severity: 'critical',
      fix: 'Usa solo dati forniti o placeholder [DA DEFINIRE]',
      example: '"Il mercato vale €15M" → CORRETTO: "[DA DEFINIRE CON DATI DI SETTORE]"',
    },
    'factual-002': {
      pattern: 'Invenzione di competitor',
      severity: 'critical',
      fix: 'Chiedi al cliente i competitor reali',
      example: '"I competitor sono TechCorp e InnovateNow" → CORRETTO: "Chiedere al cliente i competitor reali"',
    },
    'numerical-001': {
      pattern: 'Proiezioni finanziarie inventate',
      severity: 'critical',
      fix: 'Non generare numeri, usa template Excel',
      example: '"Revenue 2027: €2.1M" → CORRETTO: "[INSERIRE NUMERI DA EXCEL]"',
    },
    'logical-001': {
      pattern: 'Contraddizioni tra sezioni',
      severity: 'high',
      fix: 'Verifica coerenza tra executive summary e dettagli',
      example: 'Executive summary dice +20% crescita, ma il modello dice +5%',
    },
    'contextual-001': {
      pattern: 'Tono non appropriato per il destinatario',
      severity: 'medium',
      fix: 'Usa il tono corretto: banca→formale, investitore→persuasivo',
      example: 'Per una banca: "Siamo fantastici!" → CORRETTO: "Abbiamo un track record solido"',
    },
    'formatting-001': {
      pattern: 'Formattazione non professionale',
      severity: 'low',
      fix: 'Usa template con font e layout standardizzati',
    },
  },
  errori_umani: {
    'human-001': {
      pattern: 'Dati inseriti dal cliente non verificati',
      severity: 'high',
      fix: 'Chiedi sempre le fonti dei dati del cliente',
    },
    'human-002': {
      pattern: 'Assunzioni non documentate',
      severity: 'medium',
      fix: 'Ogni assunzione deve essere esplicitata',
    },
  },
};
