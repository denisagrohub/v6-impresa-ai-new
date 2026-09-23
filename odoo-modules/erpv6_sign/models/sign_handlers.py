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


def dispatch_post_sign_handler(sign_request):
    """Entry point unico chiamato dal webhook dopo la firma."""
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
    """Aggiorna il progetto: split accettato + approvato + notifica admin."""
    if not sign_request.split_project_id:
        return
    project = sign_request.split_project_id
    partner = sign_request.partner_id
    # conferma accettazione definitiva
    project.write({
        'revenue_split_accepted_at': sign_request.signed_at or __import__('odoo').fields.Datetime.now(),
        'revenue_split_accepted_by': partner.user_ids[0].id if partner.user_ids else False,
    })
    # se unico consulente o tutti hanno firmato -> approva
    try:
        import json as _json
        split = _json.loads(project.x_v6_revenue_split or '{}')
        consulenti = [b for b in (split.get('beneficiari') or []) if b.get('tipo') == 'consulente']
        if len(consulenti) <= 1:
            project.action_approve_revenue_split()
    except Exception:
        _logger.exception('Auto-approvazione split fallita per progetto %s', project.id)

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
    """Email + notifica in-app a Denis quando un documento e' firmato."""
    admin_user = sign_request.env.ref('base.user_admin', raise_if_not_found=False)
    if not admin_user:
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
        body += f'<p>• <b>Progetto:</b> {project.name}</p>'
    body += (
        f'<p style="margin-top:1em;">'
        f'<a href="/web#id={sign_request.id}&model=erpv6.sign.request&view_type=form" '
        f'style="background:#0f172a;color:white;padding:6px 12px;border-radius:4px;text-decoration:none;">'
        f'Apri richiesta firma</a></p>'
    )
    try:
        sign_request.message_notify(
            partner_ids=[admin_user.partner_id.id],
            subject=subject,
            body=body,
        )
    except Exception:
        _logger.exception('Notifica firma ad admin fallita')
