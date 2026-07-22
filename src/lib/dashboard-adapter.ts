// src/lib/dashboard-adapter.ts
export interface DashboardData {
  progetto: {
    codice: string; nome: string; livello: string; consulente: string;
    faseAttuale: number; totaleFasi: number; avanzamento: number;
    fasi: { n: number; titolo: string; stato: 'completato' | 'in_corso' | 'in_attesa' }[];
  };
  stats: { totaleProgetto: number; pagato: number; daPagare: number; prossimaScadenza: string | null; };
  pagamenti: { id: string; desc: string; importo: number; stato: 'pagato' | 'in_attesa' | 'scaduto' | 'bloccato'; scadenza?: string; data?: string; linkPagamento?: string; }[];
  documenti: { nome: string; fase: number; data: string; dimensione?: string; scaricabile: boolean; }[];
  messaggi: { id: string; mittente: string; ruolo: 'consulente' | 'sistema' | 'cliente'; contenuto: string; data: string; letto: boolean; }[];
}

export async function getDashboardData(clientId: string): Promise<DashboardData> {
  // Mock data per deploy rapido (in produzione: fetch a Odoo/DB)
  return {
    progetto: {
      codice: "PI-2026-0024", nome: "Business Plan Startup Tech", livello: "L1", consulente: "Christian Rossi",
      faseAttuale: 2, totaleFasi: 6, avanzamento: 35,
      fasi: [
        { n: 1, titolo: "Audit & Intervista", stato: "completato" },
        { n: 2, titolo: "Analisi di Mercato", stato: "in_corso" },
        { n: 3, titolo: "Strategia & Posizionamento", stato: "in_attesa" },
        { n: 4, titolo: "Financial Modeling", stato: "in_attesa" },
        { n: 5, titolo: "Stesura & Design", stato: "in_attesa" },
        { n: 6, titolo: "Revisione & Consegna", stato: "in_attesa" },
      ]
    },
    stats: { totaleProgetto: 1500, pagato: 750, daPagare: 750, prossimaScadenza: "30/08/2026" },
    pagamenti: [
      { id: "SAL-1", desc: "Acconto all'ordine (50%)", importo: 750, stato: "pagato", data: "10/07/2026" },
      { id: "SAL-2", desc: "Saldo alla consegna (50%)", importo: 750, stato: "in_attesa", scadenza: "30/08/2026", linkPagamento: "/checkout/INV-DEMO-001" }
    ],
    documenti: [
      { nome: "Questionario Strategico Compilato", fase: 1, data: "10/07/2026", dimensione: "245 KB", scaricabile: true },
      { nome: "Business Plan Draft v1", fase: 5, data: "-", scaricabile: false }
    ],
    messaggi: [
      { id: "1", mittente: "Christian Rossi", ruolo: "consulente", contenuto: "Ciao! Ho ricevuto i dati per l'audit. Procedo con l'analisi.", data: "11/07/2026", letto: false },
      { id: "2", mittente: "Sistema", ruolo: "sistema", contenuto: "Il pagamento SAL-1 è stato confermato.", data: "10/07/2026", letto: true }
    ]
  };
}
