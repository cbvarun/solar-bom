import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Staff sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl">Staff sign in</h1>
        <p className="mt-1 text-sm text-ink-muted">For administrators, sales engineers, design engineers and procurement staff.</p>
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
