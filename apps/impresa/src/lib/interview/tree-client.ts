// Client per l'intervista ad albero (erpv6.interview.session lato Odoo).
// Wrapper leggero sui proxy /api/interview-tree/* - nessuna logica di
// scoring qui, quella (Kairos) resta interamente lato Odoo
// (erpv6.production.order._compute_kairos_matrix, vedi interview_engine.py).
// Distinto da lib/interview/interview-engine.ts, che serve invece il form
// statico /intervista (qualificazione lead a fasi fisse con scoring
// client-side per i pacchetti Business Plan).

export interface InterviewProductVariant {
    id: number;
    name: string;
    verticale: string;
}

export interface InterviewProduct {
    id: number;
    name: string;
    verticale: string;
    variants: InterviewProductVariant[];
}

export interface InterviewQuestionOption {
    id: number;
    value: string;
}

export type InterviewAnswerType = 'select' | 'text' | 'textarea' | 'number';

export interface InterviewQuestionPayload {
    session_id: number;
    question_id: number;
    question_text: string;
    answer_type: InterviewAnswerType;
    options: InterviewQuestionOption[];
    always_show_altro: boolean;
    contextual_message: string | null;
}

export interface StartInterviewResult {
    lead_id: number;
    question: InterviewQuestionPayload | false;
}

// Punteggio Kairós a video (25/08/2026, richiesto esplicitamente da
// Denis: lo scoring deve comparire SUBITO a fine intervista). Solo lettura
// di erpv6.kairos.matrix gia' calcolata da _complete() lato Odoo - null se
// budget/tempistiche non erano riconosciuti, mai un punteggio inventato
// qui lato client.
export interface InterviewScore {
    quadrante: string;
    quadrante_label: string | null;
    impatto_score: number;
    impatto_level: string;
    prontezza_totale: number;
    prontezza_level: string;
}

export interface AnswerInterviewResult {
    completed: boolean;
    question: InterviewQuestionPayload | false;
    score: InterviewScore | null;
}

async function parseOrThrow(response: Response): Promise<any> {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(body?.error || `Richiesta fallita (${response.status})`);
    }
    return body;
}

export async function fetchInterviewProducts(): Promise<InterviewProduct[]> {
    const response = await fetch('/api/interview-tree/products');
    const body = await parseOrThrow(response);
    return Array.isArray(body) ? body : [];
}

// name+email XOR lead_id, come /api/v1/interview/start (interview_api.py):
// se lead_id e' presente riusa quel crm.lead esistente, altrimenti richiede
// name+email per crearne uno nuovo.
export type StartInterviewParams =
    | { lead_id: number; verticale_id?: number; name?: never; email?: never }
    | { name: string; email: string; verticale_id?: number; lead_id?: never };

export async function startInterview(params: StartInterviewParams): Promise<StartInterviewResult> {
    const response = await fetch('/api/interview-tree/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return parseOrThrow(response);
}

export async function answerInterview(params: {
    session_id: number;
    option_id?: number;
    value_text?: string;
    is_altro?: boolean;
}): Promise<AnswerInterviewResult> {
    const response = await fetch('/api/interview-tree/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return parseOrThrow(response);
}
