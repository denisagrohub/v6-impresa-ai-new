# -*- coding: utf-8 -*-
from odoo import models, fields

class BizKnowledgeGap(models.Model):
    _name = 'biz.knowledge.gap'
    _description = 'Kaizen Knowledge Gap Register'

    name = fields.Char(string='Titolo Lacuna', required=True)
    description = fields.Text(string='Descrizione Problema/Dato Mancante')
    missing_key = fields.Char(string='Chiave Requisito Mancante (KB)')
    state = fields.Selection([
        ('open', 'Aperto (Blocco Controllato)'),
        ('resolving', 'In Risoluzione'),
        ('resolved', 'Risolto (Appreso nella KB)')
    ], default='open', string='Stato Kaizen')
