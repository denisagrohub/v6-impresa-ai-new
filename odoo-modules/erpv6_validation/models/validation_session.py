# -*- coding: utf-8 -*-

import logging

from odoo import models, fields, api, _
from odoo.exceptions import UserError
import hashlib
import json

_logger = logging.getLogger(__name__)

# _cron_retry_escalated_ai_failures: quante volte ritentare automaticamente
# una sessione escalata per un fallimento TECNICO (non di contenuto) prima di
# lasciarla comunque in escalation per intervento umano, e di quanti round
# estendere il budget (max_rounds) a ogni tentativo.
VALIDATION_MAX_AI_FAILURE_RETRIES = 5
VALIDATION_EXTRA_ROUNDS_PER_RETRY = 3

# Template di default per i prompt (usati se nessun override, es. erpv6_production
# che li legge da una voce erpv6.kb kb_type='prompt', li fornisce -- vedi
# _get_analyst_prompt_template/_get_sesto_uomo_prompt_template sotto). Placeholder
# .format(): {destinatario} {scopo} {context_json} per l'analista;
# {destinatario} {scopo} {analysis_findings} {previous_round_corrections} per il
# sesto uomo. Le graffe doppie {{ }} sono letterali (escaping .format()), producono
# l'esempio JSON nel testo finale.
DEFAULT_ANALYST_PROMPT_TEMPLATE = """Prima di analizzare qualsiasi cosa, tieni sempre presente:
Destinatario finale: {destinatario}.
Scopo concreto derivato dal destinatario: {scopo}.
Dati reali disponibili: {context_json}.

REGOLA VINCOLANTE ANTI-ALLUCINAZIONE: non inventare MAI un dato, una cifra, un fatto non presente nei dati disponibili.
Se un'informazione necessaria manca, elencala esplicitamente in flagged_missing_data invece di stimarla o inventarla.
Per ogni affermazione che fai, verifica se è supportata dalla fonte originale e dal documento fornito, riportando il risultato in claims_checked.
Il tuo obiettivo è produrre la migliore analisi possibile per raggiungere lo scopo rispetto al destinatario, restando ancorato solo a dati verificabili.

Rispondi SOLO con un oggetto JSON valido (senza markdown code fence, senza altro testo) con questi campi esatti:
{{"findings": "testo della tua analisi", "claims_checked": [{{"claim": "...", "source_verified": true, "document_verified": true, "note": "..."}}], "flagged_missing_data": "testo, vuoto se nessun dato manca"}}"""

DEFAULT_SESTO_UOMO_PROMPT_TEMPLATE = """Confronta le analisi ricevute sullo stesso materiale (stesso destinatario: {destinatario}, stesso scopo: {scopo}).
Analisi degli analisti: {analysis_findings}
{previous_round_corrections}

Per ogni discrepanza tra le analisi: se un'affermazione non è supportata dai dati reali disponibili (possibile allucinazione), segnalala e correggila.
Se le analisi divergono su un punto, determina quale versione è meglio ancorata ai dati reali e quale meglio serve lo scopo rispetto al destinatario.

Rispondi SOLO con un oggetto JSON valido (senza markdown code fence, senza altro testo) con questi campi esatti:
{{"issues_found": 0, "summary": "riepilogo testuale", "corrected_material": {{}}, "claims_checked": [], "flagged_missing_data": ""}}
Se issues_found è 0 il processo converge. Se maggiore di 0, popola corrected_material con il materiale corretto, che verrà ridistribuito per un nuovo round di analisi."""


class Erpv6ValidationSession(models.Model):
    _name = 'erpv6.validation.session'
    _description = 'Sessione di Validazione 6 Giudici'
    _inherit = ['mail.thread']

    res_model = fields.Char(string='Modello', required=True)
    res_id = fields.Integer(string='ID Record', required=True)
    destinatario = fields.Char(string='Destinatario', required=True, help='A chi è rivolto il contenuto finale')
    scopo = fields.Text(string='Scopo', required=True, help='Scopo concreto derivato dal destinatario')
    context_data = fields.Json(string='Dati Contesto', required=True, help='Dati reali disponibili su cui ancorare l\'analisi')
    
    validation_mode = fields.Selection([
        ('sesto_only', 'Solo Sesto Uomo'),
        ('full_six_judges', '5 Analisti + Sesto Uomo')
    ], string='Modalità Validazione', required=True, default='full_six_judges')
    
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('in_validation', 'In Validazione'),
        ('converged', 'Convergenza Raggiunta'),
        ('escalated_to_human', 'Escalation Umana - Non Convergente'),
        ('human_reviewed', 'Revisionato'),
        ('approved', 'Approvato'),
        ('rejected', 'Rifiutato')
    ], string='Stato', default='draft', tracking=True)
    
    max_rounds = fields.Integer(string='Round Massimi', default=5)
    round_ids = fields.One2many('erpv6.validation.round', 'session_id', string='Round')
    current_round_number = fields.Integer(string='Round Corrente', compute='_compute_current_round', store=True)
    
    human_reviewer_id = fields.Many2one('res.users', string='Revisore Umano')
    human_reviewed_at = fields.Datetime(string='Revisionato il')
    human_notes = fields.Text(string='Note Revisore')

    # Contatore dei soli tentativi lanciati dal cron
    # (_cron_retry_escalated_ai_failures), non dei round normali -- oltre
    # VALIDATION_MAX_AI_FAILURE_RETRIES il cron smette e la sessione resta
    # in escalation per intervento umano davvero (non solo tecnico).
    ai_failure_retry_count = fields.Integer(string='Tentativi automatici di retry (fallimento AI)', default=0)

    @api.depends('round_ids')
    def _compute_current_round(self):
        for session in self:
            session.current_round_number = len(session.round_ids)

    @api.model
    def _cron_retry_escalated_ai_failures(self):
        """Rimette in coda automaticamente le sessioni finite in escalation
        SOLO per un fallimento tecnico delle chiamate AI (vedi
        erpv6.validation.round.is_ai_failure), mai per un disaccordo di
        contenuto genuino tra i giudici -- quella resta sempre e solo
        umana (action_human_approve/action_human_reject), l'automazione qui
        riguarda esclusivamente "la chiamata non e' partita", non "il
        contenuto e' controverso". Estende max_rounds per dare spazio a
        nuovi round invece di azzerare lo storico esistente (audit trail
        completo, coerente col principio gia' seguito per l'estrazione KB
        -- vedi library_document.py/_cron_retry_kb_extraction_failures)."""
        sessions = self.search([
            ('status', '=', 'escalated_to_human'),
            ('ai_failure_retry_count', '<', VALIDATION_MAX_AI_FAILURE_RETRIES),
        ])
        for session in sessions:
            last_round = session.round_ids[-1] if session.round_ids else None
            if not last_round or not last_round.is_ai_failure:
                continue
            session.ai_failure_retry_count += 1
            session.max_rounds += VALIDATION_EXTRA_ROUNDS_PER_RETRY
            session.status = 'in_validation'
            _logger.info(
                "Cron retry validazione: sessione #%s, tentativo automatico %d/%d",
                session.id, session.ai_failure_retry_count, VALIDATION_MAX_AI_FAILURE_RETRIES)
            session._run_round()

    def action_start_validation(self):
        """Avvia il primo round di validazione"""
        for session in self:
            if session.status != 'draft':
                raise UserError(_('Puoi avviare solo sessioni in stato Bozza'))
            session.status = 'in_validation'
            session._run_round()

    def _get_analyst_prompt_template(self):
        """Ritorna (template, riferimento_tracciabile) -- placeholder .format()
        nel template: destinatario, scopo, context_json. Hook riscrivibile:
        erpv6_production lo sovrascrive per leggere il prompt da una voce
        erpv6.kb (kb_type='prompt') invece del default hardcoded qui, e
        ritornare un riferimento tipo "KB #<id> - <nome>" (tracciato sul round
        e riportato nel certificato) -- questo modulo (motore generico) non
        dipende da erpv6_kb, quindi non puo' leggerla direttamente."""
        return DEFAULT_ANALYST_PROMPT_TEMPLATE, 'default motore (nessuna voce KB)'

    def _get_sesto_uomo_prompt_template(self):
        """Come sopra, per il prompt del Sesto Uomo (placeholder: destinatario,
        scopo, analysis_findings, previous_round_corrections)."""
        return DEFAULT_SESTO_UOMO_PROMPT_TEMPLATE, 'default motore (nessuna voce KB)'

    def _parse_ai_json_response(self, result):
        """Estrae il contenuto JSON della risposta AI (choices[0].message.content).
        Ritorna (dict_parsato, error_text) -- error_text vuoto solo se la chiamata
        e' riuscita E il contenuto e' un JSON valido. MAI silenziosamente
        trattare un fallimento come "nessun problema trovato": e' esattamente il
        tipo di esito fabbricato che la regola anti-allucinazione del progetto
        vieta -- il chiamante decide come reagire a error_text non vuoto (qui:
        forzare un problema residuo, mai una falsa convergenza)."""
        if not result.get('success'):
            return {}, result.get('error') or 'chiamata AI fallita (nessun dettaglio)'
        try:
            content = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            return {}, 'risposta AI in formato inatteso (non una chat completion standard)'
        content = (content or '').strip()
        if content.startswith('```'):
            content = content.strip('`')
            if content.lower().startswith('json'):
                content = content[4:]
            content = content.strip()
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as e:
            return {}, f'risposta AI non in JSON valido: {e}'
        if not isinstance(parsed, dict):
            return {}, "risposta AI non e' un oggetto JSON"
        return parsed, ''

    def _run_round(self):
        """Esegue un round di validazione"""
        for session in self:
            round_number = len(session.round_ids) + 1

            if round_number > session.max_rounds:
                session.status = 'escalated_to_human'
                continue

            # Crea il round
            round_vals = {
                'session_id': session.id,
                'round_number': round_number,
            }
            validation_round = self.env['erpv6.validation.round'].create(round_vals)

            # Determina quali analisti eseguire
            analyst_indices = []
            if session.validation_mode == 'full_six_judges':
                analyst_indices = ['1', '2', '3', '4', '5']
            analyst_indices.append('sesto')

            # Prepara i dati per i prompt
            context_json = json.dumps(session.context_data, ensure_ascii=False)
            analyst_template, analyst_prompt_ref = session._get_analyst_prompt_template()
            validation_round.analyst_prompt_ref = analyst_prompt_ref

            # Esegui analisi per ogni analista (1-5 o solo sesto)
            analysis_findings = []
            for analyst_idx in analyst_indices[:-1]:  # Tutti tranne il sesto
                prompt_analista = analyst_template.format(
                    destinatario=session.destinatario,
                    scopo=session.scopo,
                    context_json=context_json,
                )

                result = self.env['erpv6.omni.bridge'].execute_ai_task(
                    task_type='validation_analyst',
                    prompt=prompt_analista,
                    context={'analyst_index': analyst_idx}
                )
                parsed, error = session._parse_ai_json_response(result)
                if error:
                    _logger.warning(
                        "Analista %s (sessione #%s, round %d) fallito: %s",
                        analyst_idx, session.id, round_number, error)
                findings = parsed.get('findings', '') if not error else _("[ERRORE ANALISI: %s]") % error

                # Crea il record di analisi
                self.env['erpv6.validation.analysis'].create({
                    'round_id': validation_round.id,
                    'analyst_index': analyst_idx,
                    'omni_call_log_id': result.get('call_log_id'),
                    'findings': findings,
                    'claims_checked': parsed.get('claims_checked', []),
                    'flagged_missing_data': parsed.get('flagged_missing_data', '')
                })
                analysis_findings.append(findings)

            # Ora esegui il Sesto Uomo
            previous_round_corrections = ''
            if len(session.round_ids) > 0:
                last_round = session.round_ids[-1]
                if last_round.sesto_uomo_notes:
                    previous_round_corrections = f"\n\nCorrezioni dal round precedente: {last_round.sesto_uomo_notes}"

            sesto_template, sesto_prompt_ref = session._get_sesto_uomo_prompt_template()
            validation_round.sesto_prompt_ref = sesto_prompt_ref
            prompt_sesto = sesto_template.format(
                destinatario=session.destinatario,
                scopo=session.scopo,
                analysis_findings=' | '.join(analysis_findings),
                previous_round_corrections=previous_round_corrections,
            )

            result_sesto = self.env['erpv6.omni.bridge'].execute_ai_task(
                task_type='validation_sesto_uomo',
                prompt=prompt_sesto
            )
            parsed_sesto, error_sesto = session._parse_ai_json_response(result_sesto)
            if error_sesto:
                _logger.warning(
                    "Sesto Uomo (sessione #%s, round %d) fallito: %s",
                    session.id, round_number, error_sesto)
                # MAI convergere su un fallimento reale della chiamata AI --
                # forza un problema residuo cosi' il round va in retry/escalation
                # invece di approvare qualcosa mai davvero validato (stesso
                # principio anti-allucinazione: un esito mancante non e' un
                # esito positivo). Stesso default (1, non 0) se la chiamata
                # riesce ma il campo issues_found manca dalla risposta.
                issues_found = 1
                sesto_notes = _("Chiamata AI al Sesto Uomo fallita: %s") % error_sesto
            else:
                issues_found = parsed_sesto.get('issues_found')
                if issues_found is None:
                    issues_found = 1
                sesto_notes = parsed_sesto.get('summary', '')

            # Aggiorna il round con i risultati del sesto uomo
            validation_round.write({
                'issues_found': issues_found,
                'sesto_uomo_notes': sesto_notes,
                'corrected_material': parsed_sesto.get('corrected_material', {}),
                # Marca SOLO il fallimento tecnico della chiamata (non un
                # disaccordo di contenuto genuino) -- distingue le due cause
                # di un'eventuale escalation, vedi
                # _cron_retry_escalated_ai_failures: ritenta automaticamente
                # solo quelle marcate qui, mai un'escalation per contenuto.
                'is_ai_failure': bool(error_sesto),
            })

            # Crea il record di analisi per il sesto uomo
            self.env['erpv6.validation.analysis'].create({
                'round_id': validation_round.id,
                'analyst_index': 'sesto',
                'omni_call_log_id': result_sesto.get('call_log_id'),
                'findings': sesto_notes,
                'claims_checked': parsed_sesto.get('claims_checked', []),
                'flagged_missing_data': parsed_sesto.get('flagged_missing_data', '')
            })

            # Verifica convergenza
            if issues_found == 0:
                session.status = 'converged'
            elif round_number >= session.max_rounds:
                session.status = 'escalated_to_human'
            else:
                # Prossimo round automatico
                session._run_round()

    def action_human_approve(self):
        """Approvazione umana del risultato"""
        for session in self:
            if session.status not in ('converged', 'escalated_to_human'):
                raise UserError(_('Puoi approvare solo sessioni con convergenza raggiunta o in escalation'))
            session.human_reviewer_id = self.env.user
            session.human_reviewed_at = fields.Datetime.now()
            session.status = 'approved'

    def action_human_reject(self, reason=None):
        """Rifiuto umano con motivazione"""
        for session in self:
            session.human_reviewer_id = self.env.user
            session.human_reviewed_at = fields.Datetime.now()
            if reason:
                session.human_notes = reason
            session.status = 'rejected'
