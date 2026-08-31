from odoo import fields, models

from .core_node import SAFE_PROCESSES, TIPO_DATO_VOCABOLARIO

# Denis, 30/08/2026, correzione di design: la firma e' una proprieta' del
# Motore (la funzione _run_*, statica in SAFE_PROCESSES), NON dell'istanza
# di erpv6.core.node -- due nodi diversi con lo stesso process_key hanno
# automaticamente la stessa firma, senza doverla ridichiarare per ognuno.
# Stesso principio di KB_ENGINE_REQUIRED_INPUTS (dizionario a livello di
# modulo, non per-nodo) generalizzato qui. process_key e' una chiave
# testuale sui valori chiusi di SAFE_PROCESSES -- stesso pattern di
# cron_trigger_key su erpv6.core.node, NESSUNA FK verso un nodo.
_PROCESS_KEY_SELECTION = [(k, v['label']) for k, v in SAFE_PROCESSES.items()]


class Erpv6CoreProcessInputSpec(models.Model):
    _name = 'erpv6.core.process.input_spec'
    _description = "Firma di un input dichiarato da un Motore (process_key) -- generalizza KB_ENGINE_REQUIRED_INPUTS"
    _sql_constraints = [
        ('process_key_input_key_uniq', 'unique(process_key, input_key)',
         "Questo input e' gia' dichiarato per questo process_key."),
    ]

    process_key = fields.Selection(
        _PROCESS_KEY_SELECTION, required=True,
        help="Elenco chiuso -- stessi valori di SAFE_PROCESSES/cron_trigger_key, mai un nome "
             "libero. Un nodo con questo process_key eredita questa firma, non ne dichiara una "
             "propria.")
    input_key = fields.Char(
        required=True, help="Chiave attesa in input_data, es. 'order_id', 'disc', 'sign_request_id'.")
    tipo_dato = fields.Selection(TIPO_DATO_VOCABOLARIO, required=True)
    obbligatorio = fields.Boolean(
        default=True,
        help="Se True, fa parte dell'AND richiesto -- assente = firma non soddisfatta. Solo "
             "dichiarativo in questo prompt: nessun _run_* o run_process()/run_circuit() legge "
             "questo campo per decidere se eseguire -- vedi morsettiera, prompt separato.")
    note = fields.Char(
        help="Es. \"erpv6.production.order gia' esistente\" -- stessa chiarezza dei messaggi "
             "UserError attuali nei _run_*.")
    tag_dominio = fields.Char(
        help="Dominio/reparto a cui appartiene questo input (es. 'contabilita', 'hr', "
             "'commerciale', 'produzione') -- usato dalla futura UI per postazione per "
             "filtrare cosa mostrare a ciascun ruolo. Char libero: verificato il 30/08/2026 "
             "che non esiste ancora nessun vocabolario chiuso di dominio/reparto riusabile "
             "nel progetto (solo erpv6_core.group_consulente come unico gruppo di postazione "
             "reale oggi, ed erpv6.kb.category.verticale che e' un asse diverso -- il "
             "verticale industriale del cliente, non il reparto interno). Non popolato per "
             "nessuna riga esistente: la valorizzazione e' una decisione di dominio, non "
             "un'inferenza automatica.")


class Erpv6CoreProcessOutputSpec(models.Model):
    _name = 'erpv6.core.process.output_spec'
    _description = "Tipo di output dichiarato da un Motore (process_key) -- terza parte della firma (ingressi + AND + tipo output)"
    _sql_constraints = [
        ('process_key_uniq', 'unique(process_key)',
         "Questo process_key ha gia' un output_tipo_dato dichiarato."),
    ]

    process_key = fields.Selection(_PROCESS_KEY_SELECTION, required=True)
    output_tipo_dato = fields.Selection(
        TIPO_DATO_VOCABOLARIO, required=True,
        help="Solo documentazione/schema in questo prompt, nessun codice la legge per decidere "
             "nulla a runtime.")
    tag_dominio = fields.Char(
        help="Dominio/reparto a cui appartiene questo output (es. 'contabilita', 'hr', "
             "'commerciale', 'produzione') -- usato dalla futura UI per postazione per "
             "filtrare cosa mostrare a ciascun ruolo. Char libero: nessun vocabolario chiuso "
             "riusabile trovato oggi nel progetto (vedi Erpv6CoreProcessInputSpec.tag_dominio "
             "per i dettagli della verifica). Non popolato per nessuna riga esistente.")
