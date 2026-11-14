import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

/** Label + control + error/hint with correct aria wiring. */
export function FormField({ id, label, error, hint, required, className, children }: {
  id: string; label: string; error?: string; hint?: string; required?: boolean; className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const desc = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}{required && <span className="text-danger" aria-hidden> *</span>}</Label>
      {React.cloneElement(children, { id, "aria-invalid": !!error || undefined, "aria-describedby": desc })}
      {error ? <p id={`${id}-error`} className="text-xs text-danger">{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
