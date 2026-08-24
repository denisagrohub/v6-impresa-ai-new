#!/usr/bin/env python3
"""Copia il registro attività di Claudio/Argus (memoria di Claude Code,
project_claudio_argus_activity_log.md) dentro Odoo, come UNA voce erpv6.kb
sempre aggiornata (categoria "Registro Attività Agenti Esterni",
kb_category_agent_external_log) -- cosi' resta visibile a Denis/Sabrina
dall'interfaccia, non solo su file.

Uso: python3 erpv6_devtools/agent_log_sync.py
Da lanciare da Claudio o Argus dopo aver aggiunto una voce al log, prima di
chiudere la sessione di lavoro -- non e' automatico, e' un passo esplicito
(stesso principio "scrivi cosa hai fatto" gia' richiesto da Denis).
"""
import json
import subprocess
import sys

LOG_FILE = "/home/erpv6admin/.claude/projects/-home-erpv6admin-erpv6-src/memory/project_claudio_argus_activity_log.md"
KB_ENTRY_NAME = "Registro Attività Agenti Esterni (sync automatico)"
CATEGORY_XMLID = "erpv6_agent.kb_category_agent_external_log"

SHELL_SCRIPT_TEMPLATE = '''
import json
content = json.loads(r\'\'\'%s\'\'\')
category = env.ref('%s', raise_if_not_found=False)
if not category:
    print("ERRORE: categoria %s non trovata - il modulo erpv6_agent e' promosso con l'ultima versione?")
else:
    kb = env['erpv6.kb'].sudo().search([('name', '=', %r), ('kb_type', '=', 'metodo_v6')], limit=1)
    vals = {
        'name': %r,
        'kb_type': 'metodo_v6',
        'category_id': category.id,
        'content': content,
        'content_format': 'markdown',
        'access_level': 'admin',
        'is_active': True,
    }
    if kb:
        kb.write(vals)
        print("AGGIORNATA: erpv6.kb #%%d" %% kb.id)
    else:
        kb = env['erpv6.kb'].sudo().create(vals)
        env.cr.commit()
        print("CREATA: erpv6.kb #%%d" %% kb.id)
    env.cr.commit()
'''


def main():
    try:
        with open(LOG_FILE, encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print("ERRORE: %s non trovato." % LOG_FILE, file=sys.stderr)
        sys.exit(1)

    # json.dumps per un embedding sicuro (mai fidarsi di f-string/format
    # diretto su testo libero che puo' contenere virgolette/backslash).
    content_json = json.dumps(content)
    script = SHELL_SCRIPT_TEMPLATE % (content_json, CATEGORY_XMLID, CATEGORY_XMLID, KB_ENTRY_NAME, KB_ENTRY_NAME)

    result = subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=script, capture_output=True, text=True, timeout=60,
    )
    print(result.stdout)
    if "AGGIORNATA" not in result.stdout and "CREATA" not in result.stdout:
        print("ATTENZIONE: sync forse fallita, output completo sopra. stderr:", file=sys.stderr)
        print(result.stderr[-2000:], file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
