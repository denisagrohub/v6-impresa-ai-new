// Badge di stato qualitativo - SOLO i tre colori di stato, MAI terracotta.
import type { ReactNode } from "react";

type Stato = "positivo" | "attenzione" | "critico";

const CLS: Record<Stato, string> = {
  positivo: "border-[#4E8B5C] bg-[#4E8B5C]/10 text-[#4E8B5C]",
  attenzione: "border-[#D9A441] bg-[#D9A441]/10 text-[#D9A441]",
  critico: "border-[#C4453A] bg-[#C4453A]/10 text-[#C4453A]",
};

export default function StateBadge(props: { stato: Stato; children: ReactNode }) {
  return (
    <span className={"inline-flex items-center rounded-sm border px-3 py-1 text-sm font-semibold " + CLS[props.stato]}>
      {props.children}
    </span>
  );
}
