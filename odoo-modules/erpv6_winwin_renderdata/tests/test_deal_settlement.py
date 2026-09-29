# -*- coding: utf-8 -*-
"""Test suite C5.6 — motore pagamento settlement deal.

Copre le guardie hard introdotte in Refactor C:
- C0.1: pagamento bloccato se incasso dal cliente != totale
- C5.1: doppia firma bonifici sopra soglia (2 approvatori diversi)

Ogni test gira in TransactionCase (rollback automatico).
Nessuna scrittura persistente: threshold + approvers vengono settati
nel setUp e ripristinati dal rollback Odoo a fine test.
"""
from odoo.tests.common import TransactionCase
from odoo.tests import tagged
from odoo.exceptions import UserError


@tagged('post_install', '-at_install')
class TestDealSettlementPayment(TransactionCase):
    """Test guardie pagamento + doppia firma bonifici."""

    def setUp(self):
        super().setUp()

        # --- 1. Utenti per 2ª firma (admin + secondo admin) ---
        self.user1 = self.env.user  # admin (id=1)
        self.user2 = self.env['res.users'].create({
            'name': 'Secondo Approvatore Test',
            'login': 'second.approver@test.local',
            'email': 'second.approver@test.local',
            'groups_id': [(6, 0, [self.env.ref('base.group_system').id])],
        })

        # --- 2. Configurazione globale (rollbackata a fine test) ---
        # Soglia 10k come default di produzione. La lista approvers la
        # settiamo test-by-test, così i singoli casi sono indipendenti.
        P = self.env['ir.config_parameter'].sudo()
        P.set_param('erpv6_deal.payment_dual_threshold', '10000')
        P.set_param('erpv6_deal.payment_approvers', '')

        # --- 3. Partner di test ---
        self.seller = self.env['res.partner'].create({'name': 'Test Seller'})
        self.buyer = self.env['res.partner'].create({'name': 'Test Buyer'})
        self.consultant = self.env['res.partner'].create({'name': 'Test Consultant'})

        # --- 4. Nodo tracking_relation (required su deal.relation_id) ---
        self.relation = self.env['erpv6.tracking.relation'].create({
            'name': 'Test Deal Relation',
        })

        # --- 5. Schema (riuso TEE-ROLLING-001 se esiste, altrimenti crea) ---
        Schema = self.env['erpv6.deal.schema']
        schema = Schema.search([('code', '=', 'TEE-ROLLING-001')], limit=1)
        if not schema:
            schema = Schema.create({
                'code': 'TEST-SCHEMA-001',
                'name': 'Schema Test',
            })
        self.schema = schema

        # --- 6. Deal ---
        self.deal = self.env['erpv6.deal'].create({
            'name': 'Test Deal Settlement',
            'relation_id': self.relation.id,
            'schema_id': self.schema.id,
            'seller_id': self.seller.id,
            'buyer_id': self.buyer.id,
            'revenue_model': 'fee',
        })

        # --- 7. Participant (serve per creare line) ---
        self.participant = self.env['erpv6.deal.participant'].create({
            'deal_id': self.deal.id,
            'partner_id': self.consultant.id,
            'role': 'consultant',
            'tier': 'founder',
            'share_pct': 1.0,  # 100% per semplicità di calcolo
            'scope': 'project',
        })

        # --- 8. Settlement (fee 4.5%, 100k TEE @ 100 EUR = 10k transato) ---
        # transato_totale = 1000 * 100 = 100.000
        # ricavo_lordo (fee) = 100.000 * 4.5% = 4.500
        self.settlement = self.env['erpv6.deal.settlement'].create({
            'deal_id': self.deal.id,
            'periodo_mese': '9',
            'periodo_anno': 2026,
            'unita': 'TEE',
            'quantita_reale': 1000,
            'prezzo_medio_reale': 100,
            'fee_pct_reale': 4.5,
            'incasso_modalita': 'totale',
        })

        # --- 9. Line pagamento: importo_effettivo 5000 (per semplicità) ---
        self.line = self.env['erpv6.deal.settlement.line'].create({
            'settlement_id': self.settlement.id,
            'participant_id': self.participant.id,
            'importo_effettivo': 5000,
        })

    # ═══════════════════════════════════════════════════════════════
    # TEST 1-3: requires_second_approval (soglia + approvers)
    # ═══════════════════════════════════════════════════════════════

    def test_01_requires_sotto_soglia(self):
        """Sotto soglia (5000 < 10000): no doppia firma."""
        self.assertFalse(self.line.requires_second_approval)

    def test_02_requires_sopra_soglia_senza_approvers(self):
        """Sopra soglia MA approvers vuoti: fallback → no doppia firma."""
        self.line.importo_effettivo = 50000
        # approvers è già vuoto dal setUp
        self.assertFalse(self.line.requires_second_approval)

    def test_03_requires_sopra_soglia_con_approvers(self):
        """Sopra soglia + approvers configurati: doppia firma richiesta."""
        self.env['ir.config_parameter'].sudo().set_param(
            'erpv6_deal.payment_approvers',
            f'{self.user1.id},{self.user2.id}')
        self.line.importo_effettivo = 50000
        self.assertTrue(self.line.requires_second_approval)

    # ═══════════════════════════════════════════════════════════════
    # TEST 4: guardia incasso non totale (C0.1)
    # ═══════════════════════════════════════════════════════════════

    def test_04_segna_in_pagamento_blocca_incasso_parziale(self):
        """Incasso parziale (1000 < target 4500): UserError su
        action_segna_in_pagamento. Guardia hard C0.1."""
        # Fattura ricevuta OK (richiede pagabile=True... ma pagabile=False
        # per incasso parziale → action_segna_fattura_ricevuta solleva).
        # Quindi forzo direttamente lo stato a fattura_ricevuta bypassando
        # il guard (per testare action_segna_in_pagamento isolatamente).
        self.env['erpv6.deal.settlement.incasso'].create({
            'settlement_id': self.settlement.id,
            'importo': 1000,
            'source': 'manuale',
            'data': '2026-09-29 10:00:00',
        })
        self.env.flush_all()
        self.settlement.invalidate_recordset()
        self.line.invalidate_recordset()
        self.assertEqual(self.settlement.incasso_stato, 'parziale')

        # Forzo lo stato a fattura_ricevuta (bypass del guard precedente)
        self.line.pagamento_stato = 'fattura_ricevuta'

        with self.assertRaises(UserError) as cm:
            self.line.action_segna_in_pagamento()
        self.assertIn('Incasso dal cliente non ancora totale', str(cm.exception))

    # ═══════════════════════════════════════════════════════════════
    # TEST 5: biforca su soglia (sopra → attesa_seconda_firma)
    # ═══════════════════════════════════════════════════════════════

    def test_05_segna_in_pagamento_sopra_soglia_biforca(self):
        """Incasso totale + importo sopra soglia + approvers configurati:
        action_segna_in_pagamento NON va in in_pagamento, ma in
        attesa_seconda_firma con approvato_da_1 = user corrente."""
        self.env['ir.config_parameter'].sudo().set_param(
            'erpv6_deal.payment_approvers',
            f'{self.user1.id},{self.user2.id}')
        self.line.importo_effettivo = 50000

        # Incasso totale: importo = ricavo_lordo (4500)
        self.settlement.action_registra_incasso(importo=4500)
        self.env.flush_all()
        self.settlement.invalidate_recordset()
        self.line.invalidate_recordset()
        self.assertEqual(self.settlement.incasso_stato, 'totale')

        self.line.pagamento_stato = 'fattura_ricevuta'
        self.line.action_segna_in_pagamento()

        self.assertEqual(self.line.pagamento_stato, 'attesa_seconda_firma')
        self.assertEqual(self.line.approvato_da_1, self.user1)

    # ═══════════════════════════════════════════════════════════════
    # TEST 6-7: action_approva_seconda (validazioni)
    # ═══════════════════════════════════════════════════════════════

    def test_06_approva_seconda_stesso_utente_rifiuta(self):
        """La 2ª firma deve essere di un utente diverso dal 1°."""
        self.env['ir.config_parameter'].sudo().set_param(
            'erpv6_deal.payment_approvers',
            f'{self.user1.id},{self.user2.id}')
        # Stato di partenza: attesa_seconda_firma con approvato_da_1=user1
        self.line.pagamento_stato = 'attesa_seconda_firma'
        self.line.approvato_da_1 = self.user1.id

        with self.assertRaises(UserError) as cm:
            # stesso utente (admin) → rifiuta
            self.line.action_approva_seconda()
        self.assertIn('diverso dal 1', str(cm.exception))

    def test_07_approva_seconda_non_approver_rifiuta(self):
        """Solo chi è in payment_approvers può firmare per secondi."""
        self.env['ir.config_parameter'].sudo().set_param(
            'erpv6_deal.payment_approvers',
            f'{self.user1.id}')  # user2 NON in lista
        self.line.pagamento_stato = 'attesa_seconda_firma'
        self.line.approvato_da_1 = self.user1.id

        with self.assertRaises(UserError) as cm:
            self.line.with_user(self.user2).action_approva_seconda()
        self.assertIn('Non sei nella lista approvers', str(cm.exception))

    # ═══════════════════════════════════════════════════════════════
    # TEST 8: guardia segna_pagato senza 2ª firma (C5.1)
    # ═══════════════════════════════════════════════════════════════

    def test_08_segna_pagato_senza_seconda_firma_rifiuta(self):
        """Sopra soglia con approvers: action_segna_pagato rifiuta se
        approvato_da_2 è vuoto. Guardia hard C5.1."""
        self.env['ir.config_parameter'].sudo().set_param(
            'erpv6_deal.payment_approvers',
            f'{self.user1.id},{self.user2.id}')
        self.line.importo_effettivo = 50000

        # Incasso totale per non incappare nella guardia C0.1
        self.settlement.action_registra_incasso(importo=4500)
        self.env.flush_all()
        self.settlement.invalidate_recordset()
        self.line.invalidate_recordset()

        # Stato: in_pagamento ma SENZA 2ª firma
        self.line.pagamento_stato = 'in_pagamento'

        with self.assertRaises(UserError) as cm:
            self.line.action_segna_pagato()
        self.assertIn('2ª firma mancante', str(cm.exception))
