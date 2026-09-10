import { Brain } from "lucide-react";
import ComingSoon from "@/components/admin/ComingSoon";

export default function AdminKbPage() {
    return (
        <ComingSoon
            icon={Brain}
            title="Knowledge Base"
            description="Gestione delle voci e delle richieste KB da qui è in arrivo. Le richieste esistenti restano gestibili da Odoo nel frattempo."
        />
    );
}
