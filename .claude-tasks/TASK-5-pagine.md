# TASK 5 - Pagine secondarie (stesso sistema visivo, contenuti reali)
Le pagine in app/chi-siamo, app/servizi, app/servizi/finanziamenti,
app/casi-studio, app/contatti, app/blog sono scaffoldate con robots noindex:
RIMUOVI il noindex SOLO quando la pagina e completa e verificata.
## Istruzioni per pagina
- chi-siamo: MetodoLine come timeline founder, NON bio statiche affiancate.
- servizi: bento grid a blocchi di dimensioni diverse, NON 3 card identiche;
  icone-metodo coerenti con la home.
- servizi/finanziamenti: MAI gauge di probabilita di approvazione senza modello
  statistico reale. Usare StateBadge con stati qualitativi onesti.
- casi-studio: schema prima/dopo (critico verso positivo). Tosi Mati = "il nostro
  stesso progetto agricolo", MAI "azienda cliente".
- contatti: nessun trattamento speciale; conferma di successo SOLO se il lead e
  realmente arrivato in Odoo (risposta API verificata).
- blog: tipografia pulita, minimo colore, nessun sistema di stati.
## VIETATO
Statistiche finte ("350+ business plan", "45M euro", "98% soddisfazione") anche
come "da confermare dopo". Se manca il dato: campo vuoto + commento TODO(real-data).
## ACCETTAZIONE
tsc + build puliti; nessun numero inventato; ogni pagina completa o ancora noindex.
