"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
  hint?: string;
}

export default function Dropdown({
  label,
  items,
  variant = "default",
  align = "right",
}: {
  label: string;
  items: DropdownItem[];
  variant?: "default" | "primary" | "ghost";
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const btnCls =
    variant === "primary"
      ? "rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm"
      : variant === "ghost"
      ? "rounded text-gray-600 text-xs font-medium hover:bg-gray-100"
      : "rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50";

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((x) => !x)} className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors cursor-pointer ${btnCls}`}>
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`absolute z-40 mt-1 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg py-1 ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-50 ${
                it.variant === "primary" ? "text-indigo-700 font-semibold"
                : it.variant === "danger" ? "text-red-600"
                : "text-gray-700"
              }`}
            >
              <div>{it.label}</div>
              {it.hint && <div className="text-[10px] text-gray-400 mt-0.5">{it.hint}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
