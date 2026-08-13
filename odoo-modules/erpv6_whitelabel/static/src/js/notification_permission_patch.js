/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { reactive } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import {
    isAndroidApp,
    isDisplayStandalone,
    isIOS,
    isIosApp,
} from "@web/core/browser/feature_detection";
import { notificationPermissionService } from "@mail/core/common/notification_permission_service";

async function getIosPwaPermission() {
    if (browser.location.protocol !== "https:") {
        return "denied";
    }
    const registration = await browser.navigator.serviceWorker?.getRegistration();
    return (await registration?.pushManager.permissionState()) ?? "prompt";
}

/* I due toast "Odoo will (not) send notifications..." vengono generati
 * dentro requestPermission, una closure creata all'interno di start()
 * stesso: patchare solo un metodo esterno non basta a intercettarli senza
 * duplicare il corpo. start() è quindi reimplementato per intero, identico
 * all'originale (@mail/core/common/notification_permission_service.js),
 * cambiando solo le due stringhe dei toast. */
patch(notificationPermissionService, {
    async start(env, services) {
        const notification = services.notification;
        let permission;
        try {
            if (isIOS() && isDisplayStandalone()) {
                permission = { state: await getIosPwaPermission() };
            } else if (isIOS()) {
                permission = { state: "denied" };
            } else {
                permission = await browser.navigator?.permissions?.query({
                    name: "notifications",
                });
            }
        } catch {
            // noop
        }
        const state = reactive({
            /** @type {"prompt" | "granted" | "denied"} */
            permission:
                isIosApp() || isAndroidApp()
                    ? "denied"
                    : this._normalizePermission(
                          permission?.state ?? browser.Notification?.permission
                      ),
            requestPermission: async () => {
                if (browser.Notification && state.permission === "prompt") {
                    state.permission = this._normalizePermission(
                        await browser.Notification.requestPermission()
                    );
                    if (state.permission === "denied") {
                        notification.add(_t("ERPV6 will not send notifications on this device."), {
                            type: "warning",
                            title: _t("Notifications blocked"),
                        });
                    } else if (state.permission === "granted") {
                        notification.add(_t("ERPV6 will send notifications on this device!"), {
                            type: "success",
                            title: _t("Notifications allowed"),
                        });
                    }
                }
            },
        });
        if (permission && !isIOS()) {
            permission.addEventListener("change", () => (state.permission = permission.state));
        }
        return state;
    },
});
