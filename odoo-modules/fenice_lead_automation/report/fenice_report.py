from odoo import models

class FeniceReport(models.AbstractModel):
    _name = 'report.fenice_lead_automation.report_fenice_score'
    _description = 'Report Fenice Score'

    def _get_report_values(self, docids, data=None):
        docs = self.env['crm.lead'].browse(docids)
        return {'doc_ids': docids, 'doc_model': 'crm.lead', 'docs': docs, 'data': data}
