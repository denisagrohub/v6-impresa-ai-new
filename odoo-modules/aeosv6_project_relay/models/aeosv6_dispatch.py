import re
from email.utils import getaddresses, parseaddr

from odoo import _
from odoo.exceptions import UserError

from odoo.addons.erpv6_core_dispatch.registry import register_process

# Estrae ogni local-part@v6sviluppoimpresa.it presente in To/Cc, senza
# assumere nessuna convenzione di prefisso (Denis, 04/09/2026: il primo
# progetto usa "progetto-tee-*", un secondo -- es. investitori -- userebbe
# un prefisso diverso sullo stesso catch-all/stessa casella IMAP). Il
# riconoscimento vero non e' il prefisso: e' se quel local-part esiste come
# email_alias su un nodo erpv6.tracking.relation -- whitelist nel dato, non
# nel codice.
DOMAIN_EMAIL_RE = re.compile(r'([a-z0-9][a-z0-9._+\-]*)@v6sviluppoimpresa\.it', re.IGNORECASE)


def _run_route_project_email(env, node, input_data):
    """Motore IPO 'route_project_email' (Denis, 04/09/2026, esteso
    05/09/2026 per l'hub email di progetto). Da questa data il pattern
    d'uso e' un alias unico per PROGETTO (nodo padre, es.
    progetto-tee@v6sviluppoimpresa.it) in cc su corrispondenza tra parti
    esterne che si scrivono sulle loro email personali -- l'alias dice
    SOLO a quale progetto appartiene lo scambio, non chi ha scritto. Chi
    ha scritto si riconosce dal mittente (header From) confrontato con
    partner_id.email dei nodi figlio di quel progetto: se combacia,
    relation_id punta al nodo figlio (la parte specifica), altrimenti
    resta sul nodo progetto stesso (mittente sconosciuto o sei tu).
    Restano supportati anche alias diretti su un nodo figlio (pattern
    precedente 'progetto-tee-nomeparte'), che bypassano il passo di
    riconoscimento mittente perche' gia' univoci.

    Esteso lo stesso giorno con il riconoscimento del DESTINATARIO: tra
    gli indirizzi in To/Cc (oltre all'alias di progetto stesso) si cerca
    un'altra parte collegata allo stesso progetto (diversa da quella gia'
    riconosciuta come mittente) il cui partner_id.email compaia --
    risponde a "a chi ha scritto", non solo "chi ha scritto". Se non
    trovata resta False, non e' un errore (es. il mittente scrive solo al
    progetto, senza mettere in To/Cc l'altra parte).

    Input: {'to': str (header To grezzo, obbligatorio), 'cc': str
    opzionale, 'from': str opzionale (header From grezzo)}. Output:
    {'match_status', 'matched_alias', 'relation_id' (int o False, la
    parte mittente o il progetto), 'recipient_relation_id' (int o False,
    l'altra parte destinataria riconosciuta, se presente)}."""
    to_field = input_data.get('to')
    if not to_field:
        raise UserError(_("Input mancante: 'to' (intestazione destinatari dell'email)."))
    cc_field = input_data.get('cc') or ''
    from_field = input_data.get('from') or ''

    candidates = [m.group(1).lower() for m in DOMAIN_EMAIL_RE.finditer(f'{to_field} {cc_field}')]

    Relation = env['erpv6.tracking.relation']
    project = Relation
    matched_alias = False
    for alias in candidates:
        project = Relation.search([('email_alias', '=', alias)], limit=1)
        if project:
            matched_alias = alias
            break

    if not project:
        if candidates:
            return {'match_status': 'alias_riconosciuto_nodo_mancante', 'matched_alias': candidates[0],
                    'relation_id': False, 'recipient_relation_id': False}
        return {'match_status': 'non_pattern_tee', 'matched_alias': False,
                'relation_id': False, 'recipient_relation_id': False}

    children = project.child_ids
    relation = project
    sender_email = parseaddr(from_field)[1].strip().lower() if from_field else ''
    if sender_email and children:
        sender_match = children.filtered(
            lambda c: c.partner_id.email and c.partner_id.email.strip().lower() == sender_email
        )
        if sender_match:
            relation = sender_match[0]

    recipient_relation = Relation
    if children:
        recipient_addrs = {addr.strip().lower() for _, addr in getaddresses([to_field, cc_field]) if addr}
        recipient_match = children.filtered(
            lambda c: c.id != relation.id and c.partner_id.email
            and c.partner_id.email.strip().lower() in recipient_addrs
        )
        if recipient_match:
            recipient_relation = recipient_match[0]

    return {
        'match_status': 'matched',
        'matched_alias': matched_alias,
        'relation_id': relation.id,
        'recipient_relation_id': recipient_relation.id if recipient_relation else False,
    }


def _run_create_project_node(env, node, input_data):
    """Motore IPO 'create_project_node' (Denis, 04/09/2026): crea DAVVERO
    un nodo erpv6.tracking.relation (progetto padre o parte collegata
    figlia) -- non reimplementa nulla, avvolge Relation.create() gia'
    esistente e verificata (Fase 1). Usato sia dal wizard "Nuovo Progetto"
    sia riusabile da qualunque altro chiamante futuro (API, altro
    circuito). Input: {'name': str (obbligatorio), 'parent_id': int
    opzionale, 'partner_id': int opzionale, 'email_alias': str opzionale,
    'ruolo'/'posta_in_gioco'/'mandato': str opzionali, 'richiede_nda': bool
    opzionale}. Output: {'success', 'relation_id', 'name'}."""
    name = input_data.get('name')
    if not name:
        raise UserError(_("Input mancante: 'name' (nome del nodo progetto/parte)."))

    vals = {'name': name}
    for key in ('parent_id', 'partner_id'):
        if input_data.get(key):
            vals[key] = int(input_data[key])
    for key in ('email_alias', 'ruolo', 'posta_in_gioco', 'mandato'):
        if input_data.get(key):
            vals[key] = input_data[key]
    if 'richiede_nda' in input_data:
        vals['richiede_nda'] = bool(input_data['richiede_nda'])

    relation = env['erpv6.tracking.relation'].create(vals)
    return {'success': True, 'relation_id': relation.id, 'name': relation.name}


register_process(
    'route_project_email',
    '[IPO] Instrada email in ingresso verso il nodo progetto (alias v6sviluppoimpresa.it)',
    'ipo', _run_route_project_email,
)
register_process(
    'create_project_node',
    '[IPO] Crea nodo erpv6.tracking.relation (progetto o parte collegata)',
    'ipo', _run_create_project_node,
)
