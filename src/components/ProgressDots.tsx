import { getCurrentScores } from "@/lib/storage";

export function ProgressDots({ current }: { current?: "reflex" | "memory" | "balance" }) {
  const s = getCurrentScores();
  const items: Array<{ key: "reflex" | "memory" | "balance"; label: string }> = [
    { key: "reflex", label: "Reflex" },
    { key: "memory", label: "Memory" },
    { key: "balance", label: "Balance" },
  ];
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      {items.map((it, i) => {
        const done = s[it.key] !== null;
        const active = current === it.key;
        return (
          <div key={it.key} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className={`h-3 w-3 rounded-full transition-all ${
                done ? "bg-gradient-energy shadow-glow" :
                active ? "bg-accent ring-4 ring-accent/30" : "bg-muted"
              }`} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</span>
            </div>
            {i < items.length - 1 && <div className="h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
