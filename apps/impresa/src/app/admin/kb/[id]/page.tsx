"use client";
import { use } from "react";
import KbDetailPage from "@/components/admin/kb/KbDetailPage";

export default function Page({ params }: { params: { id: string } }) {
  return <KbDetailPage kbId={params.id} />;
}
