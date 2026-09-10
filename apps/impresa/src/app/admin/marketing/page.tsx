import { TrendingUp } from "lucide-react";
import ComingSoon from "@/components/admin/ComingSoon";

export default function AdminMarketingPage() {
    return (
        <ComingSoon
            icon={TrendingUp}
            title="Marketing Plans"
            description="La gestione dei piani marketing da qui è in arrivo."
        />
    );
}
