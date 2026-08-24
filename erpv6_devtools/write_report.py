#!/usr/bin/env python3
"""Claudio e Argus scrivono DAVVERO in Odoo con questo script, invece di
limitarsi a rispondere in chat (richiesto esplicitamente da Denis il
24/08/2026: "Claudio deve scrivere come Argus", "io dove leggo la risposta
di Claudio... se non la vedo immediatamente non posso dare conferma").

Crea SEMPRE una coppia collegata:
- erpv6.agent.proposal (il gate umano: Denis apre, accetta/rifiuta) -- se
  agganciata a una proposta precedente (Kaizen che sta verificando/
  correggendo), passare --parent-proposal-id.
- erpv6.agent.communication (instradamento Heinrich: grave -> diretto a
  Denis, near_miss/lieve -> passa da Susanna, che ora avvisa ANCHE su
  Telegram subito, non solo dopo l'escalation).

Uso:
  python3 erpv6_devtools/write_report.py \\
    --agent claudio \\
    --title "Verifica proposta Kaizen #1" \\
    --proposal-text "..." \\
    --based-on "..." \\
    --parent-proposal-id 1 \\
    --res-model erpv6.kaizen.manual_report --res-id 0 \\
    --action "Verifica tecnica su richiesta di Denis" \\
    --problem "La proposta Kaizen assume un collegamento a piu' sessioni non supportato dal modello" \\
    --severity lieve \\
    --outcome "Relazione tecnica su cosa serve per rendere realizzabile la proposta" \\
    --risk "La proposta resta inapplicabile cosi' com'e'" \\
    --improvement "Aggiungere un campo Many2many a erpv6.kaizen.manual_report" \\
    --technical-report-file /tmp/relazione_completa.md
"""
import argparse
import json
import subprocess
import sys

SHELL_SCRIPT_TEMPLATE = r'''
import json
data = json.loads(r"""%s""")

agent = env['erpv6.agent.config'].search([('code', '=', data['agent'])], limit=1)
if not agent:
    print("ERRORE: agente '%%s' non trovato" %% data['agent'])
    raise SystemExit(1)

technical_report_id = False
if data.get('technical_report_content'):
    category = env['erpv6.kb.category'].search([('name', 'ilike', 'Conoscenza Agente')], limit=1)
    doc = env['erpv6.library.document'].sudo().create({
        'name': data['title'],
        'category': 'agent_knowledge',
        'file_name': '%%s.md' %% data['title'][:60],
    })
    doc.message_post(body=data['technical_report_content'])
    technical_report_id = doc.id

proposal_vals = {
    'agent_config_id': agent.id,
    'name': data['title'],
    'proposal_text': data['proposal_text'],
    'based_on': data.get('based_on') or '',
}
if data.get('parent_proposal_id'):
    proposal_vals['parent_proposal_id'] = data['parent_proposal_id']
if technical_report_id:
    proposal_vals['technical_report_id'] = technical_report_id
proposal = env['erpv6.agent.proposal'].sudo().create(proposal_vals)
env.cr.commit()
print("PROPOSAL_CREATED:%%d" %% proposal.id)

reviewer = env['res.users'].browse(2)
comm_vals = {
    'agent_config_id': agent.id,
    'action_in_progress': data['action'],
    'problem_description': data['problem'],
    'heinrich_severity': data['severity'],
    'outcome_if_resolved': data['outcome'],
    'risk_if_nothing_done': data['risk'],
    'proposed_improvement': data['improvement'],
    'reviewer_user_id': reviewer.id,
    'res_model': 'erpv6.agent.proposal',
    'res_id': proposal.id,
}
comm = env['erpv6.agent.communication'].sudo().create_and_route(comm_vals)
env.cr.commit()
print("COMMUNICATION_CREATED:%%d" %% comm.id)
print("ROUTING_STATE:%%s" %% comm.routing_state)
'''


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--agent", required=True, choices=["claudio", "argus"])
    p.add_argument("--title", required=True)
    p.add_argument("--proposal-text", required=True)
    p.add_argument("--based-on", default="")
    p.add_argument("--parent-proposal-id", type=int)
    p.add_argument("--res-model", required=True)
    p.add_argument("--res-id", type=int, required=True)
    p.add_argument("--action", required=True)
    p.add_argument("--problem", required=True)
    p.add_argument("--severity", required=True, choices=["near_miss", "lieve", "grave"])
    p.add_argument("--outcome", required=True)
    p.add_argument("--risk", required=True)
    p.add_argument("--improvement", required=True)
    p.add_argument("--technical-report-file", help="File con la relazione tecnica completa (opzionale)")
    args = p.parse_args()

    technical_report_content = None
    if args.technical_report_file:
        with open(args.technical_report_file, encoding="utf-8") as f:
            technical_report_content = f.read()

    data = {
        "agent": args.agent, "title": args.title, "proposal_text": args.proposal_text,
        "based_on": args.based_on, "parent_proposal_id": args.parent_proposal_id,
        "action": args.action, "problem": args.problem, "severity": args.severity,
        "outcome": args.outcome, "risk": args.risk, "improvement": args.improvement,
        "technical_report_content": technical_report_content,
    }
    data_json = json.dumps(data)
    script = SHELL_SCRIPT_TEMPLATE % data_json

    result = subprocess.run(
        ["docker", "exec", "-i", "odoo", "odoo", "shell", "-d", "erpv6", "--no-http"],
        input=script, capture_output=True, text=True, timeout=60,
    )
    print(result.stdout)
    if "COMMUNICATION_CREATED" not in result.stdout:
        print("ERRORE: scrittura fallita, vedi output sopra. stderr:", file=sys.stderr)
        print(result.stderr[-2000:], file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
