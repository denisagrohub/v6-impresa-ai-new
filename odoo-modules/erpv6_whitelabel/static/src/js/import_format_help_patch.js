/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { BaseImportModel } from "@base_import/import_model";

patch(BaseImportModel.prototype, {
    _getCSVFormattingOptions() {
        const options = super._getCSVFormattingOptions();
        options.date_format.help = _t(
            "Use YYYY to represent the year, MM for the month and DD for the day. Include separators such as a dot, forward slash or dash. You can use a custom format in addition to the suggestions provided. Leave empty to let ERPV6 guess the format (recommended)"
        );
        options.datetime_format.help = _t(
            "Use HH for hours in a 24h system, use II in conjonction with 'p' for a 12h system. You can use a custom format in addition to the suggestions provided. Leave empty to let ERPV6 guess the format (recommended)"
        );
        return options;
    },
});
