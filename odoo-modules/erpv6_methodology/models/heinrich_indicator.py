from odoo import api, fields, models


class Erpv6HeinrichIndicator(models.Model):
    _name = 'erpv6.heinrich.indicator'
    _description = 'Indicatore Trasversale Heinrich (Ford/Toyota) - Cultura organizzativa sulla segnalazione rischi'

    res_model = fields.Char(string='Modello Collegato', required=True, index=True)
    res_id = fields.Integer(string='ID Record', required=True, index=True)
    
    near_miss_segnalati = fields.Integer(
        string='Near Miss Segnalati (ultimo anno)',
        help='Mancati infortuni/problemi segnalati nell ultimo anno.'
    )
    problemi_lievi = fields.Integer(
        string='Problemi Lievi Verificati',
        help='Problemi di lieve entità che si sono verificati effettivamente.'
    )
    eventi_gravi = fields.Integer(
        string='Eventi Gravi Verificati',
        help='Eventi gravi/infortuni che si sono verificati.'
    )

    cultura_organizzativa = fields.Selection([
        ('toyota', 'Toyota - Segnalazione come responsabilità'),
        ('ford_silenziosa', 'Ford - Organizzazione silenziosa, rischio nascosto'),
        ('non_determinabile', 'Dati insufficienti'),
    ], string='Cultura Organizzativa', compute='_compute_cultura', store=True)

    note = fields.Text(string='Note')

    @api.depends('near_miss_segnalati', 'problemi_lievi', 'eventi_gravi')
    def _compute_cultura(self):
        """
        Logica euristica per determinare la cultura organizzativa:
        - Se near_miss_segnalati è basso o zero MA eventi_gravi/problemi_lievi > 0:
          -> 'ford_silenziosa' (il rischio esiste ma non viene segnalato)
        - Se near_miss_segnalati è proporzionalmente alto rispetto a eventi_gravi 
          (coerente con proporzione 1:29:300 di Heinrich):
          -> 'toyota' (cultura della segnalazione)
        - Altrimenti: 'non_determinabile'
        """
        for rec in self:
            near_miss = rec.near_miss_segnalati or 0
            problemi = rec.problemi_lievi or 0
            gravi = rec.eventi_gravi or 0
            
            # Casi con dati insufficienti
            if near_miss == 0 and problemi == 0 and gravi == 0:
                rec.cultura_organizzativa = 'non_determinabile'
                continue
            
            # Se ci sono problemi/eventi ma pochi o zero near_miss -> Ford silenziosa
            # Consideriamo "pochi" near_miss se sono meno della somma di problemi+gravi
            total_problemi_verificati = problemi + gravi
            
            if total_problemi_verificati > 0:
                if near_miss == 0 or near_miss < total_problemi_verificati:
                    # Pochi near_miss rispetto ai problemi effettivi -> cultura silenziosa
                    rec.cultura_organizzativa = 'ford_silenziosa'
                elif near_miss >= total_problemi_verificati * 5:
                    # Molti near_miss segnalati (proporzionalmente alti) -> cultura Toyota
                    # Usiamo un fattore euristico (5x) per indicare una buona propensione alla segnalazione
                    rec.cultura_organizzativa = 'toyota'
                else:
                    # Zona grigia
                    rec.cultura_organizzativa = 'non_determinabile'
            else:
                # Nessun problema verificato, solo near_miss -> potrebbe essere Toyota proattiva
                if near_miss > 0:
                    rec.cultura_organizzativa = 'toyota'
                else:
                    rec.cultura_organizzativa = 'non_determinabile'
