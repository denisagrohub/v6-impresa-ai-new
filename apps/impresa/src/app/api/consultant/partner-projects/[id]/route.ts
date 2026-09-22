import { NextRequest, NextResponse } from 'next/server';
import { callOdooAPI } from '@/lib/odoo-adapter';
import { odoo } from '@/lib/odoo/api-adapter';
import { isOdooEnabled } from '@/config/system';

// 22/09/2026: dettaglio progetto per consulente, READ-ONLY.
// 1. Check accesso + mio_compenso via controller JWT (/api/v1/consultant/projects/<id>)
// 2. Se OK, riuso la lettura ricca dell'admin (odoo.execute) e la ritorno
//    filtrata: il consulente vede tutto il progetto MA senza azioni di
//    modifica (charter, upload, invio, aggiungi parte sono bloccate in UI).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    if (!isOdooEnabled()) return NextResponse.json({ error: 'Odoo non configurato' }, { status: 503 });
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Sessione mancante' }, { status: 401 });

    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'ID non valido' }, { status: 400 });

    // STEP 1: check accesso + compenso via controller JWT
    let check: any = null;
    try {
        const r = await callOdooAPI(`/api/v1/consultant/projects/${id}`, {
            method: 'GET', headers: { Authorization: authHeader },
        });
        check = r.data;
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Accesso negato' }, { status: 403 });
    }

    // STEP 2: lettura ricca (stessa logica dell'admin, read-only)
    try {
        await odoo.connect();

        const projects = await odoo.execute('erpv6.tracking.relation', 'search_read', [
            [['id', '=', id]],
            ['id', 'name', 'email_alias', 'partner_id', 'x_v6_charter', 'parent_id',
             'x_v6_scouting', 'funzione_progetto', 'contatto_principale_id', 'state'],
        ]);
        if (!projects || !projects.length) {
            return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 });
        }
        const project = projects[0];

        const children = await odoo.execute('erpv6.tracking.relation', 'search_read', [
            [['parent_id', '=', id]],
            ['id', 'name', 'ruolo', 'partner_id', 'funzione_progetto', 'email_alias',
             'contatto_principale_id', 'ruolo_contatto', 'state', 'stage_id'],
            0, 0, 'name asc',
        ]);
        const allChildren = children || [];

        // email partner+contatto
        const ids = new Set<number>();
        for (const c of allChildren) {
            const pid = Array.isArray(c.partner_id) ? c.partner_id[0] : null;
            const cid = Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[0] : null;
            if (pid) ids.add(pid);
            if (cid) ids.add(cid);
        }
        if (ids.size) {
            const mailRows = await odoo.execute('res.partner', 'search_read', [
                [['id', 'in', Array.from(ids)]], ['id', 'email', 'phone'],
            ]);
            const map: Record<number, any> = {};
            for (const p of mailRows || []) map[p.id] = p;
            for (const c of allChildren) {
                const pid = Array.isArray(c.partner_id) ? c.partner_id[0] : null;
                const cid = Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[0] : null;
                c._partner_email = pid && map[pid] ? map[pid].email : null;
                c._contatto_email = cid && map[cid] ? map[cid].email : null;
            }
        }

        const parts = allChildren.filter((c: any) => c.funzione_progetto !== 'target');
        const targets = allChildren.filter((c: any) => c.funzione_progetto === 'target');

        // target contacts (per la lista Persone)
        const targetContacts: any[] = [];
        for (const t of targets) {
            const cid = Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[0] : null;
            if (cid) {
                targetContacts.push({
                    id: cid,
                    name: Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[1] : '',
                    ruolo: t.ruolo_contatto || null,
                    funzione_progetto: 'referente_tecnico',
                    partnerId: cid,
                    partnerName: Array.isArray(t.contatto_principale_id) ? t.contatto_principale_id[1] : '',
                    partnerEmail: null,
                    contattoEmail: null,
                    contattoId: null,
                    contattoName: null,
                    ruoloContatto: t.ruolo_contatto || null,
                    state: 'attivo',
                    _fromTargetId: t.id,
                    _fromTargetName: t.name || null,
                    _fromTargetPartnerName: Array.isArray(t.partner_id) ? t.partner_id[1] : null,
                });
            }
        }
        if (targetContacts.length) {
            const cids = targetContacts.map((c) => c.id);
            const mails = await odoo.execute('res.partner', 'search_read', [
                [['id', 'in', cids]], ['id', 'name', 'email', 'phone'],
            ]);
            const m: Record<number, any> = {};
            for (const p of mails || []) m[p.id] = p;
            for (const c of targetContacts) {
                const i = m[c.id];
                if (i) {
                    c.partnerEmail = i.email;
                    c.contattoEmail = i.email;
                    c.partnerPhone = i.phone;
                    c.partnerName = i.name || c.partnerName;
                    c.name = i.name || c.name;
                }
            }
        }

        // emails progetto (tutte)
        const relationIds = [id, ...allChildren.map((c: any) => c.id)];
        const emails = await odoo.execute('erpv6.project.email.log', 'search_read', [
            [['relation_id', 'in', relationIds]],
            ['id', 'name', 'sender_email', 'recipient_emails', 'cc_emails',
             'match_status', 'direction', 'create_date'],
            0, 100, 'create_date desc',
        ]);

        // anche email in winwin.email.log (log consulente personale)
        let emailsWinwin: any[] = [];
        try {
            emailsWinwin = await odoo.execute('erpv6.winwin.email.log', 'search_read', [
                [['relation_id', 'in', relationIds]],
                ['id', 'name', 'sender_email', 'recipient_emails', 'cc_emails',
                 'direction', 'create_date', 'is_read'],
                0, 50, 'create_date desc',
            ]);
        } catch { /* best effort */ }

        let charter = null;
        try { charter = project.x_v6_charter ? JSON.parse(project.x_v6_charter) : null; } catch {}
        let scouting = null;
        try { scouting = project.x_v6_scouting ? JSON.parse(project.x_v6_scouting) : null; } catch {}

        const hasPipelineBoard = targets.length > 0;

        return NextResponse.json({
            id: project.id,
            name: project.name,
            emailAlias: project.email_alias ? `${project.email_alias}@v6sviluppoimpresa.it` : null,
            charter,
            relationScouting: scouting,
            funzione_progetto: project.funzione_progetto || null,
            contatto_principale_id: Array.isArray(project.contatto_principale_id) ? project.contatto_principale_id[0] : null,
            state: project.state || 'attivo',
            hasPipelineBoard,
            parent_id: Array.isArray(project.parent_id) ? project.parent_id[0] : null,

            is_admin: check.is_admin || false,
            project_phase: check.project_phase || project.state,
            mio_compenso: check.mio_compenso || null,

            partners: [...parts, ...targetContacts].map((c: any) => ({
                id: c.id,
                name: c.name,
                ruolo: c.ruolo || null,
                funzione_progetto: c.funzione_progetto || null,
                partnerId: Array.isArray(c.partner_id) ? c.partner_id[0] : null,
                partnerName: Array.isArray(c.partner_id) ? c.partner_id[1] : null,
                partnerEmail: c._partner_email || null,
                contattoEmail: c._contatto_email || null,
                contattoId: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[0] : null,
                contattoName: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[1] : null,
                ruoloContatto: c.ruolo_contatto || null,
                state: c.state || 'attivo',
                fromTargetId: c._fromTargetId || null,
                fromTargetName: c._fromTargetName || null,
                fromTargetPartnerName: c._fromTargetPartnerName || null,
            })),

            targets: targets.map((c: any) => ({
                id: c.id,
                name: c.name,
                partnerName: Array.isArray(c.partner_id) ? c.partner_id[1] : null,
                partnerEmail: c._partner_email || null,
                contattoName: Array.isArray(c.contatto_principale_id) ? c.contatto_principale_id[1] : null,
                contattoEmail: c._contatto_email || null,
                stageId: Array.isArray(c.stage_id) ? c.stage_id[0] : null,
                state: c.state || 'attivo',
            })),

            emails: [
                ...(emails || []).map((e: any) => ({
                    id: e.id, subject: e.name, senderEmail: e.sender_email || '',
                    recipientEmails: e.recipient_emails || '', ccEmails: e.cc_emails || '',
                    direction: e.direction || 'ricevuta', date: e.create_date,
                    source: 'project',
                })),
                ...(emailsWinwin || []).map((e: any) => ({
                    id: e.id, subject: e.name, senderEmail: e.sender_email || '',
                    recipientEmails: e.recipient_emails || '', ccEmails: e.cc_emails || '',
                    direction: e.direction || 'ricevuta', date: e.create_date,
                    isRead: e.is_read, source: 'winwin',
                })),
            ].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Errore lettura progetto' }, { status: 502 });
    }
}
