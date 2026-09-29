# -*- coding: utf-8 -*-
"""Test E2E #1 — percorso canonico partner → deal → pagamento consulenti.

Simula il flusso reale di un deal V6 (es. TEE):
  1. Nodo padre (progetto/aggregatore)
  2. Nodo figlio (deal 1 — trattativa specifica)
  3. Deal collegato al figlio, con 3 participant (V6 + 2 consulenti)
  4. Variabili critiche locked (prezzo, quantità, fee, durata)
  5. Checklist 6 step portata a 'done' (simula firme)
  6. action_freeze → prospetto generato
  7. Settlement mensile → settlement.action_freeze → line_ids
  8. Verifica importi line (share_pct applicato al ricavo_lordo)
  9. Guardia C0.1: incasso parziale blocca pagamento
 10. Incasso totale → pagamento 1 firma (sotto soglia 10k)
 11. Verifica: 3 line pagato=True

Non copre (test separati futuri):
- Multi-leg spread (E2E #2)
- Escrow conto segregato (E2E #3, bloccato su implementazione)

Ogni test gira in TransactionCase: rollback automatico.
"""
from odoo.tests.common import TransactionCase
from odoo.tests import tagged
from odoo.exceptions import UserError


@tagged('post_install', '-at_install')
class TestE2EPartnerDealPayment(TransactionCase):
    """Percorso end-to-end partner → deal → pagamento consulenti."""

    def setUp(self):
        super().setUp()

        # Soglia 10k, approvers vuoti (paga chiunque, 1 firma sola)
        P = self.env['ir.config_parameter'].sudo()
        P.set_param('erpv6_deal.payment_dual_threshold', '10000')
        P.set_param('erpv6_deal.payment_approvers', '')

        # Partner: 2 controparti + 3 consulenti
        self.seller = self.env['res.partner'].create({'name': 'E2E Seller'})
        self.buyer = self.env['res.partner'].create({'name': 'E2E Buyer'})
        self.p_v6 = self.env['res.partner'].create({'name': 'V6 Impresa E2E'})
        self.p_a = self.env['res.partner'].create({'name': 'Consulente A E2E'})
        self.p_b = self.env['res.partner'].create({'name': 'Consulente B E2E'})

        # Nodo padre (root progetto/aggregatore)
        self.parent_node = self.env['erpv6.tracking.relation'].create({
            'name': 'E2E Progetto TEE',
            'child_kind': 'parte',  # root, child_kind libero
        })

        # Nodo figlio (child_kind='progetto' — la trattativa)
        self.child_node = self.env['erpv6.tracking.relation'].create({
            'name': 'E2E Deal 1',
            'parent_id': self.parent_node.id,
            'child_kind': 'progetto',
        })

        # Schema
        self.schema = self.env['erpv6.deal.schema'].search(
            [('code', '=', 'TEE-ROLLING-001')], limit=1)
        if not self.schema:
            self.schema = self.env['erpv6.deal.schema'].create({
                'code': 'E2E-TEST-SCHEMA', 'name': 'E2E Test Schema',
            })

    # ══════════════════════════════════════════════════════════════
    # Helpers
    # ══════════════════════════════════════════════════════════════

    def _create_deal(self):
        """Crea il deal collegato al figlio, con 3 participant."""
        deal = self.env['erpv6.deal'].create({
            'name': 'E2E Deal 1',
            'relation_id': self.child_node.id,
            'schema_id': self.schema.id,
            'seller_id': self.seller.id,
            'buyer_id': self.buyer.id,
            'revenue_model': 'fee',
        })
        # 3 participant: V6 33%, A 33%, B 34%
        for partner, role, share in [
            (self.p_v6, 'v6_entity', 0.33),
            (self.p_a, 'consultant', 0.33),
            (self.p_b, 'consultant', 0.34),
        ]:
            self.env['erpv6.deal.participant'].create({
                'deal_id': deal.id,
                'partner_id': partner.id,
                'role': role,
                'tier': 'founder',
                'share_pct': share,
                'scope': 'project',
            })
        return deal

    def _create_critical_variables(self, deal):
        """Crea le 4 variabili critiche (locked) per il freeze.
        Valori scelti per calcolo tondo:
          prezzo 100 EUR, quantità 1000, fee 5% → ricavo 5000 EUR/mese."""
        V = self.env['erpv6.deal.variable']
        # 4 critiche (locked, enabled) + 3 referral (disabilitate, il
        # motore TEE-ROLLING-001 le legge sempre con .at() → devono
        # esistere nel snapshot anche se non usate).
        for name, label, base, vmin, vmax, unit, critical, enabled in [
            ('prezzo_tee', 'Prezzo TEE', 100.0, 90.0, 110.0, 'EUR/TEE', True, True),
            ('quantita_mese', 'Quantità TEE/mese', 1000.0, 0.0, 0.0, 'TEE', True, True),
            ('fee_v6_pct', 'Fee V6', 5.0, 3.0, 7.0, '%', True, True),
            ('durata_mesi', 'Durata rolling', 12.0, 12.0, 24.0, 'mesi', True, True),
            ('referral_type', 'Tipo referral', 0.0, 0.0, 0.0, '', True, False),
            ('referral_value', 'Valore referral', 0.0, 0.0, 0.0, 'EUR/mese', True, False),
            ('referral_imputation', 'Referral imputato a', 0.0, 0.0, 0.0, '', True, False),
        ]:
            V.create({
                'deal_id': deal.id,
                'name': name,
                'label': label,
                'source': 'manual',
                'is_critical': critical,
                'locked': True,
                'enabled': enabled,
                'value_base': base,
                'value_min': vmin,
                'value_max': vmax,
                'unit': unit,
            })

    def _complete_all_checklist(self, deal):
        """Porta tutti gli step a 'done' (simula firme)."""
        for step in deal.checklist_ids:
            step.write({
                'status': 'done',
                'is_ready': True,
            })

    def _freeze_deal(self, deal):
        """Porta il deal a frozen con prospetto generato."""
        self._create_critical_variables(deal)
        self._complete_all_checklist(deal)
        self.env.flush_all()
        deal.invalidate_recordset()
        deal.action_freeze()
        self.env.flush_all()
        deal.invalidate_recordset()

    def _create_settlement_and_freeze(self, deal):
        """Crea settlement mensile e congela per generare line_ids.
        Valori: 1000 TEE @ 100 EUR → transato 100k
        fee 5% → ricavo 5000 EUR/mese (target incasso per revenue_model=fee)."""
        settlement = self.env['erpv6.deal.settlement'].create({
            'deal_id': deal.id,
            'prospetto_id': deal.current_prospetto_id.id or False,
            'periodo_mese': '9',
            'periodo_anno': 2026,
            'unita': 'TEE',
            'quantita_reale': 1000,
            'prezzo_medio_reale': 100,
            'fee_pct_reale': 5.0,
            'incasso_modalita': 'totale',
        })
        settlement.action_freeze()
        self.env.flush_all()
        settlement.invalidate_recordset()
        return settlement

    # ══════════════════════════════════════════════════════════════
    # TEST
    # ══════════════════════════════════════════════════════════════

    def test_e2e_full_flow(self):
        # ── 1. Crea deal + verifica checklist automatica ──
        deal = self._create_deal()
        self.assertEqual(len(deal.checklist_ids), 6,
                         "Il deal deve avere 6 step checklist auto-generati")

        # ── 2. Freeze: variabili critiche + step done → action_freeze ──
        self._freeze_deal(deal)
        self.assertEqual(deal.state, 'frozen', "Deal deve essere congelato")
        self.assertTrue(deal.current_prospetto_id,
                        "Freeze deve generare un prospetto")
        prospetto = deal.current_prospetto_id
        self.assertEqual(len(prospetto.line_ids), 3,
                         "Prospetto deve avere 3 line (V6, A, B)")

        # ── 3. Verifica importi prospetto ──
        # fee mensile = 1000 * 100 * 5% = 5000 EUR
        # line A/B sono i percettori; V6 entity è struttura
        # Verifico sommatoria = fee mensile
        total_monthly_base = sum(l.monthly_base for l in prospetto.line_ids)
        self.assertAlmostEqual(
            total_monthly_base, 5000.0, places=2,
            msg="Somma prospetto = fee mensile V6 (5000 EUR)")

        # ── 4. Settlement + freeze → line_ids ──
        settlement = self._create_settlement_and_freeze(deal)
        self.assertEqual(settlement.state, 'frozen')
        self.assertEqual(settlement.transato_totale, 100000.0)
        self.assertEqual(settlement.ricavo_lordo, 5000.0)
        self.assertEqual(len(settlement.line_ids), 3,
                         "Settlement deve avere 3 line (una per participant)")

        # ── 5. Guardia C0.1: incasso parziale blocca pagamento ──
        # Registro 1000 EUR su target 5000 (fee) → parziale
        settlement.action_registra_incasso(importo=1000)
        self.env.flush_all()
        settlement.invalidate_recordset()
        self.assertEqual(settlement.incasso_stato, 'parziale')

        for line in settlement.line_ids:
            line.pagamento_stato = 'fattura_ricevuta'
            with self.assertRaises(UserError) as cm:
                line.action_segna_in_pagamento()
            self.assertIn('Incasso dal cliente non ancora totale',
                          str(cm.exception))

        # ── 6. Incasso totale → sblocco ──
        settlement.action_registra_incasso(importo=4000)  # 1000+4000=5000
        self.env.flush_all()
        settlement.invalidate_recordset()
        self.assertEqual(settlement.incasso_stato, 'totale')

        # ── 7. Paga ogni consulente (sotto soglia, 1 firma) ──
        for line in settlement.line_ids:
            line.invalidate_recordset()
            # Stato già a fattura_ricevuta dal passo precedente
            line.action_segna_in_pagamento()  # 1000 < 5000, no doppia firma
            self.assertEqual(line.pagamento_stato, 'in_pagamento')
            line.action_segna_pagato()
            self.assertEqual(line.pagamento_stato, 'pagato')
            self.assertTrue(line.pagato)

        # ── 8. Verifica finale: tutte pagate ──
        self.assertTrue(all(l.pagato for l in settlement.line_ids),
                        "Tutte le line devono essere pagate")
        paid_count = sum(1 for l in settlement.line_ids if l.pagamento_stato == 'pagato')
        self.assertEqual(paid_count, 3, "3 consulenti pagati")
