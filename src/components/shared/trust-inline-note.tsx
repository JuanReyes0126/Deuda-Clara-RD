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
        "rounded-[1.75rem] border border-border/70 bg-white/82 px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-secondary text-primary grid size-10 shrink-0 place-items-center rounded-2xl">
          <LockKeyhole className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">{title}</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {notes.map((note) => (
              <span
                key={note}
                className="rounded-full border border-border/80 bg-secondary/40 px-3.5 py-2 text-xs leading-5 text-foreground"
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
