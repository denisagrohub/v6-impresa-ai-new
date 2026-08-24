# Pattern (senza scadenza): `hasattr(request.env, 'model.name')` è SEMPRE False

`request.env` (istanza `odoo.api.Environment`) non ha attributi Python con nomi
punteggiati come `'erpv6.sign.request'` — quindi `hasattr(request.env, 'erpv6.sign.request')`
ritorna **sempre False**, indipendentemente dal fatto che il modello sia
installato o meno. Un controller che usa questo idiom per un controllo
opzionale ("se il modulo è installato, fai X") non esegue MAI il ramo reale,
silenziosamente — nessun errore, nessun log, solo un comportamento fittizio
permanente (es. `sign_api.py`, scoperto il 23/08/2026: l'endpoint tornava
sempre un ID fittizio senza mai creare un vero `erpv6.sign.request`).

**Corretto**: `'erpv6.sign.request' in request.env` — `Environment.__contains__`
controlla davvero il registry dei modelli installati.

Questo NON è lo stesso idiom usato per gli `env['model']` normali dentro i
metodi dei modelli Odoo (`hasattr(record, 'campo')` per un campo opzionale è
corretto lì) — riguarda specificamente `request.env` nei controller HTTP.

Fonte: commento reale in `odoo-modules/erpv6_api_gateway/controllers/sign_api.py:17`.
