/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { registry } from "@web/core/registry";
import { markup } from "@odoo/owl";

/* I testi da correggere sono nello step di due tour onboarding (CRM e
 * Project), registrati con steps come funzione (steps: () => [...]) che
 * ricalcola l'array ad ogni chiamata: non basta mutare l'oggetto una volta
 * a tempo di caricamento. Inoltre i moduli crm/project non dipendono da
 * erpv6_whitelabel, quindi non c'è garanzia che il loro registry.add() sia
 * già stato eseguito quando il nostro modulo viene valutato. Patchiamo
 * quindi get() sulla sotto-registry "web_tour.tours" stessa: la
 * riscrittura avviene quando il tour viene davvero letto (a tour avviato),
 * ben dopo il boot completo, indipendentemente dall'ordine di
 * registrazione. */

const REPLACEMENTS = [
    ["Odoo will save all modifications as you navigate.", "ERPV6 will save all modifications as you navigate."],
    ["Odoo will automatically save it as you navigate.", "ERPV6 will automatically save it as you navigate."],
];

function rebrandText(text) {
    for (const [from, to] of REPLACEMENTS) {
        if (text.includes(from)) {
            return text.split(from).join(to);
        }
    }
    return null;
}

function rebrandStep(step) {
    if (step && step.content != null) {
        const text = step.content.toString();
        const rebranded = rebrandText(text);
        if (rebranded !== null) {
            step.content = markup(rebranded);
        }
    }
    return step;
}

function rebrandTourDef(tourDef) {
    if (!tourDef || typeof tourDef.steps !== "function") {
        return tourDef;
    }
    const originalSteps = tourDef.steps;
    return {
        ...tourDef,
        steps: (...args) => originalSteps.apply(tourDef, args).map(rebrandStep),
    };
}

const TARGET_TOURS = new Set(["crm_tour", "project_tour"]);

patch(registry.category("web_tour.tours"), {
    get(key, ...args) {
        const tourDef = super.get(key, ...args);
        return TARGET_TOURS.has(key) ? rebrandTourDef(tourDef) : tourDef;
    },
});
