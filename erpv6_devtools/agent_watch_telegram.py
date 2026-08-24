#!/usr/bin/env python3
"""Ascolto Telegram DEDICATO e immediato, generico per QUALUNQUE agente
(24/08/2026 - generalizzato dalla versione hardcoded per Susanna dopo che
Denis ha chiesto lo stesso per Claudio: "per Claudio Telegram diventa il
mio schermo di Aider", e ha segnalato conferme in ritardo perche' Claudio
usava solo il cron condiviso ogni 2 minuti). Usa il long-polling nativo di
Telegram (getUpdates con timeout=25s: la richiesta resta aperta finche' non
arriva un messaggio vero, invece di un giro a intervalli fissi) - risposta
quasi istantanea, non un controllo periodico piu' frequente.

Il lavoro vero (decifrare il token, capire chi ha scritto, generare la
risposta o gestire approva/rifiuta) resta DENTRO Odoo
(erpv6.agent.telegram.config._poll_updates(), gia' scritto e testato) -
questo script sa SOLO quando svegliarlo: fa un getUpdates diretto (senza
processare nulla) solo per accorgersi che e' arrivato qualcosa, poi
delega subito a _poll_updates() reale via odoo shell.

Uso: python3 erpv6_devtools/agent_watch_telegram.py --agent susanna
     python3 erpv6_devtools/agent_watch_telegram.py --agent claudio
Da lasciare girare in background (nohup/systemd), un processo per agente.
"""
import argparse
import subprocess
import sys
import time

import requests

TELEGRAM_API = "https://api.telegram.org/bot%s/getUpdates"
LONG_POLL_TIMEOUT = 25


def get_token(agent_code):
    """Decifra il token SOLO qui, una volta, tramite Odoo (mai duplicare la
    chiave in chiaro in un secondo file .env - un'unica fonte di verita',
    la stessa cifratura gia' usata da erpv6.agent.telegram.config)."""
    script = '''
cfg = env['erpv6.agent.telegram.config'].search([
    ('agent_config_id.code', '=', %r), ('is_active', '=', True),
], limit=1)
if cfg:
    print("TOKEN:" + cfg.get_decrypted_bot_token())
''' % agent_code
    result = subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=script, capture_output=True, text=True, timeout=60,
    )
    for line in result.stdout.splitlines():
        if line.startswith("TOKEN:"):
            return line[len("TOKEN:"):].strip()
    return None


def trigger_odoo_poll(agent_code):
    script = '''
cfg = env['erpv6.agent.telegram.config'].search([
    ('agent_config_id.code', '=', %r), ('is_active', '=', True),
], limit=1)
if cfg:
    cfg._poll_updates()
    env.cr.commit()
    print("POLLED_OK")
else:
    print("NESSUNA_CONFIG_ATTIVA")
''' % agent_code
    result = subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=script, capture_output=True, text=True, timeout=60,
    )
    if "POLLED_OK" not in result.stdout:
        print("[agent_watch:%s] ATTENZIONE: trigger poll non confermato:" % agent_code,
              result.stdout[-500:], file=sys.stderr)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--agent", required=True, help="Codice agente, es. susanna, claudio")
    args = p.parse_args()

    token = get_token(args.agent)
    if not token:
        print("[agent_watch:%s] Nessuna configurazione Telegram attiva, esco." % args.agent, file=sys.stderr)
        sys.exit(1)

    print("[agent_watch:%s] avviato, long-polling attivo (timeout %ds). Ctrl+C per fermare."
          % (args.agent, LONG_POLL_TIMEOUT))
    offset = 0
    while True:
        try:
            response = requests.get(
                TELEGRAM_API % token,
                params={"offset": offset + 1, "timeout": LONG_POLL_TIMEOUT},
                timeout=LONG_POLL_TIMEOUT + 10,
            )
            payload = response.json()
            if not payload.get("ok"):
                print("[agent_watch:%s] getUpdates non ok:" % args.agent, payload, file=sys.stderr)
                time.sleep(5)
                continue
            results = payload.get("result") or []
            if results:
                offset = max(u.get("update_id", offset) for u in results)
                print("[agent_watch:%s] nuovo evento rilevato, delego a Odoo (_poll_updates reale)..." % args.agent)
                trigger_odoo_poll(args.agent)
        except requests.exceptions.Timeout:
            continue  # normale: nessun messaggio entro il timeout, si riprova subito
        except Exception as e:
            print("[agent_watch:%s] errore, riprovo tra 5s:" % args.agent, e, file=sys.stderr)
            time.sleep(5)


if __name__ == "__main__":
    main()
