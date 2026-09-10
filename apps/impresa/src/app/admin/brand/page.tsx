import { Palette } from "lucide-react";
import ComingSoon from "@/components/admin/ComingSoon";

export default function AdminBrandPage() {
    return (
        <ComingSoon
            icon={Palette}
            title="Brand Projects"
            description="La gestione dei progetti brand da qui è in arrivo. I progetti esistenti restano gestibili da Odoo nel frattempo."
        />
    );
}
