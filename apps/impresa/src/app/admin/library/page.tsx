import { FileText } from "lucide-react";
import ComingSoon from "@/components/admin/ComingSoon";

export default function AdminLibraryPage() {
    return (
        <ComingSoon
            icon={FileText}
            title="Libreria"
            description="La vista dei documenti di libreria (inclusi quelli certificati) da qui è in arrivo. I documenti esistenti restano gestibili da Odoo nel frattempo."
        />
    );
}
