# -*- coding: utf-8 -*-
from odoo import models, fields


class Erpv6Base(models.Model):
    _name = 'erpv6.base'
    _description = 'ERP V6 Base Model'

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
