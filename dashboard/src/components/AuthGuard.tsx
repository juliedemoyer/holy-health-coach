import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { hydrateProfile } from "@/lib/profile";

/**
 * AuthGuard — gates every authenticated route on a Supabase session.
 *
 * Signed out, where you land depends on what you asked for:
 *   - "/" is the bare domain (a link in bio, a shared URL) -> /public.
 *     This lives here rather than in _redirects because a server-side rule
 *     also caught the magic-link landing and bounced it to /public.
 *   - anything else -> /sign-in, carrying the path you wanted so signing in
 *     brings you back to it instead of to the root.
 *
 * Also the single hydration point for the athlete profile. Height, date of
 * birth and sex live in the RLS-locked `config` row rather than in the bundle
 * so they have to be fetched, and every authed page assumes they are present.
 *
 * ---------------------------------------------------------------------------
 * The "Holy is waking up…" freeze
 *
 * Opening the app on a session older than the access token's hour — i.e. every
 * normal morning — hung on the loading screen until the timeout below gave up.
 * It looked like broken sign-in, which sent us chasing magic links and then
 * passwords; neither was the problem. Sign-in worked. Coming *back* didn't.
 *
 * supabase-js serialises auth work behind a lock, and it runs
 * onAuthStateChange callbacks while holding it. The callback here awaited
 * loadProfile(), whose PostgREST query needs the session — which needs the
 * lock the callback is still holding. On a fresh token nothing deadlocked
 * because getSession() resolved from memory first and the race was won before
 * it mattered. On an expired one, boot fires TOKEN_REFRESHED mid-refresh, the
 * callback wins the race, and both sides wait on each other forever.
 *
 * Two rules keep it dead:
 *   1. The callback stays synchronous and touches no supabase API. It hands
 *      the session to a deferred task that runs after the lock is released.
 *   2. loadProfile() carries its own deadline. A profile fetch that stalls
 *      degrades to empty-state tiles; it never holds the whole app hostage.
 * The 10s timeout stays as a last resort, but it is no longer load-bearing.
 * ---------------------------------------------------------------------------
 */

// Long enough for a cold fetch on a phone on hotel wifi, short enough that a
// stall reads as one slow tile rather than as a broken app.
const PROFILE_TIMEOUT_MS = 6_000;
const AUTH_TIMEOUT_MS = 10_000;

async function loadProfile(): Promise<void> {
  const query = supabase
    .from("config")
    .select("birthdate, height_cm, sex")
    .maybeSingle();

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), PROFILE_TIMEOUT_MS),
  );

  try {
    const result = await Promise.race([query, timeout]);
    if (result === "timeout") {
      console.warn("[holy] profile config fetch timed out — rendering without it");
      hydrateProfile(null);
      return;
    }
    if (result.error) {
      // Not fatal: the profile-derived tiles render their empty state.
      console.warn("[holy] could not load profile config:", result.error.message);
      hydrateProfile(null);
      return;
    }
    hydrateProfile(result.data ?? null);
  } catch (err) {
    console.warn("[holy] profile config fetch failed:", err);
    hydrateProfile(null);
  }
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out" | "error">("loading");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled || !mounted) return;
      settled = true;
      console.error("[holy] auth check timed out");
      setStatus("error");
    }, AUTH_TIMEOUT_MS);

    function finish(next: "in" | "out" | "error") {
      if (!mounted) return;
      settled = true;
      clearTimeout(timeout);
      setStatus(next);
    }

    // Runs outside supabase-js's auth lock — never call this from inside an
    // onAuthStateChange callback without deferring first (see the note above).
    async function resolveSession(session: Session | null) {
      if (!mounted) return;
      if (!session) {
        finish("out");
        return;
      }
      await loadProfile();
      finish("in");
    }

    supabase.auth
      .getSession()
      .then(({ data }) => resolveSession(data.session))
      .catch((err) => {
        console.error("[holy] auth check failed:", err);
        finish("error");
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Synchronous by contract, and deliberately not an async function: the
      // lock is held for the duration of this callback.
      setTimeout(() => {
        void resolveSession(session);
      }, 0);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
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

  if (status === "error") {
    return (
      <div className="min-h-screen grid place-items-center text-[--color-ink-mid] gap-3 text-center px-6">
        <div className="text-sm font-display tracking-wider uppercase">
          Holy didn't wake up in time
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm underline underline-offset-4"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={async () => {
            // Last resort when a stored session is the thing that's wedged:
            // clear it locally and go back to a sign-in screen that works.
            // `local` scope so a wedged network call can't block the recovery.
            try {
              await supabase.auth.signOut({ scope: "local" });
            } catch {
              /* falling through to the reload is the whole point */
            }
            window.location.assign("/sign-in");
          }}
          className="text-xs text-[--color-ink-dim] underline underline-offset-4"
        >
          Sign in again
        </button>
      </div>
    );
  }

  if (status === "out") {
    if (location.pathname === "/") return <Navigate to="/public" replace />;
    const from = location.pathname + location.search;
    return <Navigate to="/sign-in" state={{ from }} replace />;
  }

  return <>{children}</>;
}
