import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { APP_NAME } from "@/lib/config";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [redirect, setRedirect] = useState(false);
  const [error, setError] = useState("");

  // If already signed in, bounce to home.
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) setRedirect(true);
  });

  if (redirect) return <Navigate to="/" replace />;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

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
          <p className="text-[--color-ink] text-sm leading-relaxed">
            ✉️ Check your inbox. Click the magic link to sign in.
          </p>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-3 rounded-lg bg-[--color-bg] border border-[--color-border] text-[--color-ink] focus:outline-none focus:border-[--color-coach] transition"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="px-4 py-3 rounded-lg bg-[--color-coach] text-white font-medium hover:bg-[--color-coach-soft] disabled:opacity-60 transition"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && (
              <p className="text-xs text-[--color-race] mt-1">{error}</p>
            )}
          </form>
        )}

        <p className="text-[10px] uppercase tracking-[0.18em] text-[--color-ink-dim] mt-10">
          Personal · Private · No public access
        </p>
      </div>
    </div>
  );
}
