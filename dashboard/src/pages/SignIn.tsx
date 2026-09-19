import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { APP_NAME } from "@/lib/config";

/**
 * Sign-in. Password is the primary path; the magic link is kept as a fallback.
 *
 * Password is primary because magic links fail on the phone for anyone who
 * installs the dashboard to their home screen. The failure mode is structural, not a
 * bug we can chase: tapping a link in Gmail on iOS opens Safari, so the
 * session lands in Safari's storage — while the dashboard you actually use is
 * the home-screen web app, a separate storage context that never sees it. The
 * link "works" and you still stare at a sign-in screen. A password is typed
 * inside whichever context you are already in, so there is no hop to lose.
 *
 * The magic link stays available underneath for the case a password is the
 * thing that's unavailable — a new device, or a forgotten one.
 */

/**
 * Where to come back to after signing in. AuthGuard puts the path the user
 * actually asked for in router state, so /vitals sends you back to /vitals.
 * Anything that isn't an in-app absolute path falls back to "/" — this value
 * also becomes emailRedirectTo, which ends up in an email, so it never gets to
 * be attacker-shaped.
 *
 * Supabase only honours a redirect that matches the project's Redirect URLs
 * allow-list; anything else falls back to the Site URL. Both the allowed deep
 * link and that fallback (the site root) land on the dashboard.
 */
function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== "string") return "/";
  if (!from.startsWith("/") || from.startsWith("//")) return "/";
  if (from === "/sign-in" || from.startsWith("/sign-in?")) return "/";
  return from;
}

/**
 * Supabase reports a wrong password and an account with no password set with
 * the same "Invalid login credentials" — deliberately, so the endpoint can't be
 * used to enumerate accounts. That's the right call for the API and useless in
 * a single-user app, where the answer is nearly always "the password was never
 * set on this account". Point at the fix instead of repeating the API's shrug.
 */
function readableAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "Wrong password — or no password set on this account yet. Set one in Supabase (Authentication → Users), or use the magic link below.";
  }
  if (/email logins are disabled/i.test(message)) {
    return "Password sign-in is switched off for this project (Supabase → Authentication → Providers → Email).";
  }
  return message;
}

type Mode = "password" | "link";

export function SignIn() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "sent" | "error">("idle");
  const [redirect, setRedirect] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const next = returnPath(location.state);

  // If already signed in, bounce to wherever the user was headed. In an effect, not
  // in the render body: called inline this fired a getSession() on every
  // render, and each one re-rendered on resolve.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setRedirect(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (redirect) return <Navigate to={next} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError("");

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(readableAuthError(error.message));
        setStatus("error");
        return;
      }
      // Don't navigate here — AuthGuard's onAuthStateChange has the session by
      // now, and `redirect` above owns where we go, in one place.
      setRedirect(true);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + next },
    });
    if (error) {
      setError(readableAuthError(error.message));
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  function switchMode(to: Mode) {
    setMode(to);
    setStatus("idle");
    setError("");
  }

  const inputClass =
    "px-4 py-3 rounded-lg bg-[--color-bg] border border-[--color-border] text-[--color-ink] focus:outline-none focus:border-[--color-coach] transition";

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="holy-card max-w-sm w-full p-8 sm:p-10 text-center">
        <div className="font-display text-3xl font-semibold text-[--color-ink] mb-2">
          Holy
        </div>
        <p className="text-sm text-[--color-ink-mid] mb-8">
          {APP_NAME} — your private dashboard.
        </p>

        {status === "sent" ? (
          <div className="text-[--color-ink] text-sm leading-relaxed">
            <p>✉️ Check your inbox. Click the magic link to sign in.</p>
            <button
              type="button"
              onClick={() => switchMode("password")}
              className="text-xs text-[--color-ink-mid] underline underline-offset-4 mt-6"
            >
              Use a password instead
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />

            {mode === "password" && (
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            )}

            <button
              type="submit"
              disabled={status === "working"}
              className="px-4 py-3 rounded-lg bg-[--color-coach] text-white font-medium hover:bg-[--color-coach-soft] disabled:opacity-60 transition"
            >
              {status === "working"
                ? mode === "password"
                  ? "Signing in…"
                  : "Sending…"
                : mode === "password"
                  ? "Sign in"
                  : "Send magic link"}
            </button>

            {error && (
              <p className="text-xs text-[--color-race] mt-1 leading-relaxed">{error}</p>
            )}

            <button
              type="button"
              onClick={() => switchMode(mode === "password" ? "link" : "password")}
              className="text-xs text-[--color-ink-mid] underline underline-offset-4 mt-3"
            >
              {mode === "password"
                ? "Email me a magic link instead"
                : "Sign in with a password instead"}
            </button>
          </form>
        )}

        <p className="text-[10px] uppercase tracking-[0.18em] text-[--color-ink-dim] mt-10">
          Personal · Private · No public access
        </p>
      </div>
    </div>
  );
}
