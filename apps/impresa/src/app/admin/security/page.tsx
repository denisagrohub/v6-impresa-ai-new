import { Shield } from "lucide-react";
import ComingSoon from "@/components/admin/ComingSoon";

export default function AdminSecurityPage() {
    return (
        <ComingSoon
            icon={Shield}
            title="Sicurezza"
            description="Il pannello dedicato ai controlli di sicurezza (sessioni, accessi, chiavi API) da qui è in arrivo."
        />
    );
}
