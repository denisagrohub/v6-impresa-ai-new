"use client";
import CreditPortfolioDetail from "@/components/admin/credit/CreditPortfolioDetail";

export default function Page({ params }: { params: { id: string } }) {
  return <CreditPortfolioDetail portfolioId={params.id} />;
}
