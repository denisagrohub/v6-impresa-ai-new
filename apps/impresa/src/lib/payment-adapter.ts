export interface Invoice {
    id: string;
    clientName: string;
    clientEmail: string;
    projectCode: string;
    level: string;
    amount: number;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'bloccato';
    paymentMethod?: 'stripe' | 'bonifico';
    createdAt: string;
    demo?: boolean;
    adminNotes?: string;
    dueDate?: string;
    description?: string;
    iban?: string;
}

export async function deleteDemoData(): Promise<{ deletedInvoices: number; deletedPayments: number }> {
    console.log('🗑️ Eliminazione dati demo in corso...');
    return { deletedInvoices: 0, deletedPayments: 0 };
}

// ✅ Aggiunta funzione mancante
export async function clearDemoData(): Promise<{ deletedInvoices: number; deletedPayments: number }> {
    return deleteDemoData();
}

export async function getDemoStats(): Promise<{ invoices: number; payments: number; leads: number }> {
    return { invoices: 0, payments: 0, leads: 0 };
}

export async function updateInvoiceStatus(
    invoiceId: string,
    status: Invoice['status'],
    paymentMethod?: Invoice['paymentMethod'],
    adminNotes?: string
): Promise<boolean> {
    console.log(`✅ Fattura ${invoiceId} aggiornata a: ${status}`);
    return true;
}
