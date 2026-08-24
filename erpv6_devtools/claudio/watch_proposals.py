#!/usr/bin/env python3
"""Ciclo automatico di Claudio (24/08/2026, richiesto esplicitamente da
Denis: "se non sono davanti al pc, devo poter rispondere e lui procede con
aider"). Gira in background sul VPS, non in un terminale interattivo.

Ogni CICLO_SECONDI: interroga Odoo per proposte erpv6.agent.proposal di
Claudio con status='accepted' (Denis le ha approvate dall'interfaccia, o
tramite il wizard "Assegna ed accetta") e non ancora smistate da questo
script (tracciate in dispatched_proposals.json, locale, non in Odoo: evita
di aggiungere un nuovo campo/promote per un dettaglio di solo VPS). Per
ognuna: rilancia Aider in modo NON interattivo con il testo della proposta
gia' approvata come istruzione (--yes-always: il gate umano vero e' gia'
avvenuto con l'approvazione in Odoo, non serve un secondo sì per ogni
singolo file toccato). Aider puo' modificare file (auto-commits sempre
disattivato via .aider.conf.yml), ma questo script NON esegue mai da solo
promote_module.sh: quello resta un passo separato, Denis vede il diff reale
prima di decidere se promuoverlo (stesso principio "mai un fix di codice
promosso senza revisione", anche in modalita' non presidiata).

Uso:
  python3 erpv6_devtools/claudio/watch_proposals.py            # loop infinito
  python3 erpv6_devtools/claudio/watch_proposals.py --once     # un solo giro (per test)
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent

sys.path.insert(0, str(SCRIPT_DIR))
import graph_context  # noqa: E402
DISPATCHED_FILE = SCRIPT_DIR / "dispatched_proposals.json"
CICLO_SECONDI = 120

QUERY_SCRIPT = '''
import json
proposals = env['erpv6.agent.proposal'].sudo().search([
    ('agent_config_id.code', '=', 'claudio'),
    ('status', '=', 'accepted'),
])
result = [{'id': p.id, 'name': p.name, 'proposal_text': p.proposal_text} for p in proposals]
print("RESULT_JSON:" + json.dumps(result))
'''


def load_dispatched():
    if DISPATCHED_FILE.exists():
        return set(json.loads(DISPATCHED_FILE.read_text()))
    return set()


def save_dispatched(ids):
    DISPATCHED_FILE.write_text(json.dumps(sorted(ids)))


def query_accepted_proposals():
    result = subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=QUERY_SCRIPT, capture_output=True, text=True, timeout=60,
    )
    for line in result.stdout.splitlines():
        if line.startswith("RESULT_JSON:"):
            return json.loads(line[len("RESULT_JSON:"):])
    print("ATTENZIONE: query proposte fallita, stdout:", result.stdout[-1000:], file=sys.stderr)
    return []


def apply_proposal(proposal):
    """Rilancia Aider non interattivo con l'istruzione gia' approvata.
    Ritorna (successo, output_aider, diff_reale).

    Contesto dal grafo (24/08/2026, vedi graph_context.py): invece di
    caricare sempre lo stesso elenco fisso di file (module_kb/*, CLAUDE.md
    - che restano via .aider.conf.yml, sono generici e leggeri), qui si
    aggiunge SOLO cio' che il grafo sa davvero sul modulo bersaglio di
    QUESTA proposta - dipendenze reali e modelli business che ci vivono,
    interrogati ora, non un dump statico."""
    graph_block = graph_context.build_context_block(proposal["proposal_text"])
    message = (
        "Questa proposta e' GIA' STATA APPROVATA da Denis in Odoo (erpv6.agent.proposal #%d, "
        "'%s'). Applica DAVVERO la modifica descritta, modificando i file necessari. "
        "%sTesto della proposta approvata:\n\n%s\n\n"
        "IMPORTANTE: quando hai finito, termina SEMPRE la tua risposta con una riga che inizia "
        "esattamente con 'RIASSUNTO TELEGRAM:' seguita da 2-3 frasi in italiano semplice, senza "
        "gergo tecnico, che dicano a Denis (che legge da telefono, non ha il codice davanti) "
        "cosa hai fatto e perche' - niente nomi di variabili o dettagli implementativi a meno "
        "che non siano davvero necessari per capire."
    ) % (proposal["id"], proposal["name"], graph_block, proposal["proposal_text"])

    result = subprocess.run(
        [str(SCRIPT_DIR / "run.sh"), "--yes-always", "--no-auto-commits", "--message", message],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=600,
    )
    # Scope del diff SOLO ai file che Aider dichiara di aver toccato in
    # QUESTO giro ("Applied edit to <file>" nel suo output) - non l'intero
    # working tree, che stasera ha altre 16+ modifiche in sospeso non
    # legate a questo lavoro. Trovato/corretto il 24/08/2026 dopo il primo
    # test reale, che mostrava "17 file modificati" per un fix di un solo
    # file.
    touched_files = sorted(set(
        line.split("Applied edit to ", 1)[1].strip()
        for line in result.stdout.splitlines() if "Applied edit to " in line
    ))
    diff = ""
    if touched_files:
        diff = subprocess.run(
            ["git", "diff", "--stat", "--"] + touched_files,
            cwd=REPO_ROOT, capture_output=True, text=True,
        ).stdout.strip()
    return result.returncode == 0, result.stdout, diff


def derive_modules(touched_files):
    """Estrae i nomi modulo (es. 'erpv6_api_gateway') dai percorsi
    'odoo-modules/<modulo>/...' dei file toccati - non serve un campo
    esplicito sulla proposta, si deduce da dove Aider ha scritto davvero."""
    modules = []
    for f in touched_files:
        parts = f.split("/")
        if len(parts) >= 2 and parts[0] == "odoo-modules" and parts[1] not in modules:
            modules.append(parts[1])
    return modules


def promote_modules(modules, proposal_id):
    """Promuove DAVVERO ogni modulo toccato (24/08/2026, richiesto da Denis:
    "la promozione la deve fare Claudio la prossima volta") tramite
    safe_exec.sh, che richiede CLAUDIO_APPROVED_PROPOSAL_ID - nessuna
    promozione senza il gate umano tracciabile che quel wrapper impone.
    Verifica il successo REALE sul log (stesso principio 'verifica non
    narrazione' di tutta la sessione: exit code da solo non basta, un
    warning preesistente non correlato puo' far tornare exit 1 anche su
    successo vero), non si fida del solo returncode.

    IMPORTANTE (bug trovato il 24/08/2026 rileggendo promote_module.sh
    prima di attivare questa pipeline): lo Step 3 dello script chiede una
    conferma interattiva vera (read -p, "aggiornare anche la produzione?").
    Lanciato senza terminale lo stdin sarebbe indeterminato - qui lo
    rendiamo esplicito e deterministico rispondendo 'N' (Step 3 e' oggi
    ridondante: STAGING_DB e PROD_DB coincidono entrambi su 'erpv6', gia'
    aggiornato dallo Step 2 che gira sempre) invece di lasciare al caso
    cosa succede sull'input ereditato da un processo in background.

    SECONDO bug trovato con il primo test reale di questa pipeline
    (proposta #10, 24/08/2026): 'Modules loaded'/'Registry loaded' non
    compaiono MAI nello stdout di promote_module.sh - Odoo scrive quel
    testo nel proprio LOGFILE separato (/tmp/promote_*.log), non
    nell'output dello script (vedi promote_module.sh riga
    'odoo ... > "$LOGFILE" 2>&1'). Il segnale di successo REALE nello
    stdout dello script e' invece la riga che stampa esplicitamente, la
    stessa usata a mano per tutta la sessione: '✅ Installazione su
    staging riuscita'."""
    results = {}
    env = {**os.environ, "CLAUDIO_APPROVED_PROPOSAL_ID": str(proposal_id)}
    for module in modules:
        proc = subprocess.run(
            [str(SCRIPT_DIR / "safe_exec.sh"), "%s/scripts/promote_module.sh %s" % (REPO_ROOT, module)],
            cwd=REPO_ROOT, capture_output=True, text=True, timeout=600, env=env, input="N\n",
        )
        output = proc.stdout + proc.stderr
        real_success = "Installazione su staging riuscita" in output
        results[module] = (real_success, output[-2000:])
    return results


def run_argus_verification(proposal, touched_files):
    """Fa verificare DAVVERO ad Argus (sola lettura, --edit-format ask
    forzato dal suo run.sh) quello che Claudio ha applicato e promosso -
    richiesto esplicitamente da Denis il 24/08/2026 ("dovrebbe gia' averla
    promossa e passata a Argus"). Stesso contratto RIASSUNTO TELEGRAM di
    Claudio, per lo stesso motivo (niente transcript grezzo).

    VERDETTO OK/PROBLEMA (aggiunto 24/08/2026, richiesto esplicitamente:
    "deve essere Argus che mi chiede se va bene lo stesso oppure no") -
    prima Argus scriveva solo un'osservazione senza nessuna conseguenza
    reale nel flusso. Ora un verdetto esplicito, sempre in prima riga,
    permette al chiamante di decidere se serve aprire una nuova proposta
    di correzione o no."""
    files_list = ", ".join(touched_files)
    message = (
        "Sei Argus, QA del sistema erpv6 - SOLA LETTURA sempre, mai scrittura. Claudio ha "
        "applicato e promosso in produzione la proposta approvata #%d ('%s'). File toccati: "
        "%s. Rileggi ORA il contenuto reale di questi file (non fidarti di conversazioni "
        "precedenti) e verifica che la modifica descritta sia presente e corretta: %s\n\n"
        "IMPORTANTE: la TUA PRIMISSIMA RIGA deve essere esattamente 'VERDETTO: OK' (la modifica "
        "e' presente ed esattamente come richiesto, nessuna discrepanza) oppure "
        "'VERDETTO: PROBLEMA' (manca, e' sbagliata, o non rispetta esattamente quanto chiesto - "
        "anche un dettaglio come la posizione dentro il file conta). Poi termina SEMPRE la "
        "risposta con una riga che inizia esattamente con 'RIASSUNTO TELEGRAM:' seguita da 1-2 "
        "frasi in italiano semplice per Denis (legge da telefono) che spiegano il verdetto."
    ) % (proposal["id"], proposal["name"], files_list, proposal["proposal_text"])
    proc = subprocess.run(
        [str(REPO_ROOT / "erpv6_devtools" / "argus" / "run.sh"), "--yes-always", "--message", message],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=300,
    )
    verdict = "PROBLEMA"  # default prudente: se non troviamo un verdetto esplicito, mai assumere OK
    if CHAT_HISTORY_FILE.exists():
        content = CHAT_HISTORY_FILE.read_text(encoding="utf-8", errors="replace")
        for line in content.splitlines():
            if line.strip().upper().startswith("VERDETTO:"):
                verdict = line.strip()[len("VERDETTO:"):].strip().upper()
    return proc.returncode == 0, verdict, extract_human_summary(proc.stdout)


def create_correction_proposal(original_proposal, argus_summary):
    """Crea una nuova erpv6.agent.proposal (agente Claudio, incatenata a
    quella originale) quando Argus trova un problema - manda una vera
    decisione a Denis (bottoni Approva/Rifiuta, stesso schema gia' in uso)
    invece di limitarsi a informarlo. Approva = Claudio corregge al giro
    successivo (la proposta rientra nel normale ciclo status='accepted']);
    Rifiuta = resta cosi' com'e', nessuna ulteriore azione."""
    script = '''
claudio = env['erpv6.agent.config'].search([('code', '=', 'claudio')], limit=1)
p = env['erpv6.agent.proposal'].sudo().create({
    'agent_config_id': claudio.id,
    'name': 'Correzione su segnalazione di Argus (proposta #%d)',
    'proposal_text': %r,
    'parent_proposal_id': %d,
    'status': 'pending_review',
})
env.cr.commit()
cfg = env['erpv6.agent.telegram.config'].search([('agent_config_id', '=', claudio.id)], limit=1)
body = "🔍 Argus ha trovato un problema sulla proposta #%d\\n\\n" + %r + "\\n\\nVa bene lo stesso, o vuoi che Claudio corregga?"
ok = cfg.send_proposal_decision(p.id, body)
print("CORRECTION_PROPOSAL_ID:%%d" %% p.id)
print("SENT:", ok)
''' % (
        original_proposal["id"],
        "Argus ha verificato la proposta #%d ('%s') e trovato questo problema: %s\n\nCorreggi in modo che "
        "corrisponda esattamente a quanto richiesto originariamente: %s" % (
            original_proposal["id"], original_proposal["name"], argus_summary, original_proposal["proposal_text"]),
        original_proposal["id"], original_proposal["id"], argus_summary,
    )
    subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=script, capture_output=True, text=True, timeout=60,
    )


CHAT_HISTORY_FILE = REPO_ROOT / ".aider.chat.history.md"


def extract_human_summary(aider_output):
    """Estrae SOLO il 'RIASSUNTO TELEGRAM:' che Aider e' istruito a scrivere
    sempre in fondo alla risposta (vedi apply_proposal) - mai il transcript
    grezzo del terminale (tabelle di progresso, diff, gergo tecnico), che
    Denis ha segnalato incomprensibile il 24/08/2026.

    IMPORTANTE (bug trovato il 24/08/2026, messaggio Telegram troncato a
    meta' frase su proposta #16): 'aider_output' (lo stdout catturato del
    processo) e' il rendering a schermo di Aider (box-drawing, colori,
    a-capo forzati per una larghezza di terminale finta, dato che non c'e'
    un vero terminale) - una riga logica lunga puo' spezzarsi su piu' righe
    fisiche li', facendo perdere la seconda meta' della frase. Il file
    .aider.chat.history.md invece e' il log pulito che Aider scrive da
    solo, senza quel wrapping (verificato dal vivo confrontando i due).
    Si legge quindi da li', prendendo l'ULTIMA occorrenza (Claudio e Argus
    scrivono nello stesso file, in sequenza, mai in parallelo dentro
    run_once)."""
    if CHAT_HISTORY_FILE.exists():
        content = CHAT_HISTORY_FILE.read_text(encoding="utf-8", errors="replace")
        matches = [line.strip()[len("RIASSUNTO TELEGRAM:"):].strip()
                   for line in content.splitlines() if line.strip().startswith("RIASSUNTO TELEGRAM:")]
        if matches:
            return matches[-1]
    # Fallback (file assente o pattern non trovato li'): prova comunque
    # sull'output catturato, meglio un rischio di riga tagliata che niente.
    for line in aider_output.splitlines():
        if line.strip().startswith("RIASSUNTO TELEGRAM:"):
            return line.strip()[len("RIASSUNTO TELEGRAM:"):].strip()
    return "(Claudio non ha scritto un riassunto in italiano semplice per questa modifica - controlla il log completo sul VPS.)"


def run_argus_status_check(proposal, claudio_output):
    """Fa controllare ad Argus lo stato reale ANCHE quando Claudio non e'
    riuscito ad applicare nulla (errore AI, rate limit, nessuna modifica
    trovata) - richiesto esplicitamente da Denis il 24/08/2026: "facciamo
    in modo che Argus parta anche quando abbiamo un errore AI... cosi
    abbiamo un riscontro anche su quello". Non verifica una modifica
    (non ce n'e' stata), verifica che il file bersaglio sia rimasto in
    stato sano (nessuna scrittura parziale/corrotta lasciata a meta') -
    stesso principio 'mai un fallimento silenzioso senza controllo'."""
    file_match = re.search(r'odoo-modules/[\w./-]+\.py', proposal["proposal_text"])
    target_file = file_match.group(0) if file_match else None
    if not target_file:
        return "(Nessun file bersaglio riconoscibile nel testo della proposta, controllo saltato.)"
    message = (
        "Sei Argus, QA del sistema erpv6 - SOLA LETTURA sempre, mai scrittura. Claudio ha "
        "provato ad applicare la proposta #%d ('%s') su %s ma NON ci e' riuscito (errore "
        "tecnico o nessuna modifica trovata - non e' colpa tua verificarne il motivo, solo lo "
        "stato). Rileggi ORA %s e conferma solo se il file e' in uno stato normale/leggibile "
        "(nessuna scrittura parziale o corrotta lasciata a meta').\n\n"
        "IMPORTANTE: termina SEMPRE la risposta con una riga che inizia esattamente con "
        "'RIASSUNTO TELEGRAM:' seguita da 1 frase in italiano semplice per Denis."
    ) % (proposal["id"], proposal["name"], target_file, target_file)
    proc = subprocess.run(
        [str(REPO_ROOT / "erpv6_devtools" / "argus" / "run.sh"), "--yes-always", "--message", message],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=180,
    )
    if proc.returncode != 0:
        return "Argus non è riuscito a rispondere neanche lui - verifica manuale consigliata."
    return extract_human_summary(proc.stdout)


def notify_telegram(text):
    notify_script = '''
claudio = env['erpv6.agent.config'].search([('code', '=', 'claudio')], limit=1)
ok = env['erpv6.agent.telegram.config'].send_message_for_agent(claudio, %r)
print("TELEGRAM_SENT:", ok)
''' % text
    subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=notify_script, capture_output=True, text=True, timeout=60,
    )


def mark_actioned(proposal_id):
    mark_script = '''
p = env['erpv6.agent.proposal'].browse(%d)
p.action_mark_actioned()
env.cr.commit()
print("MARKED_ACTIONED")
''' % proposal_id
    subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=mark_script, capture_output=True, text=True, timeout=60,
    )


def run_once():
    dispatched = load_dispatched()
    proposals = query_accepted_proposals()
    new_ones = [p for p in proposals if p["id"] not in dispatched]
    if not new_ones:
        print("[watch_proposals] nessuna nuova proposta approvata da applicare.")
        return
    for proposal in new_ones:
        print("[watch_proposals] applico proposta #%d: %s" % (proposal["id"], proposal["name"]))
        dispatched.add(proposal["id"])
        save_dispatched(dispatched)  # subito, prima di applicare: mai rielaborare due volte

        success, output, diff = apply_proposal(proposal)
        # Messaggio in italiano semplice, non il transcript grezzo del
        # terminale (Denis l'ha segnalato incomprensibile il 24/08/2026) -
        # "lo schermo di Aider" ma raccontato, non incollato cosi' com'e'.
        human_summary = extract_human_summary(output)
        touched_files = [line.split("|")[0].strip() for line in diff.splitlines() if "|" in line]
        if success and diff:
            # Catena completa (24/08/2026, richiesto da Denis: "dovrebbe
            # gia' averla promossa e passata a Argus... dovrei ricevere da
            # Claudio il responso di Argus") - applica, promuove DAVVERO
            # (safe_exec.sh, gate tracciabile), poi fa verificare Argus in
            # sola lettura, tutto in un solo giro automatico.
            modules = derive_modules(touched_files)
            promote_results = promote_modules(modules, proposal["id"]) if modules else {}
            promote_ok = all(ok for ok, _ in promote_results.values()) if promote_results else False
            promote_lines = "\n".join(
                "- %s: %s" % (m, "promosso ✅" if ok else "FALLITO ❌ (controlla il VPS)")
                for m, (ok, _log) in promote_results.items()
            )
            argus_line = ""
            if promote_ok:
                argus_ok, argus_verdict, argus_summary = run_argus_verification(proposal, touched_files)
                if not argus_ok:
                    argus_line = "\n\n--- Verifica di Argus ---\nArgus non è riuscito a rispondere, verifica manuale consigliata."
                elif argus_verdict == "OK":
                    argus_line = "\n\n--- Verifica di Argus ---\n✅ %s" % argus_summary
                else:
                    # PROBLEMA (24/08/2026, richiesto da Denis: "deve
                    # essere Argus che mi chiede se va bene lo stesso
                    # oppure no") - non solo informare, apre una vera
                    # decisione incatenata, stessi bottoni Approva/Rifiuta.
                    argus_line = "\n\n--- Verifica di Argus ---\n⚠️ %s\n\nTi ho mandato una richiesta separata per decidere." % argus_summary
                    create_correction_proposal(proposal, argus_summary)
            # mark_actioned SOLO se la promozione e' riuscita davvero (bug
            # trovato il 24/08/2026, primo test reale della pipeline: prima
            # veniva segnata 'attuata' anche quando la promozione falliva -
            # es. un errore di sintassi vero introdotto da Aider, proposta
            # #11 - facendo perdere la proposta invece di lasciarla visibile
            # per un secondo giro/intervento). Se fallisce, resta
            # 'accepted': non riprocessata di nuovo (dispatched_proposals.json
            # gia' aggiornato sopra), ma nemmeno falsamente chiusa.
            if promote_ok:
                body = (
                    "✅ Proposta #%d applicata: %s\n\n%s\n\nFile toccati: %s\n\nPromozione:\n%s%s"
                ) % (proposal["id"], proposal["name"], human_summary,
                     ", ".join(touched_files), promote_lines, argus_line)
                mark_actioned(proposal["id"])
            else:
                body = (
                    "⚠️ Proposta #%d: modifica applicata ma la PROMOZIONE È FALLITA (controlla "
                    "manualmente sul VPS, la produzione NON è stata toccata grazie al rollback "
                    "automatico). File toccati: %s\n\nDettaglio:\n%s"
                ) % (proposal["id"], ", ".join(touched_files), promote_lines)
        elif success and not diff:
            argus_check = run_argus_status_check(proposal, output)
            body = (
                "Proposta #%d elaborata ma NESSUN file modificato - Aider potrebbe non aver "
                "trovato una modifica applicabile diretta, controlla manualmente.\n\n"
                "--- Controllo di Argus ---\n%s"
            ) % (proposal["id"], argus_check)
        else:
            argus_check = run_argus_status_check(proposal, output)
            body = (
                "Proposta #%d: Aider ha restituito un errore, NON applicata. "
                "Controlla manualmente (log completo su questo VPS).\n\n"
                "--- Controllo di Argus ---\n%s"
            ) % (proposal["id"], argus_check)
            print(output, file=sys.stderr)
        notify_telegram(body)
        print("[watch_proposals]", body)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--once", action="store_true", help="Un solo giro invece del loop infinito")
    args = p.parse_args()

    if args.once:
        run_once()
        return

    print("[watch_proposals] avviato, ciclo ogni %ds. Ctrl+C per fermare." % CICLO_SECONDI)
    while True:
        try:
            run_once()
        except Exception as e:
            print("[watch_proposals] errore nel giro, continuo comunque:", e, file=sys.stderr)
        time.sleep(CICLO_SECONDI)


if __name__ == "__main__":
    main()
