/** @odoo-module **/

import { registry } from "@web/core/registry";

/* La voce "My Odoo.com account" (id "odoo_account" in
 * @web/core/webclient/user_menu/user_menu_items.js) chiama sempre
 * /web/session/account, che ritorna incondizionatamente un URL OAuth verso
 * accounts.odoo.com (web/controllers/session.py, nessun fallback/nessuna
 * condizione). Su un deploy self-hosted white-label non esiste un account
 * Odoo.com collegato: rietichettarla lascerebbe comunque un link fuorviante,
 * quindi la voce viene rimossa invece che rinominata. */
registry.category("user_menuitems").remove("odoo_account");
