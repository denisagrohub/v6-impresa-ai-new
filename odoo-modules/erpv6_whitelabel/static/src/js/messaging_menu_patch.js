/** @odoo-module **/

import { MessagingMenu } from "@mail/core/public_web/messaging_menu";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

/* Scheda "Install Odoo" nel pannello notifiche Discuss (prompt PWA), in
 * @mail/core/web/messaging_menu_patch.js: displayName è hardcoded nel
 * getter installationRequest, non in un template QWeb. Sovrascriviamo solo
 * il testo per ora — icona (iconSrc, oggi l'avatar di OdooBot) da
 * aggiornare in un secondo momento quando disponibile. */
patch(MessagingMenu.prototype, {
    get installationRequest() {
        return {
            ...super.installationRequest,
            displayName: _t("Install ERPV6"),
        };
    },
});
