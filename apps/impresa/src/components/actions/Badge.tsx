import React from "react";

const TONES: Record<string, string> = {
  cyan: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20",
  amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  green: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  gray: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
};

export default function Badge({ tone = "gray", children }: { tone?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone] || TONES.gray}`}>
      {children}
    </span>
  );
}
