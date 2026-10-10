"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";
import clsx from "clsx";
import type { ActionResult } from "@/lib/server/admin-guard";

/** Form wrapper for server actions: shows the result message and field errors. */
export function ActionForm({ action, children, className, resetOnSuccess = false, confirm }: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} className={className} aria-busy={pending} onSubmit={(e) => {
      // Submit manually: React's built-in form action resets every field afterwards,
      // which would wipe the user's input when the server rejects it.
      e.preventDefault();
      if (confirm && !window.confirm(confirm)) return;
      const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
      startTransition(() => formAction(fd));
    }}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {state?.message && (
        <p role="status" className={clsx("mt-2 text-xs", state.ok ? "text-brand-800" : "text-red-700")}>
          {state.message}
          {state.errors && Object.keys(state.errors).length > 0 && <> {Object.entries(state.errors).map(([k, v]) => `${k}: ${v}`).join("; ")}</>}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger" }) {
  return <button type="submit" className={clsx("btn-sm", variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary")}>{children}</button>;
}
