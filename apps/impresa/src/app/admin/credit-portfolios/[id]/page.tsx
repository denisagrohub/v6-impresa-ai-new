"use client";
import { use } from "react";
import CreditPortfolioDetail from "@/components/admin/credit/CreditPortfolioDetail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CreditPortfolioDetail portfolioId={id} />;
}
