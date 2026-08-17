import { LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type TrustInlineNoteProps = {
  title?: string;
  notes: string[];
  className?: string;
};

export function TrustInlineNote({
  title = "Confianza y control",
  notes,
  className,
}: TrustInlineNoteProps) {
  if (!notes.length) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border/55 bg-secondary/20 px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-white/90 text-primary grid size-9 shrink-0 place-items-center rounded-lg border border-border/50 shadow-none">
          <LockKeyhole className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">{title}</p>
          <ul className="mt-3 space-y-2 border-l border-border/50 pl-3.5">
            {notes.map((note) => (
              <li key={note} className="text-sm leading-6 text-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
