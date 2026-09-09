/** @odoo-module **/
// Dashboard Consulente Win-Win (06/09/2026, prompt "Trigger progetto +
// Dashboard consulente + Email per-progetto"). PRIMO componente OWL di
// questo progetto (confermato in Fase 0: nessun pattern OWL preesistente
// da riusare) - pensato esplicitamente come riferimento per la prossima
// dashboard OWL che si costruira' (es. TEE, se mai rifatta).
//
// Struttura del pattern (per chi lo riusera' come riferimento):
//   - static/src/js/<nome>.js    componente OWL + registrazione azione
//   - static/src/xml/<nome>.xml  template OWL (t-name deve combaciare
//                                 con Component.template)
//   - static/src/scss/<nome>.scss  variabili palette + stili scoped
//   - manifest 'assets': { 'web.assets_backend': [...] }
//   - registrato come <record model="ir.actions.client" tag="...">,
//     mai un ir.actions.act_window per un componente OWL puro.
//
// Endpoint dati SEPARATI dalla vista (mai logica intrecciata nel
// componente): erpv6.booking.token.get_richieste_in_arrivo() e
// erpv6.production.order.get_miei_progetti(), entrambi @api.model,
// cosi' un domani un frontend esterno (Next.js, "un motore due
// presentazioni" - stesso principio gia' applicato altrove nel
// progetto) puo' chiamare la stessa logica senza duplicarla - Fase
// futura, non costruita qui.
import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class WinwinConsultantDashboard extends Component {
    static template = "erpv6_winwin_renderdata.WinwinConsultantDashboard";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.state = useState({
            tab: "richieste",
            richieste: [],
            progetti: [],
            relazioni: [],
            loading: true,
            expandedId: null,
            expandedRelazioneId: null,
            error: "",
            // Tab Amministrazione (07/09/2026, prompt "Dashboard: quarta
            // tab Amministrazione, solo group_system") - isAdmin arriva
            // SEMPRE da una chiamata server (is_admin_user()), mai da una
            // deduzione lato client: e' il valore che decide se la tab
            // esiste nel DOM, non solo se e' visibile via CSS.
            isAdmin: false,
            adminData: null,
            newConsultant: { userId: "", brandId: "" },
            newReferral: { name: "", email: "", phone: "" },
            adminMessage: "",
            // 09/09/2026 (prompt "Candidatura partnership...", Parte A
            // punto 4): coda candidature dentro la stessa tab
            // Amministrazione, stesso pattern di adminData sopra.
            expandedCandidacyId: null,
        });
        onWillStart(() => this.loadAll());
    }

    async loadAll() {
        this.state.loading = true;
        this.state.error = "";
        try {
            const [richieste, progetti, relazioni, isAdmin] = await Promise.all([
                this.orm.call("erpv6.booking.token", "get_richieste_in_arrivo", []),
                this.orm.call("erpv6.production.order", "get_miei_progetti", []),
                this.orm.call("erpv6.tracking.relation", "get_miei_progetti_generici", []),
                this.orm.call("res.users", "is_admin_user", []),
            ]);
            this.state.richieste = richieste;
            this.state.progetti = progetti;
            this.state.relazioni = relazioni;
            this.state.isAdmin = isAdmin;
            if (isAdmin) {
                this.state.adminData = await this.orm.call("res.users", "get_admin_dashboard_data", []);
            }
        } catch (e) {
            this.state.error = (e && e.message) || "Errore di caricamento";
        } finally {
            this.state.loading = false;
        }
    }

    async reloadAdminData() {
        this.state.adminData = await this.orm.call("res.users", "get_admin_dashboard_data", []);
    }

    async createConsultant() {
        this.state.adminMessage = "";
        const { userId, brandId } = this.state.newConsultant;
        if (!userId || !brandId) {
            this.state.adminMessage = "Seleziona utente e brand.";
            return;
        }
        try {
            await this.orm.call("erpv6.consulting.consultant", "action_create_from_dashboard", [
                parseInt(userId, 10),
                parseInt(brandId, 10),
            ]);
            this.state.newConsultant = { userId: "", brandId: "" };
            await this.reloadAdminData();
            this.state.adminMessage = "Consulente creato.";
        } catch (e) {
            this.state.adminMessage = (e && e.message) || "Errore durante la creazione del consulente";
        }
    }

    async createReferral() {
        this.state.adminMessage = "";
        const { name, email, phone } = this.state.newReferral;
        if (!name || !name.trim()) {
            this.state.adminMessage = "Il nome e' obbligatorio.";
            return;
        }
        try {
            const result = await this.orm.call("res.partner", "action_create_referral", [name, email, phone]);
            this.state.newReferral = { name: "", email: "", phone: "" };
            await this.reloadAdminData();
            this.state.adminMessage = result.created
                ? "Referral creato."
                : "Referral gia' esistente, collegato/aggiornato.";
        } catch (e) {
            this.state.adminMessage = (e && e.message) || "Errore durante la registrazione del referral";
        }
    }

    setTab(tab) {
        this.state.tab = tab;
    }

    toggleExpandCandidacy(id) {
        this.state.expandedCandidacyId = this.state.expandedCandidacyId === id ? null : id;
    }

    async setCandidacyState(candidacyId, newState) {
        this.state.adminMessage = "";
        try {
            await this.orm.call("erpv6.partnership.candidacy", "action_set_state_from_dashboard", [
                candidacyId,
                newState,
            ]);
            await this.reloadAdminData();
        } catch (e) {
            this.state.adminMessage = (e && e.message) || "Errore durante il cambio di stato della candidatura";
        }
    }

    toggleExpand(id) {
        this.state.expandedId = this.state.expandedId === id ? null : id;
    }

    toggleExpandRelazione(id) {
        this.state.expandedRelazioneId = this.state.expandedRelazioneId === id ? null : id;
    }

    // 07/09/2026 (fix mobile, problema 2 - "i progetti non si aprono"):
    // oltre al toggle inline (sopra), un'azione esplicita e affidabile che
    // apre DAVVERO la scheda nativa Odoo del record - non dipende dal
    // toggle di stato locale, quindi resta un modo garantito di "aprire
    // il progetto" anche se l'espansione inline avesse un problema di
    // interazione (es. tocco su mobile). Riusa il modello gia' esistente,
    // nessuna vista nuova creata.
    openProductionOrder(id) {
        this.actionService.doAction({
            type: "ir.actions.act_window",
            res_model: "erpv6.production.order",
            res_id: id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    openTrackingRelation(id) {
        this.actionService.doAction({
            type: "ir.actions.act_window",
            res_model: "erpv6.tracking.relation",
            res_id: id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    // 07/09/2026 (fix, problema 3 - "le notifiche non si cancellano"):
    // segna come lette (mail.notification nativa) le notifiche del nodo,
    // poi ricarica i dati cosi' il badge sparisce senza refresh manuale.
    async markNotificationsRead(relationRootId) {
        if (!relationRootId) {
            return;
        }
        await this.orm.call("erpv6.tracking.relation", "mark_notifications_read", [[relationRootId]]);
        await this.loadAll();
    }

    async prendiInCarico(tokenId) {
        try {
            const result = await this.orm.call(
                "erpv6.booking.token",
                "action_prendi_in_carico",
                [[tokenId]]
            );
            await this.loadAll();
            this.state.tab = "progetti";
            if (result && result.res_model) {
                this.actionService.doAction(result);
            }
        } catch (e) {
            this.state.error = (e && e.message) || "Errore durante la presa in carico";
        }
    }
}

registry.category("actions").add("winwin_consultant_dashboard", WinwinConsultantDashboard);
