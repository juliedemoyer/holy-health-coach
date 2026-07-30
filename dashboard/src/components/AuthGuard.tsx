import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { hydrateProfile } from "@/lib/profile";

/**
 * AuthGuard — redirects to /sign-in if no Supabase session.
 * Magic-link auth means session is established by clicking the email link;
 * the link redirects back to "/" with an access_token in the URL hash.
 *
 * Also the single hydration point for the athlete profile. Height, date of
 * birth and sex live in the RLS-locked `config` row rather than in the bundle
 * (see migration 0017), so they have to be fetched. Children do not render
 * until that fetch settles.
 */
async function loadProfile(): Promise<void> {
  const { data, error } = await supabase
    .from("config")
    .select("birthdate, height_cm, sex")
    .maybeSingle();

  if (error) {
    // Not fatal: the profile-derived tiles render their empty state.
    console.warn("[holy] could not load profile config:", error.message);
    hydrateProfile(null);
    return;
  }
  hydrateProfile(data ?? null);
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session) await loadProfile();
      if (!mounted) return;
      setStatus(data.session ? "in" : "out");
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        if (!mounted) return;
        if (session) await loadProfile();
        if (!mounted) return;
        setStatus(session ? "in" : "out");
      },
    );

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
