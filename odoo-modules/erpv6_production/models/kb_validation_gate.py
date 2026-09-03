from odoo import api, models


class Erpv6KbValidationGate(models.AbstractModel):
    """Collega erpv6.kb (creata inattiva da erpv6.kb.extraction.service,
    in erpv6_omni_bridge) a erpv6_validation (6 Giudici) prima che possa
    diventare attiva/raggiungibile da find_best_for().

    Vive qui (non in erpv6_omni_bridge, ne' in erpv6_kb) perche' e' l'unico
    modulo che dipende sia da erpv6_omni_bridge sia da erpv6_validation senza
    creare un ciclo (erpv6_validation -> erpv6_omni_bridge -> erpv6_kb).
    La riattivazione all'approvazione vive in validation_session.py
    (stesso file che gia' fa questo dispatch per erpv6.production.order).
    """
    _name = 'erpv6.kb.validation.gate'
    _description = 'Gate di Validazione per Voci KB Estratte'

    @api.model
    def create_validation_sessions(self, kb_records, max_rounds=None):
        """Crea e avvia una erpv6.validation.session per ciascuna KB passata.

        Mapping destinatario/scopo/context_data derivato SOLO da dati reali
        gia' presenti sul record KB (access_level, kb_type, category, content)
        -- nessun contenuto di business inventato. Vedi report per la
        motivazione, da confermare con l'utente se non convince.

        max_rounds (opzionale, 29/08/2026): se valorizzato sovrascrive il
        default (5) di erpv6.validation.session PRIMA di avviare la
        validazione -- permette al chiamante (erpv6_core_engine, dal valore
        impostato sull'arco di loop nel grafo) di pilotare davvero quante
        volte il round puo' ripetersi, non solo descriverlo nel disegno.
        None = comportamento identico a prima di questo parametro.
        """
        Session = self.env['erpv6.validation.session']
        KbModel = self.env['erpv6.kb']
        sessions = Session.browse()
        access_level_labels = dict(kb_records._fields['access_level'].selection) if kb_records else {}
        for kb in kb_records:
            destinatario = f"Uso interno — {access_level_labels.get(kb.access_level, kb.access_level)}"
            scopo = (
                f"Verificare accuratezza e assenza di allucinazioni nella voce KB "
                f"'{kb.name}' (tipo '{kb.kb_type}') prima di attivarla per l'uso da parte "
                f"del motore (find_best_for/erpv6.kb.engine)."
            )
            # Per la lente #4 (Analista 4, "coerenza con la KB gia' attiva"):
            # voci gia' attive nella stessa categoria, escludendo se stessa.
            # Limitate a 5 e al contenuto troncato per non gonfiare il
            # context_data con testo che l'analista non ha bisogno di leggere
            # per intero per rilevare una contraddizione palese.
            related_active_kb_entries = []
            if kb.category_id:
                related = KbModel.search([
                    ('category_id', '=', kb.category_id.id),
                    ('is_active', '=', True),
                    ('id', '!=', kb.id),
                ], limit=5)
                for r in related:
                    related_active_kb_entries.append({
                        'kb_id': r.id,
                        'kb_name': r.name,
                        'content': (r.content[:1000] if r.content and not r.is_encrypted else '(contenuto cifrato o assente)'),
                    })
            context_data = {
                'kb_id': kb.id,
                'kb_name': kb.name,
                'kb_type': kb.kb_type,
                'category': kb.category_id.name,
                'source': kb.source,
                'content': kb.content if not kb.is_encrypted else '(contenuto cifrato, non incluso)',
                'related_active_kb_entries': related_active_kb_entries,
                # Fase 1C.2 knowledge graph (vedi docs/PLAN_knowledge_graph_phase1.md):
                # triple gia' filtrate sul vocabolario controllato al momento
                # dell'estrazione (kb_extraction_service.py, ALLOWED_TRIPLE_SHAPES) --
                # passate ai Giudici solo come contesto in piu' per la lente di
                # accuratezza, non validate qui una seconda volta ne' scritte
                # da nessuna parte come nodi/archi reali.
                'extracted_triples': kb.extracted_triples or [],
            }
            session_vals = {
                'res_model': 'erpv6.kb',
                'res_id': kb.id,
                'destinatario': destinatario,
                'scopo': scopo,
                'context_data': context_data,
                'validation_mode': 'full_six_judges',
            }
            if max_rounds is not None:
                session_vals['max_rounds'] = max_rounds
            session = Session.create(session_vals)
            session.action_start_validation()
            sessions |= session
        return sessions
