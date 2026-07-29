import { useState, useRef, useEffect } from "react";
import { KPI_DESCRIPTIONS } from "../lib/percentiles";

type Props = {
  kpi: keyof typeof KPI_DESCRIPTIONS;
  /** Optional override of the description — useful when the same KPI has
   *  context-specific framing on a particular page. Falls back to KPI_DESCRIPTIONS. */
  inline?: { title?: string; what?: string; good?: string; source?: string };
};

/**
 * Tiny "?" icon next to a KPI label. On hover (desktop) or tap (mobile) it
 * pops a compact card explaining what the KPI is, what good looks like for
 * your age group, and where the data comes from.
 *
 * Closes on outside click and on Escape. The popover is anchored to the
 * icon with absolute positioning — no portal, keeps the bundle light.
 */
export function KPIInfo({ kpi, inline }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const base = KPI_DESCRIPTIONS[kpi];
  const d = {
    title: inline?.title ?? base.title,
    what:  inline?.what  ?? base.what,
    good:  inline?.good  ?? base.good,
    source: inline?.source ?? base.source,
  };

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <button
        type="button"
        aria-label={`What is ${d.title}?`}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        style={{
          width: 16, height: 16, borderRadius: "50%",
          border: "1px solid currentColor",
          background: "transparent",
          opacity: 0.55,
          color: "var(--color-ink-mid)",
          fontSize: 11, lineHeight: "14px", fontWeight: 600,
          cursor: "help", padding: 0, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          verticalAlign: "middle",
        }}
      >?</button>
      {open && (
        <div
          role="tooltip"
          onMouseLeave={() => setOpen(false)}
          style={{
            position: "fixed",
            bottom: "auto",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 9999,
            width: "min(320px, 92vw)",
            padding: "14px 16px",
            background: "rgba(20, 20, 24, 0.98)",
            color: "#e7e7ea",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            fontSize: 13, lineHeight: 1.5,
            textAlign: "left",
            whiteSpace: "normal",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{d.title}</div>
          <div style={{ marginBottom: 6 }}>{d.what}</div>
          <div style={{ marginBottom: 6, color: "#bdf2c9" }}>
            <strong style={{ color: "#9be2ad" }}>For your age group: </strong>{d.good}
          </div>
          <div style={{ opacity: 0.55, fontSize: 11, marginTop: 8 }}>{d.source}</div>
        </div>
      )}
    </span>
  );
}

/**
 * Combined label + ? icon — drop-in replacement for a KPI <h3>/<span>.
 * Use this when you want the whole "HRV ?" cluster.
 */
export function KPILabel({
  kpi, children, style,
}: Props & { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", ...style }}>
      {children}
      <KPIInfo kpi={kpi} />
    </span>
  );
}
