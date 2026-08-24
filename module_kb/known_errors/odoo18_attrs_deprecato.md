# Pattern (senza scadenza): `attrs=`/`states=` non funzionano più in Odoo 18

Dalla 17.0 in poi Odoo NON usa più `attrs="{'invisible': [(...)]}"` nelle viste
XML — un modulo con quella sintassi fallisce il promote con
`odoo.tools.convert.ParseError: Since 17.0, the "attrs" and "states"
attributes are no longer used.` e blocca l'intero caricamento del modulo
(non solo la vista incriminata).

**Corretto**: l'attributo diretto sul tag, con un'espressione Python come
stringa, non più un dominio a lista:

```xml
<!-- VECCHIO (rotto su Odoo 18) -->
<field name="x" attrs="{'invisible': [('state', '!=', 'done')]}"/>

<!-- NUOVO (corretto) -->
<field name="x" invisible="state != 'done'"/>
```

Vale per `invisible`, `readonly`, `required` — stessa sintassi diretta per
tutti e tre. Scoperto due volte nella stessa sessione (23-24/08/2026) su
file di viste diverse (`erpv6_saas/views/vertical_catalog_views.xml`,
`erpv6_production/views/interview_views.xml`) — Claudio deve scrivere
sempre la sintassi nuova, mai proporre `attrs=`/`states=` nemmeno per
"coerenza" con codice vecchio esistente altrove nel repo (quel codice
vecchio è debito tecnico, non un esempio da replicare).
