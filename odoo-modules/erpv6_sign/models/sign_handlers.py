from odoo import fields
"""23/09/2026: handler del post-firma per tipo documento.

Quando Documenso invia il webhook DOCUMENT_COMPLETED, il controller
chiama `dispatch_post_sign_handler(sign_request)` che legge
`related_kind` e applica l'azione corrispondente.

Per aggiungere un tipo firma nuovo: aggiungi un ramo in
`dispatch_post_sign_handler` + il relativo `_handle_<kind>`.
Zero modifiche al controller webhook.
"""
import logging

_logger = logging.getLogger(__name__)




def _handle_contract_draft(sign_request):
    """26/09/2026: handler per firme su erpv6.contract.draft.
    - Se firma controparte: salva hash firmato, verifica integrità,
      poi se v6_sign_order='second' crea sign request V6 (controfirma).
    - Se firma V6: marca contratto come fully signed.
    """
    import base64
    import hashlib
    draft = sign_request.contract_draft_id
    if not draft:
        _notify_admin(sign_request)
        return

    # Salva hash del PDF firmato
    signed_hash = None
    if sign_request.signed_document:
        try:
            signed_pdf = base64.b64decode(sign_request.signed_document)
            signed_hash = hashlib.sha256(signed_pdf).hexdigest()
        except Exception:
            _logger.exception('Hash PDF firmato fallito')

    v6_partner = draft.v6_signer_id.partner_id if draft.v6_signer_id else None
    is_v6_signing = v6_partner and sign_request.partner_id.id == v6_partner.id

    if is_v6_signing:
        # V6 ha firmato: chiudi il contratto
        draft.write({
            'v6_signed_pdf_hash': signed_hash,
            'state': 'signed',
        })
        draft.message_post(body=f"Contratto firmato da V6. Hash: {signed_hash[:16] if signed_hash else '-'}...")
        _logger.info('Contratto %s: V6 ha firmato, stato=signed', draft.id)
    else:
        # Controparte ha firmato
        draft.write({
            'counterparty_signed_pdf_hash': signed_hash,
        })
        draft.message_post(body=f"Controparte ha firmato. Hash: {signed_hash[:16] if signed_hash else '-'}...")

        # Verifica integrità
        try:
            integrity = draft.action_verify_integrity()
            if not integrity.get('match'):
                _logger.warning('Contratto %s: INTEGRITÀ FALLITA dopo firma controparte!', draft.id)
        except Exception:
            _logger.exception('Verifica integrità fallita')

        # Se ordine=second, ora crea sign request V6 per controfirma
        if draft.v6_sign_order == 'second' and draft.needs_v6_signature and draft.v6_signer_id:
            try:
                Sign = draft.env['erpv6.sign.request'].sudo()
                sr = Sign.create({
                    'name': draft.name,
                    'partner_id': draft.v6_signer_id.partner_id.id,
                    'document_id': draft.document_id.id,
                    'contract_draft_id': draft.id,
                    'related_kind': draft._get_related_kind(),
                    'related_id': draft.id,
                    'related_model': 'erpv6.contract.draft',
                    'notes': f'Controfirma V6 (controparte ha firmato)',
                })
                sr.action_send_to_sign()
                draft.write({'v6_sign_request_id': sr.id})
                _logger.info('Contratto %s: creato sign request V6 %s per controfirma', draft.id, sr.id)
            except Exception:
                _logger.exception('Creazione sign request V6 fallita')

    _notify_admin(sign_request)



def dispatch_post_sign_handler(sign_request):
    """Entry point unico chiamato dal webhook dopo la firma."""
    # 26/09/2026: se c'è contract_draft_id, usa handler dedicato
    if sign_request.contract_draft_id:
        try:
            _handle_contract_draft(sign_request)
        except Exception:
            _logger.exception('Handler contract_draft fallito per sr %s', sign_request.id)
        return

    kind = sign_request.related_kind or 'altro'
    handler = {
        'split_v6': _handle_split_v6,
        'referral': _handle_referral,
        'nda': _handle_generic,
        'ncnd': _handle_generic,
        'contratto': _handle_generic,
        'altro': _handle_generic,
    }.get(kind, _handle_generic)
    try:
        handler(sign_request)
    except Exception:
        _logger.exception('Handler post-firma fallito per sign_request %s (kind=%s)',
                          sign_request.id, kind)


def _handle_split_v6(sign_request):
    """25/09/2026: finalizza lo split SOLO quando TUTTI i consulenti
    beneficiari hanno firmato. Prima finalizzava se c'era <=1 consulente,
    ma con 2+ consulenti finalizzava al PRIMO firmatario (bug trovato
    durante test Martina/Christian)."""
    if not sign_request.split_project_id:
        return
    project = sign_request.split_project_id
    partner = sign_request.partner_id

    # 1. Registra accettazione del firmatario corrente
    project.write({
        'revenue_split_accepted_at': sign_request.signed_at or fields.Datetime.now(),
        'revenue_split_accepted_by': partner.user_ids[0].id if partner.user_ids else False,
    })

    # 2. Conta consulenti attesi dallo split
    try:
        import json as _json
        split = _json.loads(project.x_v6_revenue_split or '{}')
        consulenti = [b for b in (split.get('beneficiari') or [])
                      if b.get('tipo') == 'consulente']
        partner_attesi = {b.get('res_partner_id') for b in consulenti
                          if b.get('res_partner_id')}

        if not partner_attesi:
            _logger.warning('Split %s: nessun consulente nello split', project.id)
            _notify_admin(sign_request, project=project)
            return

        # 3. Chi ha firmato? (tutti i sign request signed sul progetto)
        srs_firmati = sign_request.env['erpv6.sign.request'].search([
            ('split_project_id', '=', project.id),
            ('status', '=', 'signed'),
        ])
        partner_firmati = {sr.partner_id.id for sr in srs_firmati if sr.partner_id}
        mancanti = partner_attesi - partner_firmati

        _logger.info(
            'Split %s | attesi=%s | firmati=%s | mancanti=%s',
            project.id, partner_attesi, partner_firmati, mancanti,
        )

        if mancanti:
            # Aspetta gli altri - NON finalizzare
            _logger.info(
                'Split %s: in attesa firma da partner %s',
                project.id, list(mancanti),
            )
        else:
            # Tutti hanno firmato -> finalizza
            project.action_finalize_split()
            _logger.info(
                'Split %s: FINALIZZATO (tutti i %s consulenti hanno firmato)',
                project.id, len(partner_attesi),
            )
    except Exception:
        _logger.exception('Finalizzazione split fallita per progetto %s', project.id)

    # notifica admin (email + in-app)
    _notify_admin(sign_request, project=project)


def _handle_referral(sign_request):
    """Referral: il contratto/wizard esistente gia' gestisce il post-firma.
    Qui aggiungiamo solo la notifica admin per uniformita'."""
    _notify_admin(sign_request)


def _handle_generic(sign_request):
    """Handler di default per NDA/NCND/contratto/altro."""
    _notify_admin(sign_request)


def _notify_admin(sign_request, project=None):
    """Email a Denis quando un documento e' firmato.

    24/09/2026: usa send_system_mail (stesso helper delle altre email
    sistema) invece di message_notify, che decideva in-app/email in base
    alle preferenze partner e andava su base.user_admin (method@...).
    """
    from odoo.addons.erpv6_referral.models.system_mail_helper import (
        send_system_mail, get_admin_email,
    )
    admin_email = get_admin_email(sign_request.env)
    if not admin_email:
        _logger.warning('Nessuna email admin configurata, skip notifica firma')
        return

    partner = sign_request.partner_id
    doc_type_label = dict(sign_request._fields['related_kind'].selection).get(
        sign_request.related_kind or 'altro', 'Documento')

    project_txt = f' — Progetto: {project.name}' if project else ''
    subject = f'[Firmato] {doc_type_label} da {partner.name}{project_txt}'
    body = (
        f'<p><b>{partner.name}</b> ha firmato digitalmente:</p>'
        f'<p>• <b>Documento:</b> {sign_request.name}</p>'
        f'<p>• <b>Tipo:</b> {doc_type_label}</p>'
        f'<p>• <b>Data firma:</b> {sign_request.signed_at or "ora"}</p>'
    )
    if project:
        body += (
            f'<p>• <b>Progetto:</b> {project.name}</p>'
            f'<p style="margin-top:1em;">'
            f'<a href="https://www.v6impresa.it/admin/partner-projects/{project.id}" '
            f'style="background:#0f172a;color:white;padding:6px 12px;'
            f'border-radius:4px;text-decoration:none;">'
            f'Apri progetto</a></p>'
        )
    send_system_mail(
        sign_request.env,
        admin_email,
        subject,
        body,
        model='erpv6.sign.request',
        res_id=sign_request.id,
    )
