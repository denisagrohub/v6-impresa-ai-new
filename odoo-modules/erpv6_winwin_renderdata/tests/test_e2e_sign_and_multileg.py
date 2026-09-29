# -*- coding: utf-8 -*-
"""Test E2E #2 + #3.

E2E #2 - flusso firma documenti (con adapter mockato):
  1. action_preview_document: PDF anteprima, nessuna sign_request
  2. action_send_sign_document: draft + PDF + hash + sign_request + step in_progress
  3. action_check_status con provider mockato: status -> signed

E2E #3 - deal multi-leg (aggregazione seller) + revenue_model spread:
  - 2 leg (60000 @ 200, 40000 @ 210)
  - Prezzo vendita 222.30, quantita 100k
  - gross_vendita = 22.230.000
  - gross_acquisto = 20.400.000
  - spread = 1.830.000 distribuito tra participant per share_pct

Provider firma mockato via unittest.mock.patch sul metodo send/check_status
della classe DocumensoAdapter: la chiamata HTTP reale e' esclusa.
"""
from unittest.mock import patch

from odoo.tests.common import TransactionCase
from odoo.tests import tagged
from odoo.exceptions import UserError


DOCUMENSO_ADAPTER = 'odoo.addons.erpv6_sign.models.providers.documenso.DocumensoAdapter'


@tagged('post_install', '-at_install')
class TestE2ESignFlow(TransactionCase):
    """E2E #2: flusso firma documenti (mock provider)."""

    def setUp(self):
        super().setUp()
        self.seller = self.env['res.partner'].create({
            'name': 'Sign Seller', 'email': 'sign.seller@test.local'})
        self.buyer = self.env['res.partner'].create({
            'name': 'Sign Buyer', 'email': 'sign.buyer@test.local'})
        self.partner = self.env['res.partner'].create({
            'name': 'Sign Partner', 'email': 'sign.partner@test.local'})
        self.relation = self.env['erpv6.tracking.relation'].create({
            'name': 'Sign Test Relation'})
        self.schema = self.env['erpv6.deal.schema'].search(
            [('code', '=', 'TEE-ROLLING-001')], limit=1)
        if not self.schema:
            self.schema = self.env['erpv6.deal.schema'].create({
                'code': 'E2E-SIGN-SCHEMA', 'name': 'E2E Sign Schema'})
        self.deal = self.env['erpv6.deal'].create({
            'name': 'Sign Test Deal',
            'relation_id': self.relation.id,
            'schema_id': self.schema.id,
            'seller_id': self.seller.id,
            'buyer_id': self.buyer.id,
            'revenue_model': 'fee',
        })
        self.env['erpv6.deal.participant'].create({
            'deal_id': self.deal.id,
            'partner_id': self.partner.id,
            'role': 'consultant',
            'tier': 'founder',
            'share_pct': 1.0,
            'scope': 'project',
        })

    def _first_step(self):
        return self.deal.checklist_ids.sorted('sequence')[0]

    def test_01_preview_no_sign_request(self):
        """Anteprima genera PDF ma NON crea sign_request."""
        step = self._first_step()
        result = step.action_preview_document()
        self.assertTrue(result['draft_id'])
        self.assertTrue(result['pdf_base64'])
        draft = self.env['erpv6.contract.draft'].browse(result['draft_id'])
        self.assertTrue(draft.name.startswith('__ANTEPRIMA__'))
        self.assertEqual(len(draft.sign_request_ids), 0)

    def test_02_send_sign_creates_full_chain(self):
        """Send: draft + PDF + hash SHA-256 + sign_request + step in_progress."""
        step = self._first_step()
        mock_send = {
            'status': 'sent',
            'external_id': 'mock-envelope-123',
            'request_url': 'https://mock/sign/xyz',
            'details': 'mocked',
        }
        with patch(DOCUMENSO_ADAPTER + '.send', return_value=mock_send):
            result = step.action_send_sign_document(partner_id=self.partner.id)

        draft = self.env['erpv6.contract.draft'].browse(result['contract_draft_id'])
        self.assertTrue(draft.exists())
        self.assertTrue(draft.document_id)
        self.assertTrue(draft.original_pdf_hash)
        self.assertEqual(len(draft.original_pdf_hash), 64)  # SHA-256

        sr = self.env['erpv6.sign.request'].browse(result['sign_request_id'])
        self.assertTrue(sr.exists())
        self.assertEqual(sr.status, 'sent')
        self.assertEqual(sr.external_id, 'mock-envelope-123')

        step.invalidate_recordset()
        self.assertEqual(step.status, 'in_progress')
        self.assertEqual(step.sign_request_id.id, sr.id)

    def test_03_check_status_updates_to_signed(self):
        """Provider mockato: action_check_status porta sr.status a signed."""
        from odoo import fields
        step = self._first_step()
        mock_send = {'status': 'sent', 'external_id': 'mock-456',
                     'request_url': 'https://mock'}
        with patch(DOCUMENSO_ADAPTER + '.send', return_value=mock_send):
            result = step.action_send_sign_document(partner_id=self.partner.id)

        sr = self.env['erpv6.sign.request'].browse(result['sign_request_id'])
        mock_check = {'status': 'signed', 'signed_at': fields.Datetime.now()}
        with patch(DOCUMENSO_ADAPTER + '.check_status', return_value=mock_check):
            sr.action_check_status()

        sr.invalidate_recordset()
        self.assertEqual(sr.status, 'signed')


@tagged('post_install', '-at_install')
class TestE2EMultiLeg(TransactionCase):
    """E2E #3: deal multi-leg (aggregazione seller) + revenue_model spread."""

    def setUp(self):
        super().setUp()
        self.seller_1 = self.env['res.partner'].create({'name': 'Seller Alpha'})
        self.seller_2 = self.env['res.partner'].create({'name': 'Seller Beta'})
        self.buyer = self.env['res.partner'].create({'name': 'Buyer MultiLeg'})
        self.p_v6 = self.env['res.partner'].create({'name': 'V6 Impresa ML'})
        self.p_a = self.env['res.partner'].create({'name': 'Consulente A ML'})
        self.relation = self.env['erpv6.tracking.relation'].create({
            'name': 'MultiLeg Relation'})
        self.schema = self.env['erpv6.deal.schema'].search(
            [('code', '=', 'TEE-ROLLING-001')], limit=1)

    def _create_variables(self, deal):
        V = self.env['erpv6.deal.variable']
        for name, base, vmin, vmax, unit, enabled in [
            ('prezzo_tee', 222.30, 197.60, 247.00, 'EUR/TEE', True),
            ('quantita_mese', 100000.0, 0.0, 0.0, 'TEE', True),
            ('fee_v6_pct', 4.5, 3.0, 6.0, '%', True),
            ('durata_mesi', 12.0, 12.0, 24.0, 'mesi', True),
            ('referral_type', 0.0, 0.0, 0.0, '', False),
            ('referral_value', 0.0, 0.0, 0.0, 'EUR/mese', False),
            ('referral_imputation', 0.0, 0.0, 0.0, '', False),
        ]:
            V.create({
                'deal_id': deal.id,
                'name': name,
                'label': name,
                'source': 'manual',
                'is_critical': True,
                'locked': True,
                'enabled': enabled,
                'value_base': base,
                'value_min': vmin,
                'value_max': vmax,
                'unit': unit,
            })

    def test_multileg_spread_prospetto(self):
        """2 leg + spread -> prospetto con gross = spread, distribuito
        tra i participant per share_pct."""
        deal = self.env['erpv6.deal'].create({
            'name': 'MultiLeg Test Deal',
            'relation_id': self.relation.id,
            'schema_id': self.schema.id,
            'seller_id': self.seller_1.id,
            'buyer_id': self.buyer.id,
            'revenue_model': 'spread',
        })
        # 2 leg: 60000 @ 200 + 40000 @ 210
        self.env['erpv6.deal.leg'].create({
            'deal_id': deal.id,
            'seller_id': self.seller_1.id,
            'quantita': 60000,
            'prezzo_acquisto': 200,
        })
        self.env['erpv6.deal.leg'].create({
            'deal_id': deal.id,
            'seller_id': self.seller_2.id,
            'quantita': 40000,
            'prezzo_acquisto': 210,
        })
        # 2 participant: V6 50%, consulente A 50%
        for partner, role, share in [
            (self.p_v6, 'v6_entity', 0.5),
            (self.p_a, 'consultant', 0.5),
        ]:
            self.env['erpv6.deal.participant'].create({
                'deal_id': deal.id,
                'partner_id': partner.id,
                'role': role,
                'tier': 'founder',
                'share_pct': share,
                'scope': 'project',
            })
        self._create_variables(deal)
        for step in deal.checklist_ids:
            step.write({'status': 'done', 'is_ready': True})
        self.env.flush_all()
        deal.invalidate_recordset()
        deal.action_freeze()
        self.env.flush_all()
        deal.invalidate_recordset()

        self.assertEqual(deal.state, 'frozen')
        self.assertTrue(deal.current_prospetto_id)
        prospetto = deal.current_prospetto_id
        self.assertEqual(len(prospetto.line_ids), 2)

        # gross_vendita = 100000 * 222.30 = 22.230.000
        # gross_acquisto = 60000*200 + 40000*210 = 20.400.000
        # spread = 1.830.000
        # V6 50% = 915.000 ; A 50% = 915.000
        spread_atteso = 1_830_000
        line_v6 = prospetto.line_ids.filtered(
            lambda l: l.participant_id.partner_id.id == self.p_v6.id)
        line_a = prospetto.line_ids.filtered(
            lambda l: l.participant_id.partner_id.id == self.p_a.id)
        self.assertAlmostEqual(line_v6.monthly_base, spread_atteso * 0.5, places=0)
        self.assertAlmostEqual(line_a.monthly_base, spread_atteso * 0.5, places=0)
        # Somma = spread totale
        total = sum(l.monthly_base for l in prospetto.line_ids)
        self.assertAlmostEqual(total, spread_atteso, places=0)
