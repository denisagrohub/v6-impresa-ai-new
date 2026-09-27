# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'models'))

from deal_engine import compute_prospetto


class FakePartner:
    def __init__(self, name):
        self.display_name = name


class FakeUser:
    def __init__(self, login):
        self.login = login


class FakeParticipant:
    _counter = 0
    def __init__(self, name, role, share, login=None, is_referral_payer=False):
        FakeParticipant._counter += 1
        self.id = FakeParticipant._counter
        self.partner_id = FakePartner(name)
        self.role = role
        self.share_pct = share
        self.consultant_user_id = FakeUser(login) if login else None
        self.is_referral_payer = is_referral_payer


class FakeDeal:
    def __init__(self, participants):
        self.participant_ids = participants


def make_deal():
    FakeParticipant._counter = 0
    third = 1.0 / 3.0
    return FakeDeal([
        FakeParticipant('V6 Impresa', 'v6_entity', third),
        FakeParticipant('Enzo', 'consultant', third, login='enzo'),
        FakeParticipant('Christian Girardi', 'consultant', third,
                        login='christian.girardi', is_referral_payer=True),
    ])


def snapshot(prezzo_min, prezzo_base, prezzo_max,
             fee_min, fee_base, fee_max,
             ref_min, ref_base, ref_max,
             ref_type='fixed', ref_imputation='christian',
             quantita=100000, durata_min=12, durata_max=24):
    return {
        'variables': {
            'prezzo_tee': {'min': prezzo_min, 'base': prezzo_base, 'max': prezzo_max},
            'quantita_mese': {'base': quantita},
            'fee_v6_pct': {'min': fee_min, 'base': fee_base, 'max': fee_max},
            'referral_type': {'text': ref_type},
            'referral_value': {'min': ref_min, 'base': ref_base, 'max': ref_max},
            'referral_imputation': {'text': ref_imputation},
            'durata_mesi': {'min': durata_min, 'max': durata_max},
        }
    }


def test_tee_referral_on_christian():
    deal = make_deal()
    snap = snapshot(
        prezzo_min=197.60, prezzo_base=222.30, prezzo_max=247.00,
        fee_min=3.0, fee_base=4.5, fee_max=6.0,
        ref_min=60000, ref_base=70000, ref_max=80000,
        ref_type='fixed', ref_imputation='christian',
    )
    res = compute_prospetto('TEE-ROLLING-001', deal, snap)
    p = res['per_participant']

    assert abs(p[1]['monthly_min'] - 197600) < 1
    assert abs(p[2]['monthly_min'] - 197600) < 1
    assert abs(p[3]['monthly_min'] - 137600) < 1
    assert abs(p[1]['monthly_base'] - 333450) < 1
    assert abs(p[3]['monthly_base'] - (333450 - 70000)) < 1
    assert abs(p[1]['monthly_max'] - 494000) < 1
    assert abs(p[3]['monthly_max'] - (494000 - 80000)) < 1


def test_tee_referral_on_all():
    deal = make_deal()
    snap = snapshot(
        prezzo_min=197.60, prezzo_base=222.30, prezzo_max=247.00,
        fee_min=3.0, fee_base=4.5, fee_max=6.0,
        ref_min=60000, ref_base=70000, ref_max=80000,
        ref_type='fixed', ref_imputation='all',
    )
    res = compute_prospetto('TEE-ROLLING-001', deal, snap)
    p = res['per_participant']

    expected_min = (592800 - 60000) / 3
    assert abs(p[1]['monthly_min'] - expected_min) < 1
    assert abs(p[2]['monthly_min'] - expected_min) < 1
    assert abs(p[3]['monthly_min'] - expected_min) < 1
    assert p[1]['monthly_min'] == p[2]['monthly_min'] == p[3]['monthly_min']


def test_tee_referral_pct():
    deal = make_deal()
    snap = snapshot(
        prezzo_min=197.60, prezzo_base=222.30, prezzo_max=247.00,
        fee_min=3.0, fee_base=4.5, fee_max=6.0,
        ref_min=2.0, ref_base=2.0, ref_max=2.0,
        ref_type='pct', ref_imputation='all',
    )
    res = compute_prospetto('TEE-ROLLING-001', deal, snap)
    p = res['per_participant']

    assert abs(p[1]['monthly_min'] - 65866.67) < 1


def test_rolling_totals():
    deal = make_deal()
    snap = snapshot(
        prezzo_min=197.60, prezzo_base=222.30, prezzo_max=247.00,
        fee_min=3.0, fee_base=4.5, fee_max=6.0,
        ref_min=60000, ref_base=70000, ref_max=80000,
        ref_type='fixed', ref_imputation='christian',
    )
    res = compute_prospetto('TEE-ROLLING-001', deal, snap)
    p = res['per_participant']
    assert abs(p[1]['rolling_12_min'] - 197600 * 12) < 1
    assert abs(p[1]['rolling_24_min'] - 197600 * 24) < 1


def test_multi_leg_aggregation():
    """Verifica aggregazione 2 leg con revenue_model='spread'."""
    class FakeLeg:
        def __init__(self, quantita, prezzo_acquisto, prezzo_vendita=0):
            self.quantita = quantita
            self.prezzo_acquisto = prezzo_acquisto
            self.prezzo_vendita = prezzo_vendita

    class FakeDealMultiLeg:
        def __init__(self, participants, legs):
            self.participant_ids = participants
            self.leg_ids = legs
            self.revenue_model = 'spread'

    FakeParticipant._counter = 0
    third = 1.0 / 3.0
    participants = [
        FakeParticipant('V6 Impresa', 'v6_entity', third),
        FakeParticipant('Enzo', 'consultant', third, login='enzo'),
        FakeParticipant('Christian Girardi', 'consultant', third,
                        login='christian.girardi', is_referral_payer=True),
    ]
    legs = [
        FakeLeg(quantita=60000, prezzo_acquisto=200),
        FakeLeg(quantita=40000, prezzo_acquisto=210),
    ]
    deal = FakeDealMultiLeg(participants, legs)

    snap = snapshot(
        prezzo_min=197.60, prezzo_base=222.30, prezzo_max=247.00,
        fee_min=3.0, fee_base=4.5, fee_max=6.0,
        ref_min=60000, ref_base=70000, ref_max=80000,
        ref_type='fixed', ref_imputation='christian',
    )
    snap['variables']['prezzo_acquisto'] = {
        'min': 0, 'base': 0, 'max': 0, 'enabled': False}

    res = compute_prospetto('TEE-ROLLING-001', deal, snap)
    sc = res['scenarios']

    # BASE: gross_vendita = 100000 * 222.30 = 22.230.000
    # gross_acquisto = 60000*200 + 40000*210 = 20.400.000
    # spread = 1.830.000
    assert abs(sc['base']['gross'] - 1_830_000) < 1
    assert abs(sc['base']['quantita'] - 100_000) < 1
    assert sc['base']['multi_leg'] is True
