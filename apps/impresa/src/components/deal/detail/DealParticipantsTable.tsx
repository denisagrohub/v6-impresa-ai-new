// ═══════════════════════════════════════════════════════════════════
// DealParticipantsTable — tabella partecipanti deal con quota e tier.
// Estratto il 29/09/2026 (C1.b) da:
//   app/admin/deals/[id]/page.tsx
// Nota: per role='referral' la quota e' mostrata come 'fisso'
// (non percentuale), coerente con la logica di pagamento referral.
// ═══════════════════════════════════════════════════════════════════

import { roleLabel } from './format';

type Participant = {
  id: number;
  partnerName: string;
  role: string;
  tier: string;
  scope: string;
  sharePct: number;
  isReferralPayer: boolean;
};

type Props = { participants: Participant[] };

export function DealParticipantsTable({ participants }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
        Partecipanti ({participants.length})
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
          <tr>
            <th className="px-4 py-2 text-left">Nome</th>
            <th className="px-4 py-2 text-left">Ruolo</th>
            <th className="px-4 py-2 text-left">Tier</th>
            <th className="px-4 py-2 text-right">Quota</th>
          </tr>
        </thead>
        <tbody>
          {participants.map(p => (
            <tr key={p.id} className="border-t border-gray-100">
              <td className="px-4 py-2">{p.partnerName}</td>
              <td className="px-4 py-2 text-gray-600">{roleLabel[p.role] || p.role}</td>
              <td className="px-4 py-2 text-gray-500">{p.tier || '—'}</td>
              <td className="px-4 py-2 text-right font-mono">
                {p.role === 'referral'
                  ? 'fisso'
                  : `${(p.sharePct * 100).toFixed(2)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
