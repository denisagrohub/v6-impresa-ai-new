#!/usr/bin/env python3
"""Ciclo automatico di Claudio (24/08/2026, richiesto esplicitamente da
Denis: "se non sono davanti al pc, devo poter rispondere e lui procede con
aider"). Gira in background sul VPS, non in un terminale interattivo.

Generalizzato il 25/08/2026 (costruzione di Alessandro, vedi memoria
project_alessandro_agent_design.md) per gestire ANCHE le proposte di
Alessandro, non solo quelle di Claudio -- stesso ciclo, stessa logica di
dispatch/promote/verifica-Argus, un giro per ciascun AGENT_CODES sotto.
Alessandro ha strumenti piu' ampi (ricerca nel codice/nel grafo, azioni
non-diff quando il fix non e' un file da editare) ma la stessa
infrastruttura di sicurezza di Claudio (safe_exec.sh, MAI duplicato: questo
script continua a chiamare SEMPRE erpv6_devtools/claudio/safe_exec.sh per
promuovere, indipendentemente da quale agente ha applicato la modifica).

Ogni CICLO_SECONDI, per ciascun agente in AGENT_CODES: interroga Odoo per
proposte erpv6.agent.proposal di quell'agente con status='accepted' (Denis
le ha approvate dall'interfaccia, tramite il wizard "Assegna ed accetta", o
tramite un bottone/comando Telegram) e non ancora smistate da questo script
(tracciate in <agente>/dispatched_proposals.json, locale a ciascun agente,
non in Odoo: evita di aggiungere un nuovo campo/promote per un dettaglio di
solo VPS). Per ognuna: rilancia Aider in modo NON interattivo (motore
dell'agente, run.sh nella SUA cartella: erpv6_devtools/claudio/run.sh o
erpv6_devtools/alessandro/run.sh) con il testo della proposta gia' approvata
come istruzione (--yes-always: il gate umano vero e' gia' avvenuto con
l'approvazione in Odoo, non serve un secondo si' per ogni singolo file
toccato). Aider puo' modificare file (auto-commits sempre disattivato via
.aider.conf.yml), ma questo script NON esegue mai da solo promote_module.sh:
quello resta un passo separato, Denis vede il diff reale prima di decidere
se promuoverlo (stesso principio "mai un fix di codice promosso senza
revisione", anche in modalita' non presidiata).

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

CICLO_SECONDI = 120

# Un agente per cartella (erpv6_devtools/<codice>/), ciascuna col proprio
# run.sh (motore Aider, eventualmente con parametri diversi -- vedi
# alessandro/run.sh) e il proprio dispatched_proposals.json (mai condiviso:
# lo stesso id di proposta non puo' mai comparire per due agenti diversi,
# ma tenerli separati evita ogni ambiguita'). safe_exec.sh resta SOLO in
# claudio/ (vedi promote_modules sotto): riusato da entrambi, mai duplicato.
AGENT_CODES = ('claudio', 'alessandro')


def agent_dir(agent_code):
    return SCRIPT_DIR if agent_code == 'claudio' else REPO_ROOT / "erpv6_devtools" / agent_code


def dispatched_file(agent_code):
    return agent_dir(agent_code) / "dispatched_proposals.json"


def load_dispatched(agent_code):
    f = dispatched_file(agent_code)
    if f.exists():
        return set(json.loads(f.read_text()))
    return set()


def save_dispatched(agent_code, ids):
    dispatched_file(agent_code).write_text(json.dumps(sorted(ids)))


def query_accepted_proposals(agent_code):
    query_script = '''
import json
proposals = env['erpv6.agent.proposal'].sudo().search([
    ('agent_config_id.code', '=', %r),
    ('status', '=', 'accepted'),
])
result = [{'id': p.id, 'name': p.name, 'proposal_text': p.proposal_text} for p in proposals]
print("RESULT_JSON:" + json.dumps(result))
''' % agent_code
    result = subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=query_script, capture_output=True, text=True, timeout=60,
    )
    for line in result.stdout.splitlines():
        if line.startswith("RESULT_JSON:"):
            return json.loads(line[len("RESULT_JSON:"):])
    print("ATTENZIONE: query proposte (%s) fallita, stdout:" % agent_code, result.stdout[-1000:], file=sys.stderr)
    return []


def apply_proposal(agent_code, proposal):
    """Rilancia Aider (motore dell'agente indicato) non interattivo con
    l'istruzione gia' approvata. Ritorna (successo, output_aider, diff_reale).

    Contesto dal grafo (24/08/2026, vedi graph_context.py): invece di
    caricare sempre lo stesso elenco fisso di file (module_kb/*, CLAUDE.md
    - che restano via .aider.conf.yml, sono generici e leggeri), qui si
    aggiunge SOLO cio' che il grafo sa davvero sul modulo bersaglio di
    QUESTA proposta - dipendenze reali e modelli business che ci vivono,
    interrogati ora, non un dump statico. Riusato identico per Alessandro
    (25/08/2026): stessa infrastruttura di contesto, non una copia.

    Per Alessandro (25/08/2026, design 'strumenti piu' ampi... azioni
    non-diff quando il fix non e' letteralmente un file da editare'):
    un'istruzione IN PIU' nel prompt che gli dice come segnalare un fix che
    NON e' un file da editare (voce KB, configurazione) -- MAI eseguito
    automaticamente da questo script (nessun executor di scritture
    arbitrarie sul DB da un processo esterno non presidiato): solo
    rilevato (vedi extract_non_diff_action sotto) e girato a Denis come
    una NUOVA proposta in attesa, stesso gate umano di sempre."""
    graph_block = graph_context.build_context_block(proposal["proposal_text"])
    extra_instruction = ""
    if agent_code == 'alessandro':
        extra_instruction = (
            "Prima di editare qualunque file, cerca DAVVERO dove intervenire (leggi i file "
            "candidati, non ipotizzare). Se il fix NON e' letteralmente un file da editare (una "
            "voce KB mancante, una configurazione, un dato da correggere), NON modificare nessun "
            "file: scrivi invece una riga che inizia esattamente con 'AZIONE_NON_DIFF:' seguita "
            "dalla descrizione precisa e verificabile dell'azione da fare -- Denis decidera' se "
            "approvarla, nessuna esecuzione automatica di azioni non-diff da questo script. "
        )
    message = (
        "Questa proposta e' GIA' STATA APPROVATA da Denis in Odoo (erpv6.agent.proposal #%d, "
        "'%s'). Applica DAVVERO la modifica descritta, modificando i file necessari. "
        "%s%sTesto della proposta approvata:\n\n%s\n\n"
        "IMPORTANTE: quando hai finito, termina SEMPRE la tua risposta con una riga che inizia "
        "esattamente con 'RIASSUNTO TELEGRAM:' seguita da 2-3 frasi in italiano semplice, senza "
        "gergo tecnico, che dicano a Denis (che legge da telefono, non ha il codice davanti) "
        "cosa hai fatto e perche' - niente nomi di variabili o dettagli implementativi a meno "
        "che non siano davvero necessari per capire."
    ) % (proposal["id"], proposal["name"], graph_block, extra_instruction, proposal["proposal_text"])

    result = subprocess.run(
        [str(agent_dir(agent_code) / "run.sh"), "--yes-always", "--no-auto-commits", "--message", message],
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


def extract_non_diff_action(aider_output):
    """SOLO per Alessandro: estrae l'ultima riga 'AZIONE_NON_DIFF:' dal log
    pulito di Aider (stesso file/motivo di extract_human_summary sotto --
    l'output a schermo puo' spezzare la riga). None se non presente (caso
    normale: quasi sempre il fix e' un diff su un file)."""
    if not CHAT_HISTORY_FILE.exists():
        return None
    content = CHAT_HISTORY_FILE.read_text(encoding="utf-8", errors="replace")
    matches = [line.strip()[len("AZIONE_NON_DIFF:"):].strip()
               for line in content.splitlines() if line.strip().startswith("AZIONE_NON_DIFF:")]
    return matches[-1] if matches else None


def create_non_diff_proposal(proposal, action_text):
    """Crea una NUOVA erpv6.agent.proposal (agente Alessandro, incatenata
    a quella che stava eseguendo) quando Alessandro trova un'azione non-diff
    invece di un file da editare -- MAI eseguita da questo script (nessun
    executor di scritture arbitrarie sul DB da un processo esterno non
    presidiato, stesso principio 'nessuna azione con effetto reale senza
    gate umano' di tutto il progetto): resta 'pending_review', Denis la
    vede e decide come per qualunque altra proposta."""
    script = '''
alessandro = env['erpv6.agent.config'].search([('code', '=', 'alessandro')], limit=1)
p = env['erpv6.agent.proposal'].sudo().create({
    'agent_config_id': alessandro.id,
    'name': %r,
    'proposal_text': %r,
    'parent_proposal_id': %d,
    'status': 'pending_review',
})
env.cr.commit()
body = "🧩 Alessandro ha trovato un fix che non e' un file da editare per la proposta #%d:\\n\\n" + %r + "\\n\\nApprovi?"
ok = env['erpv6.agent.telegram.config'].send_proposal_decision_for_agent(alessandro, p.id, body)
print("NON_DIFF_PROPOSAL_ID:%%d" %% p.id)
print("SENT:", ok)
''' % (
        "Alessandro propone un'azione non-diff per la proposta #%d" % proposal["id"],
        "Alessandro (subentrato a Claudio, bloccato) propone questa azione non-diff per la "
        "proposta #%d ('%s'): %s" % (proposal["id"], proposal["name"], action_text),
        proposal["id"],
        proposal["id"],
        action_text,
    )
    subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=script, capture_output=True, text=True, timeout=60,
    )


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
    erpv6_devtools/claudio/safe_exec.sh -- SEMPRE quello, anche quando chi
    ha applicato la modifica e' Alessandro (25/08/2026): riusato, non
    duplicato, stessa infrastruttura di sicurezza per chiunque applichi.
    Richiede CLAUDIO_APPROVED_PROPOSAL_ID (nome storico della variabile,
    invariato apposta per non toccare lo script hardened gia' collaudato:
    rappresenta comunque, in generale, "l'id di una erpv6.agent.proposal
    gia' approvata da Denis", non solo per Claudio) - nessuna promozione
    senza il gate umano tracciabile che quel wrapper impone. Verifica il
    successo REALE sul log (stesso principio 'verifica non narrazione' di
    tutta la sessione: exit code da solo non basta, un warning preesistente
    non correlato puo' far tornare exit 1 anche su successo vero), non si
    fida del solo returncode.

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


def run_argus_verification(agent_name, proposal, touched_files):
    """Fa verificare DAVVERO ad Argus (sola lettura, --edit-format ask
    forzato dal suo run.sh) quello che e' stato applicato e promosso -
    richiesto esplicitamente da Denis il 24/08/2026 ("dovrebbe gia' averla
    promossa e passata a Argus"). Stesso contratto RIASSUNTO TELEGRAM,
    per lo stesso motivo (niente transcript grezzo). agent_name (25/08/2026):
    chi ha applicato davvero (Claudio o Alessandro) -- Argus deve saperlo
    per capire cosa sta verificando, mai un 'Claudio' fisso ora che anche
    Alessandro puo' applicare.

    VERDETTO OK/PROBLEMA (aggiunto 24/08/2026, richiesto esplicitamente:
    "deve essere Argus che mi chiede se va bene lo stesso oppure no") -
    prima Argus scriveva solo un'osservazione senza nessuna conseguenza
    reale nel flusso. Ora un verdetto esplicito, sempre in prima riga,
    permette al chiamante di decidere se serve aprire una nuova proposta
    di correzione o no."""
    files_list = ", ".join(touched_files)
    message = (
        "Sei Argus, QA del sistema erpv6 - SOLA LETTURA sempre, mai scrittura. %s ha applicato e "
        "promosso in produzione la proposta approvata #%d ('%s'). File toccati: "
        "%s. Rileggi ORA il contenuto reale di questi file (non fidarti di conversazioni "
        "precedenti) e verifica che la modifica descritta sia presente e corretta: %s\n\n"
        "IMPORTANTE: la TUA PRIMISSIMA RIGA deve essere esattamente 'VERDETTO: OK' (la modifica "
        "e' presente ed esattamente come richiesto, nessuna discrepanza) oppure "
        "'VERDETTO: PROBLEMA' (manca, e' sbagliata, o non rispetta esattamente quanto chiesto - "
        "anche un dettaglio come la posizione dentro il file conta). Poi termina SEMPRE la "
        "risposta con una riga che inizia esattamente con 'RIASSUNTO TELEGRAM:' seguita da 1-2 "
        "frasi in italiano semplice per Denis (legge da telefono) che spiegano il verdetto."
    ) % (agent_name, proposal["id"], proposal["name"], files_list, proposal["proposal_text"])
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


def create_correction_proposal(agent_code, original_proposal, argus_summary):
    """Crea una nuova erpv6.agent.proposal (STESSO agente che ha applicato
    -- Claudio o Alessandro, incatenata a quella originale) quando Argus
    trova un problema - manda una vera decisione a Denis (bottoni
    Approva/Rifiuta, stesso schema gia' in uso) invece di limitarsi a
    informarlo. Approva = lo stesso agente corregge al giro successivo (la
    proposta rientra nel normale ciclo status='accepted'); Rifiuta = resta
    cosi' com'e', nessuna ulteriore azione.

    Generalizzato il 25/08/2026: usa send_proposal_decision_for_agent
    (fallback su Susanna se l'agente non ha un bot proprio, come
    Alessandro) invece di cercare/chiamare direttamente una configurazione
    Telegram specifica -- prima, per un agente senza bot, questa chiamata
    sarebbe fallita (nessun record trovato, ensure_one() in errore)."""
    script = '''
agent_cfg = env['erpv6.agent.config'].search([('code', '=', %r)], limit=1)
p = env['erpv6.agent.proposal'].sudo().create({
    'agent_config_id': agent_cfg.id,
    'name': 'Correzione su segnalazione di Argus (proposta #%d)',
    'proposal_text': %r,
    'parent_proposal_id': %d,
    'status': 'pending_review',
})
env.cr.commit()
body = "🔍 Argus ha trovato un problema sulla proposta #%d\\n\\n" + %r + "\\n\\nVa bene lo stesso, o vuoi che %s corregga?"
ok = env['erpv6.agent.telegram.config'].send_proposal_decision_for_agent(agent_cfg, p.id, body)
print("CORRECTION_PROPOSAL_ID:%%d" %% p.id)
print("SENT:", ok)
''' % (
        agent_code,
        original_proposal["id"],
        "Argus ha verificato la proposta #%d ('%s') e trovato questo problema: %s\n\nCorreggi in modo che "
        "corrisponda esattamente a quanto richiesto originariamente: %s" % (
            original_proposal["id"], original_proposal["name"], argus_summary, original_proposal["proposal_text"]),
        original_proposal["id"], original_proposal["id"], argus_summary, agent_code.capitalize(),
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
    Si legge quindi da li', prendendo l'ULTIMA occorrenza (Claudio, Argus e
    ora anche Alessandro scrivono nello stesso file, in sequenza, mai in
    parallelo dentro run_once_for_agent)."""
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
    return "(l'agente non ha scritto un riassunto in italiano semplice per questa modifica - controlla il log completo sul VPS.)"


def run_argus_status_check(agent_name, proposal, claudio_output):
    """Fa controllare ad Argus lo stato reale ANCHE quando l'agente non e'
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
        "Sei Argus, QA del sistema erpv6 - SOLA LETTURA sempre, mai scrittura. %s ha provato ad "
        "applicare la proposta #%d ('%s') su %s ma NON ci e' riuscito (errore "
        "tecnico o nessuna modifica trovata - non e' colpa tua verificarne il motivo, solo lo "
        "stato). Rileggi ORA %s e conferma solo se il file e' in uno stato normale/leggibile "
        "(nessuna scrittura parziale o corrotta lasciata a meta').\n\n"
        "IMPORTANTE: termina SEMPRE la risposta con una riga che inizia esattamente con "
        "'RIASSUNTO TELEGRAM:' seguita da 1 frase in italiano semplice per Denis."
    ) % (agent_name, proposal["id"], proposal["name"], target_file, target_file)
    proc = subprocess.run(
        [str(REPO_ROOT / "erpv6_devtools" / "argus" / "run.sh"), "--yes-always", "--message", message],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=180,
    )
    if proc.returncode != 0:
        return "Argus non è riuscito a rispondere neanche lui - verifica manuale consigliata."
    return extract_human_summary(proc.stdout)


def notify_telegram(agent_code, text):
    notify_script = '''
agent_cfg = env['erpv6.agent.config'].search([('code', '=', %r)], limit=1)
ok = env['erpv6.agent.telegram.config'].send_message_for_agent(agent_cfg, %r)
print("TELEGRAM_SENT:", ok)
''' % (agent_code, text)
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


AGENT_DISPLAY_NAMES = {'claudio': 'Claudio', 'alessandro': 'Alessandro'}


def run_once_for_agent(agent_code):
    agent_name = AGENT_DISPLAY_NAMES.get(agent_code, agent_code.capitalize())
    dispatched = load_dispatched(agent_code)
    proposals = query_accepted_proposals(agent_code)
    new_ones = [p for p in proposals if p["id"] not in dispatched]
    if not new_ones:
        print("[watch_proposals] (%s) nessuna nuova proposta approvata da applicare." % agent_code)
        return
    for proposal in new_ones:
        print("[watch_proposals] (%s) applico proposta #%d: %s" % (agent_code, proposal["id"], proposal["name"]))
        dispatched.add(proposal["id"])
        save_dispatched(agent_code, dispatched)  # subito, prima di applicare: mai rielaborare due volte

        success, output, diff = apply_proposal(agent_code, proposal)
        # Messaggio in italiano semplice, non il transcript grezzo del
        # terminale (Denis l'ha segnalato incomprensibile il 24/08/2026) -
        # "lo schermo di Aider" ma raccontato, non incollato cosi' com'e'.
        human_summary = extract_human_summary(output)
        touched_files = [line.split("|")[0].strip() for line in diff.splitlines() if "|" in line]
        non_diff_action = extract_non_diff_action(output) if (agent_code == 'alessandro' and not touched_files) else None
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
                argus_ok, argus_verdict, argus_summary = run_argus_verification(agent_name, proposal, touched_files)
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
                    create_correction_proposal(agent_code, proposal, argus_summary)
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
        elif success and non_diff_action:
            # SOLO Alessandro (25/08/2026): il fix non e' un file da
            # editare -- niente applicato/promosso qui, solo una NUOVA
            # proposta in attesa per Denis (vedi create_non_diff_proposal,
            # stesso gate umano di sempre, nessuna scrittura automatica).
            create_non_diff_proposal(proposal, non_diff_action)
            body = (
                "🧩 Proposta #%d: Alessandro non ha trovato un file da editare, ha proposto "
                "un'azione diversa (voce KB/configurazione) -- ti ho mandato una richiesta "
                "separata per approvarla."
            ) % proposal["id"]
        elif success and not diff:
            argus_check = run_argus_status_check(agent_name, proposal, output)
            body = (
                "Proposta #%d elaborata ma NESSUN file modificato - %s potrebbe non aver "
                "trovato una modifica applicabile diretta, controlla manualmente.\n\n"
                "--- Controllo di Argus ---\n%s"
            ) % (proposal["id"], agent_name, argus_check)
        else:
            argus_check = run_argus_status_check(agent_name, proposal, output)
            body = (
                "Proposta #%d: %s ha restituito un errore, NON applicata. "
                "Controlla manualmente (log completo su questo VPS).\n\n"
                "--- Controllo di Argus ---\n%s"
            ) % (proposal["id"], agent_name, argus_check)
            print(output, file=sys.stderr)
        notify_telegram(agent_code, body)
        print("[watch_proposals] (%s)" % agent_code, body)


def run_once():
    for agent_code in AGENT_CODES:
        try:
            run_once_for_agent(agent_code)
        except Exception as e:
            print("[watch_proposals] errore nel giro di %s, continuo comunque:" % agent_code, e, file=sys.stderr)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--once", action="store_true", help="Un solo giro invece del loop infinito")
    args = p.parse_args()

    if args.once:
        run_once()
        return

    print("[watch_proposals] avviato (agenti: %s), ciclo ogni %ds. Ctrl+C per fermare." % (", ".join(AGENT_CODES), CICLO_SECONDI))
    while True:
        try:
            run_once()
        except Exception as e:
            print("[watch_proposals] errore nel giro, continuo comunque:", e, file=sys.stderr)
        time.sleep(CICLO_SECONDI)


if __name__ == "__main__":
    main()
