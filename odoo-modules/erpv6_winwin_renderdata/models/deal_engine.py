# -*- coding: utf-8 -*-
import json


def build_snapshot(deal):
    variables = {}
    for v in deal.variable_ids:
        variables[v.name] = {
            'min': v.value_min,
            'base': v.value_base,
            'max': v.value_max,
            'text': v.value_text,
            'unit': v.unit,
            'source': v.source,
            'locked': v.locked,
            'locked_at': v.locked_at.isoformat() if v.locked_at else None,
        }
    return {
        'deal_id': deal.id,
        'deal_name': deal.name,
        'schema_code': deal.schema_code,
        'schema_version': deal.schema_version,
        'buyer': deal.buyer_id.display_name if deal.buyer_id else None,
        'buyer_placeholder': deal.buyer_id.placeholder_code if deal.buyer_id else None,
        'seller': deal.seller_id.display_name if deal.seller_id else None,
        'seller_placeholder': deal.seller_id.placeholder_code if deal.seller_id else None,
        'variables': variables,
        'participants': [
            {
                'id': p.id,
                'name': p.partner_id.display_name,
                'role': p.role,
                'share_pct': p.share_pct,
            }
            for p in deal.participant_ids
        ],
    }


def compute_prospetto(schema_code, deal, snapshot):
    if schema_code == 'TEE-ROLLING-001':
        return _compute_tee_rolling(deal, snapshot)
    raise NotImplementedError("Schema non implementato: %s" % schema_code)


def _compute_tee_rolling(deal, snapshot):
    v = snapshot['variables']

    prezzo = v['prezzo_tee']
    quantita = v['quantita_mese']['base']
    fee_pct = v['fee_v6_pct']
    ref_type = v['referral_type']['text'] or 'fixed'
    ref_value = v['referral_value']
    ref_imputation = v['referral_imputation']['text'] or 'christian'
    durata_min = int(v['durata_mesi']['min'])
    durata_max = int(v['durata_mesi']['max'])

    scenarios = {}
    for s in ('min', 'base', 'max'):
        transato = prezzo[s] * quantita
        fee_v6 = transato * (fee_pct[s] / 100.0)

        if ref_type == 'fixed':
            ref_mese = ref_value[s]
        else:
            ref_mese = transato * (ref_value[s] / 100.0)

        if ref_imputation == 'all':
            pool = fee_v6 - ref_mese
        else:
            pool = fee_v6

        scenarios[s] = {
            'transato': transato,
            'fee_v6': fee_v6,
            'referral': ref_mese,
            'pool_consulenti': pool,
            'referral_imputation': ref_imputation,
        }

    per_participant = {}
    for p in deal.participant_ids:
        share = p.share_pct or 0.0
        entry = {}
        for s in ('min', 'base', 'max'):
            quota = scenarios[s]['pool_consulenti'] * share
            if (scenarios[s]['referral_imputation'] == 'christian'
                    and getattr(p, 'is_referral_payer', False)):
                quota -= scenarios[s]['referral']
            entry['monthly_%s' % s] = round(quota, 2)
            entry['rolling_%s_%s' % (durata_min, s)] = round(quota * durata_min, 2)
            entry['rolling_%s_%s' % (durata_max, s)] = round(quota * durata_max, 2)
        per_participant[p.id] = entry

    result = {'scenarios': scenarios, 'per_participant': {}}
    for pid, e in per_participant.items():
        result['per_participant'][pid] = {
            'monthly_min': e.get('monthly_min', 0),
            'monthly_base': e.get('monthly_base', 0),
            'monthly_max': e.get('monthly_max', 0),
            'rolling_12_min': e.get('rolling_12_min', 0),
            'rolling_12_base': e.get('rolling_12_base', 0),
            'rolling_12_max': e.get('rolling_12_max', 0),
            'rolling_24_min': e.get('rolling_24_min', 0),
            'rolling_24_base': e.get('rolling_24_base', 0),
            'rolling_24_max': e.get('rolling_24_max', 0),
        }
    return result
