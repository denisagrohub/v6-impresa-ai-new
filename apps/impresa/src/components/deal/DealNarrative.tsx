'use client';

type ProspettoLine = {
    partnerName: string;
    role: string;
    monthlyMin: number;
    monthlyBase: number;
    monthlyMax: number;
};

type Variable = {
    name: string;
    valueBase: number;
    valueMin: number;
    valueMax: number;
    valueText: string;
    enabled: boolean;
    unit: string;
};

type Props = {
    deal: {
        name: string;
        revenueModel: string;
        state: string;
        variables: Variable[];
        participantCount: number;
    };
    prospetto: { lines: ProspettoLine[] } | null;
};

const fmt = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function DealNarrative({ deal, prospetto }: Props) {
    if (!prospetto || !prospetto.lines.length) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-800">
                <strong>Nessun prospetto generato.</strong> Congela il deal per vedere la ripartizione.
            </div>
        );
    }

    const v = (name: string) => deal.variables.find(x => x.name === name);
    const quantita = v('quantita_mese')?.valueBase || 0;
    const feePct = v('fee_v6_pct')?.valueBase || 0;
    const prezzoBase = v('prezzo_tee')?.valueBase || 0;
    const v6pct = v('v6_entity_pct');
    const rpct = v('reserve_pct');

    const consultants = prospetto.lines.filter(l => l.role === 'v6_entity' || l.role === 'consultant');
    const referrals = prospetto.lines.filter(l => l.role === 'referral');

    const totalBase = prospetto.lines.reduce((s, l) => s + l.monthlyBase, 0);
    const totalMin = prospetto.lines.reduce((s, l) => s + l.monthlyMin, 0);
    const totalMax = prospetto.lines.reduce((s, l) => s + l.monthlyMax, 0);

    const modelLabel: Record<string, string> = {
        fee: `modello fee ${feePct}% sul transato`,
        spread: 'modello spread (vendita − acquisto)',
        mixed: 'modello mixed (spread + fee)',
    };

    const feeV6Base = quantita * prezzoBase * (feePct / 100);
    const v6EntityBase = (v6pct?.enabled ? (feeV6Base * (v6pct.valueBase / 100)) : 0);
    const reserveBase = (rpct?.enabled ? (feeV6Base * (rpct.valueBase / 100)) : 0);
    const poolBase = feeV6Base - v6EntityBase - reserveBase;

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-5 mb-4">
            <div className="flex items-start gap-3">
                <div className="text-2xl">📊</div>
                <div className="flex-1 text-sm">
                    <div className="font-semibold text-indigo-900 mb-2">
                        Cosa raccontano questi numeri
                    </div>

                    <p className="text-gray-700 mb-2">
                        Il deal <strong>{deal.name}</strong> usa {modelLabel[deal.revenueModel] || deal.revenueModel}.
                        Su <strong>{quantita.toLocaleString('it-IT')} TEE/mese</strong> a prezzo base{' '}
                        <strong>{fmt(prezzoBase)}/TEE</strong>, la fee V6 è di{' '}
                        <strong>{fmt(feeV6Base)}/mese</strong> (scenario base).
                    </p>

                    {(v6EntityBase > 0 || reserveBase > 0) && (
                        <p className="text-gray-700 mb-2">
                            {v6EntityBase > 0 && <>V6 entità trattiene <strong>{fmt(v6EntityBase)}</strong> ({v6pct?.valueBase}%). </>}
                            {reserveBase > 0 && <>La riserva accumula <strong>{fmt(reserveBase)}</strong> ({rpct?.valueBase}%). </>}
                            Resta un pool consulenti di <strong>{fmt(poolBase)}/mese</strong>.
                        </p>
                    )}

                    <p className="text-gray-700 mb-1">
                        Ripartito tra <strong>{consultants.length} consulenti</strong>:
                    </p>

                    <ul className="ml-4 mb-2 space-y-0.5">
                        {consultants.map((l, i) => (
                            <li key={i} className="text-gray-700">
                                • <strong>{l.partnerName}</strong>: {fmt(l.monthlyBase)}/mese
                                <span className="text-gray-500 text-xs"> ({fmt(l.monthlyBase * 12)}/anno)</span>
                            </li>
                        ))}
                        {referrals.map((l, i) => (
                            <li key={`r${i}`} className="text-gray-700">
                                • <strong>{l.partnerName}</strong> (referral): {fmt(l.monthlyBase)}/mese
                            </li>
                        ))}
                    </ul>

                    <p className="text-gray-700 mb-2">
                        <strong>Scenari</strong>: nel pessimistico (MIN) il totale scende a{' '}
                        <strong>{fmt(totalMin)}/mese</strong>. Nell'ottimistico (MAX) sale a{' '}
                        <strong>{fmt(totalMax)}/mese</strong>. Delta: <strong>{fmt(totalMax - totalMin)}/mese</strong>.
                    </p>

                    <p className="text-gray-600 text-xs italic">
                        Su 12 mesi base il totale è {fmt(totalBase * 12)}. Su 24 mesi {fmt(totalBase * 24)}.
                        I numeri sono vincolanti dal freeze del prospetto.
                    </p>
                </div>
            </div>
        </div>
    );
}
