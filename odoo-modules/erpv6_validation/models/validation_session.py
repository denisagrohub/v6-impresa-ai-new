# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError
import hashlib
import json


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

    @api.depends('round_ids')
    def _compute_current_round(self):
        for session in self:
            session.current_round_number = len(session.round_ids)

    def action_start_validation(self):
        """Avvia il primo round di validazione"""
        for session in self:
            if session.status != 'draft':
                raise UserError(_('Puoi avviare solo sessioni in stato Bozza'))
            session.status = 'in_validation'
            session._run_round()

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
            
            # Esegui analisi per ogni analista (1-5 o solo sesto)
            analysis_findings = []
            for analyst_idx in analyst_indices[:-1]:  # Tutti tranne il sesto
                prompt_analista = f"""Prima di analizzare qualsiasi cosa, tieni sempre presente: 
Destinatario finale: {session.destinatario}. 
Scopo concreto derivato dal destinatario: {session.scopo}. 
Dati reali disponibili: {context_json}. 

REGOLA VINCOLANTE ANTI-ALLUCINAZIONE: non inventare MAI un dato, una cifra, un fatto non presente nei dati disponibili. 
Se un'informazione necessaria manca, elencala esplicitamente in flagged_missing_data invece di stimarla o inventarla. 
Per ogni affermazione che fai, verifica se è supportata dalla fonte originale e dal documento fornito, 
riportando il risultato in claims_checked come lista di {{claim, source_verified, document_verified, note}}. 
Il tuo obiettivo è produrre la migliore analisi possibile per raggiungere lo scopo rispetto al destinatario, 
restando ancorato solo a dati verificabili."""

                result = self.env['erpv6.omni.bridge'].execute_ai_task(
                    task_type='validation_analyst',
                    prompt=prompt_analista,
                    context={'analyst_index': analyst_idx}
                )
                
                # Crea il record di analisi
                self.env['erpv6.validation.analysis'].create({
                    'round_id': validation_round.id,
                    'analyst_index': analyst_idx,
                    'omni_call_log_id': result.get('call_log_id'),
                    'findings': result.get('findings', ''),
                    'claims_checked': result.get('claims_checked', []),
                    'flagged_missing_data': result.get('flagged_missing_data', '')
                })
                analysis_findings.append(result.get('findings', ''))
            
            # Ora esegui il Sesto Uomo
            previous_round_corrections = ''
            if len(session.round_ids) > 0:
                last_round = session.round_ids[-1]
                if last_round.sesto_uomo_notes:
                    previous_round_corrections = f"\n\nCorrezioni dal round precedente: {last_round.sesto_uomo_notes}"
            
            prompt_sesto = f"""Confronta le analisi ricevute sullo stesso materiale (stesso destinatario: {session.destinatario}, stesso scopo: {session.scopo}).
Analisi degli analisti: {' | '.join(analysis_findings)}
{previous_round_corrections}

Per ogni discrepanza tra le analisi: se un'affermazione non è supportata dai dati reali disponibili (possibile allucinazione), segnalala e correggila. 
Se le analisi divergono su un punto, determina quale versione è meglio ancorata ai dati reali e quale meglio serve lo scopo rispetto al destinatario. 
Riporta il numero di problemi residui trovati in issues_found. Se 0, il processo converge. 
Se maggiore di 0, produci il materiale corretto in corrected_material, che verrà ridistribuito per un nuovo round di analisi."""

            result_sesto = self.env['erpv6.omni.bridge'].execute_ai_task(
                task_type='validation_sesto_uomo',
                prompt=prompt_sesto
            )
            
            # Aggiorna il round con i risultati del sesto uomo
            issues_found = result_sesto.get('issues_found', 0)
            validation_round.write({
                'issues_found': issues_found,
                'sesto_uomo_notes': result_sesto.get('summary', ''),
                'corrected_material': result_sesto.get('corrected_material', {})
            })
            
            # Crea il record di analisi per il sesto uomo
            self.env['erpv6.validation.analysis'].create({
                'round_id': validation_round.id,
                'analyst_index': 'sesto',
                'omni_call_log_id': result_sesto.get('call_log_id'),
                'findings': result_sesto.get('summary', ''),
                'claims_checked': result_sesto.get('claims_checked', []),
                'flagged_missing_data': result_sesto.get('flagged_missing_data', '')
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
