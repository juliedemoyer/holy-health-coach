import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * AuthGuard — redirects to /sign-in if no Supabase session.
 * Magic-link auth means session is established by clicking the email link;
 * the link redirects back to "/" with an access_token in the URL hash.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setStatus(data.session ? "in" : "out");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      if (!mounted) return;
      setStatus(session ? "in" : "out");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center text-[--color-ink-mid]">
        <div className="text-sm font-display tracking-wider uppercase">Holy is waking up…</div>
      </div>
    );
  }

  if (status === "out") return <Navigate to="/sign-in" replace />;

  return <>{children}</>;
}
