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
            'enabled': v.enabled,
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


def _get_var(v, name, key='base', default=0.0):
    """Legge una variabile se esiste e enabled, altrimenti default."""
    var = v.get(name)
    if not var or not var.get('enabled', True):
        return default
    return var.get(key, default)


def _aggregate_legs(deal, prezzo_vendita_scenarios, quantita_deal):
    """Aggrega N leg in un dict di scenario -> {gross, quantita, ...}.
    Se non ci sono leg, ritorna None (fallback a variabili deal)."""
    if not getattr(deal, 'leg_ids', None):
        return None

    aggregated = {s: {'quantita': 0, 'gross_acquisto': 0, 'gross_vendita': 0}
                  for s in ('min', 'base', 'max')}

    for leg in deal.leg_ids:
        for s in ('min', 'base', 'max'):
            prezzo_v = leg.prezzo_vendita or prezzo_vendita_scenarios[s]
            prezzo_a = leg.prezzo_acquisto
            q = leg.quantita
            aggregated[s]['quantita'] += q
            aggregated[s]['gross_acquisto'] += prezzo_a * q
            aggregated[s]['gross_vendita'] += prezzo_v * q

    return aggregated


def _compute_tee_rolling(deal, snapshot):
    v = snapshot['variables']
    revenue_model = getattr(deal, 'revenue_model', 'fee') or 'fee'

    prezzo_vendita = v['prezzo_tee']
    quantita_deal = v['quantita_mese']['base']
    prezzo_acquisto = v.get('prezzo_acquisto', prezzo_vendita)
    fee_pct = v['fee_v6_pct']

    ref_type = v['referral_type']['text'] or 'fixed'
    ref_value = v['referral_value']
    ref_imputation = v['referral_imputation']['text'] or 'christian'
    durata_min = int(v['durata_mesi']['min'])
    durata_max = int(v['durata_mesi']['max'])

    # componenti opzionali (on/off)
    v6_entity_pct = _get_var(v, 'v6_entity_pct', 'base', 0.0)
    reserve_pct = _get_var(v, 'reserve_pct', 'base', 0.0)

    # Aggrega leg (se presenti)
    legs_agg = _aggregate_legs(deal, prezzo_vendita, quantita_deal)

    scenarios = {}
    for s in ('min', 'base', 'max'):
        if legs_agg:
            # multi-leg: usa aggregato
            prezzo_v = (legs_agg[s]['gross_vendita'] / legs_agg[s]['quantita']
                        if legs_agg[s]['quantita'] else 0)
            prezzo_a = (legs_agg[s]['gross_acquisto'] / legs_agg[s]['quantita']
                        if legs_agg[s]['quantita'] else 0)
            quantita = legs_agg[s]['quantita']
            gross_vendita = legs_agg[s]['gross_vendita']
            gross_acquisto = legs_agg[s]['gross_acquisto']
        else:
            prezzo_v = prezzo_vendita[s]
            prezzo_a = prezzo_acquisto[s] if isinstance(prezzo_acquisto, dict) else prezzo_v
            quantita = quantita_deal
            gross_vendita = prezzo_v * quantita
            gross_acquisto = prezzo_a * quantita

        if revenue_model == 'spread':
            gross = gross_vendita - gross_acquisto
        elif revenue_model == 'mixed':
            spread = gross_vendita - gross_acquisto
            fee_extra = gross_vendita * (fee_pct[s] / 100.0)
            gross = spread + fee_extra
        else:  # 'fee'
            gross = gross_vendita * (fee_pct[s] / 100.0)

        # componenti opzionali
        v6_entity = gross * (v6_entity_pct / 100.0) if v6_entity_pct else 0.0
        reserve = gross * (reserve_pct / 100.0) if reserve_pct else 0.0
        pool_before_ref = gross - v6_entity - reserve

        # referral
        if ref_type == 'fixed':
            ref_mese = ref_value[s]
        else:
            ref_mese = gross_vendita * (ref_value[s] / 100.0)

        if ref_imputation == 'all':
            pool = pool_before_ref - ref_mese
        else:
            pool = pool_before_ref

        scenarios[s] = {
            'gross': gross,
            'gross_vendita': gross_vendita,
            'gross_acquisto': gross_acquisto,
            'quantita': quantita,
            'v6_entity': v6_entity,
            'reserve': reserve,
            'referral': ref_mese,
            'pool_consulenti': pool,
            'referral_imputation': ref_imputation,
            'revenue_model': revenue_model,
            'multi_leg': bool(legs_agg),
        }

    per_participant = {}
    for p in deal.participant_ids:
        share = p.share_pct or 0.0
        entry = {}
        for s in ('min', 'base', 'max'):
            if p.role == 'referral':
                # Il referral percepisce il valore lordo del referral
                # (ripartito su più referral via share_pct, se necessario)
                quota = scenarios[s]['referral'] * share
            else:
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
