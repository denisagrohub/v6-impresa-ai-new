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
    def create_validation_sessions(self, kb_records):
        """Crea e avvia una erpv6.validation.session per ciascuna KB passata.

        Mapping destinatario/scopo/context_data derivato SOLO da dati reali
        gia' presenti sul record KB (access_level, kb_type, category, content)
        -- nessun contenuto di business inventato. Vedi report per la
        motivazione, da confermare con l'utente se non convince.
        """
        Session = self.env['erpv6.validation.session']
        sessions = Session.browse()
        access_level_labels = dict(kb_records._fields['access_level'].selection) if kb_records else {}
        for kb in kb_records:
            destinatario = f"Uso interno — {access_level_labels.get(kb.access_level, kb.access_level)}"
            scopo = (
                f"Verificare accuratezza e assenza di allucinazioni nella voce KB "
                f"'{kb.name}' (tipo '{kb.kb_type}') prima di attivarla per l'uso da parte "
                f"del motore (find_best_for/erpv6.kb.engine)."
            )
            context_data = {
                'kb_id': kb.id,
                'kb_name': kb.name,
                'kb_type': kb.kb_type,
                'category': kb.category_id.name,
                'source': kb.source,
                'content': kb.content if not kb.is_encrypted else '(contenuto cifrato, non incluso)',
            }
            session = Session.create({
                'res_model': 'erpv6.kb',
                'res_id': kb.id,
                'destinatario': destinatario,
                'scopo': scopo,
                'context_data': context_data,
                'validation_mode': 'full_six_judges',
            })
            session.action_start_validation()
            sessions |= session
        return sessions
