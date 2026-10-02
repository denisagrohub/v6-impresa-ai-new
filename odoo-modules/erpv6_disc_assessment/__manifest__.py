{
    'name': 'ERP V6 - DISC Assessment (dipendenti + controparti)',
    'version': '18.0.1.1.0',
    'category': 'V6 Impresa AI',
    'summary': 'Adaptive EOSv6: DISC dipendenti (intervista) + controparti (inferito)',
    'description': """
        Modulo DISC.

        FASE A (dipendenti): intervista minima (banco domande campione)
        -> Motore IPO 'disc_interview_score' (KB-driven) -> risultato
        su res.users via Output Binding.

        FASE B (controparti B2B, C1b-DISC 02/10/2026): inferenza
        PASSIVA del profilo DISC da contesto (email, deal.event, note,
        charter, scouting) su res.partner. Modello separato
        erpv6.partner.disc_profile con versioning + evidence + revoca.

        Guardrail G1-G7:
        - G1 visibilità solo admin/chief
        - G2 nessuna decisione automatica (solo aiuto informativo)
        - G3 evidence sempre citata
        - G4 log completo
        - G5 versioning
        - G6 revoca
        - G7 automatica solo per controparti B2B (persone fisiche
          senza legame business richiedono force esplicito)

        Regola di prodotto (ADDENDUM.md S.3): "DISC sempre output,
        MAI client-facing".
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'erpv6_kb',
        'erpv6_omni_bridge',
        'aeosv6_relation',
        'aeosv6_project_relay',
        'erpv6_winwin_renderdata',
        'erpv6_core',
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/disc_profile_security.xml',
        'data/ir_cron_disc.xml',
        'views/disc_wizard_views.xml',
        'views/partner_disc_profile_views.xml',
        'views/res_partner_ext_views.xml',
    ],
    'installable': True,
    'application': False,
}
