/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import {
    ErrorDialog,
    ClientErrorDialog,
    NetworkErrorDialog,
    RPCErrorDialog,
    WarningDialog,
    RedirectWarningDialog,
    odooExceptionTitleMap,
} from "@web/core/errors/error_dialogs";
import { capitalize } from "@web/core/utils/strings";

ErrorDialog.title = _t("ERPV6 Error");
ClientErrorDialog.title = _t("ERPV6 Client Error");
NetworkErrorDialog.title = _t("ERPV6 Network Error");

patch(RPCErrorDialog.prototype, {
    inferTitle() {
        super.inferTitle();
        if (this.props.exceptionName && odooExceptionTitleMap.has(this.props.exceptionName)) {
            return;
        }
        switch (this.props.type) {
            case "server":
                this.title = _t("ERPV6 Server Error");
                break;
            case "script":
                this.title = _t("ERPV6 Client Error");
                break;
            case "network":
                this.title = _t("ERPV6 Network Error");
                break;
        }
    },
});

patch(WarningDialog.prototype, {
    inferTitle() {
        if (this.props.exceptionName && odooExceptionTitleMap.has(this.props.exceptionName)) {
            return odooExceptionTitleMap.get(this.props.exceptionName).toString();
        }
        return this.props.title || _t("ERPV6 Warning");
    },
});

patch(RedirectWarningDialog.prototype, {
    setup() {
        super.setup();
        if (!capitalize(this.props.subType)) {
            this.title = _t("ERPV6 Warning");
        }
    },
});
