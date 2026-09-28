# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase
from odoo.tests import tagged
from odoo.exceptions import ValidationError


@tagged('post_install', '-at_install')
class TestResPartnerLifecycle(TransactionCase):
    """28/09/2026: test lifecycle stage su res.partner."""

    def setUp(self):
        super().setUp()
        self.Partner = self.env['res.partner']

    def test_default_stage_is_partner(self):
        p = self.Partner.create({'name': 'Test Lifecycle Default'})
        self.assertEqual(p.lifecycle_stage, 'partner')

    def test_default_quality_score_is_50(self):
        p = self.Partner.create({'name': 'Test Lifecycle Score'})
        self.assertEqual(p.quality_score, 50)

    def test_quality_score_out_of_range_raises(self):
        p = self.Partner.create({'name': 'Test Lifecycle OutRange'})
        with self.assertRaises(ValidationError):
            p.quality_score = 150
        with self.assertRaises(ValidationError):
            p.quality_score = -1

    def test_onchange_degradato_sets_timestamp(self):
        p = self.Partner.new({'name': 'Test Lifecycle Onch'})
        p.lifecycle_stage = 'degradato'
        p._onchange_lifecycle_stage()
        self.assertTrue(p.degraded_at)

    def test_onchange_exit_degradato_clears_timestamp(self):
        p = self.Partner.new({'name': 'Test Lifecycle Exit'})
        p.lifecycle_stage = 'degradato'
        p._onchange_lifecycle_stage()
        self.assertTrue(p.degraded_at)
        p.lifecycle_stage = 'attivo'
        p._onchange_lifecycle_stage()
        self.assertFalse(p.degraded_at)

    def test_search_excludes_degradato(self):
        p_active = self.Partner.create({
            'name': 'Test Lifecycle Active',
            'lifecycle_stage': 'attivo',
        })
        p_degr = self.Partner.create({
            'name': 'Test Lifecycle Degraded',
            'lifecycle_stage': 'degradato',
        })
        found = self.Partner.search([
            ('id', 'in', [p_active.id, p_degr.id]),
            ('lifecycle_stage', '!=', 'degradato'),
        ])
        self.assertIn(p_active, found)
        self.assertNotIn(p_degr, found)
