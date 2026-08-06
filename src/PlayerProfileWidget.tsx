// PlayerProfileWidget.tsx — the floating soap bubble + wordless per-session check-in.
// Tap the bubble -> (first run only) a single "what do you swing now?" to plant your base
// -> then a 2-tap session check-in: a rotating shot-feel answer + the session-overall anchor.
// Each answer writes to the check-in history (which repositions the pool + tightens its
// confidence) and can be skipped. No titles, no naming — the bubble and the water carry it.
import { useState } from "react";
import { loadProfile, saveProfile } from "./playerProfile";
import { SHOTS, ANCHOR, nextShot, addCheckin, sessionCount, Shot, ShotOpt } from "./checkins";

const ARCHETYPES: [string, string, string][] = [
  ["round-control", "Round", "control · comfort"],
  ["allcourt", "All-court", "the balanced middle"],
  ["power-diamond", "Diamond", "power · attack"],
  ["soft-attacker", "Soft attacker", "aggressive but gentle"],
  ["new", "Just starting", "not sure yet"],
];
const orbColor = (v: number) => (v < 0 ? "#c8695a" : v > 0 ? "#5fbfa0" : "#7c8b95");

export default function PlayerProfileWidget() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"archetype" | "shot" | "anchor" | "done">("shot");
  const [shot, setShot] = useState<Shot>(() => nextShot());
  const [pending, setPending] = useState<ShotOpt | null>(null);
  const [n, setN] = useState(() => sessionCount());

  function openIt() {
    const needArch = !loadProfile().current;
    setPhase(needArch ? "archetype" : "shot");
    if (!needArch) setShot(nextShot());
    setOpen(true); setPending(null);
  }
  function pickArchetype(id: string) { const p = loadProfile(); saveProfile({ ...p, current: id }); setShot(nextShot()); setPhase("shot"); }
  function pickShot(o: ShotOpt) { setPending(o); setPhase("anchor"); }
  function pickAnchor(overV: number) {
    if (pending) addCheckin({ ts: Date.now(), shot: shot.id, label: pending.label, v: pending.v, dim: pending.dim, lob: pending.lob, overV });
    setN(sessionCount()); setPhase("done");
    setTimeout(() => { setOpen(false); setPhase("shot"); }, 1100);
  }
  function dismiss() { setOpen(false); setPhase("shot"); }

  const orbRow = (opts: ShotOpt[] | { label: string; v: number }[], cb: (o: any) => void) => (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
      {opts.map((o: any, i: number) => (
        <button key={i} onClick={() => cb(o)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle at 36% 32%, #ffffffaa, " + orbColor(o.v) + " 78%)", boxShadow: "0 3px 12px " + orbColor(o.v) + "66" }} />
          <span style={{ fontSize: 11.5, color: "#cfe1ec" }}>{o.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ position: "fixed", left: 18, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 46, fontFamily: "Inter, system-ui, sans-serif" }}>
      {open && (
        <div style={{ position: "absolute", left: 0, bottom: 74, width: 288, maxWidth: "calc(100vw - 36px)", background: "#12293a", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 16, padding: 18, boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
          {phase === "archetype" && (<>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "#eef6fb", marginBottom: 12, textAlign: "center" }}>What do you swing now?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ARCHETYPES.map(([id, t, sub]) => (
                <button key={id} onClick={() => pickArchetype(id)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "#e8eef2", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t}</div><div style={{ fontSize: 10.5, color: "#9fb4c0" }}>{sub}</div>
                </button>
              ))}
            </div>
          </>)}

          {phase === "shot" && (<>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#eef6fb", marginBottom: 16, textAlign: "center" }}>{shot.q}</div>
            {orbRow(shot.opts, pickShot)}
            <div style={{ textAlign: "center", marginTop: 16 }}><span onClick={dismiss} style={{ fontSize: 12, color: "#8ea3b0", cursor: "pointer" }}>Not now</span></div>
          </>)}

          {phase === "anchor" && (<>
            <div style={{ fontSize: 11, color: "#8ea3b0", marginBottom: 4, textAlign: "center" }}>{shot.q.replace(/\?$/, "")} · {pending ? pending.label : ""}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#eef6fb", marginBottom: 16, textAlign: "center" }}>{ANCHOR.q}</div>
            {orbRow(ANCHOR.opts as any, (o: any) => pickAnchor(o.v))}
          </>)}

          {phase === "done" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 30 }}>✓</div>
              <div style={{ fontSize: 13, color: "#cfe1ec", marginTop: 4 }}>{n} session{n === 1 ? "" : "s"} in the pool</div>
            </div>
          )}
        </div>
      )}

      {/* the soap bubble */}
      <button onClick={openIt} aria-label="Session check-in" style={{ width: 62, height: 62, padding: 0, border: "none", background: "none", cursor: "pointer", filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.4))" }}>
        <svg viewBox="0 0 64 64" width="62" height="62">
          <defs>
            <radialGradient id="pbw_b" cx="38%" cy="32%" r="72%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" /><stop offset="26%" stopColor="#bfe6f0" stopOpacity="0.18" /><stop offset="62%" stopColor="#3f6f8c" stopOpacity="0.14" /><stop offset="100%" stopColor="#0f2b3e" stopOpacity="0.10" /></radialGradient>
            <radialGradient id="pbw_i1" cx="70%" cy="66%" r="45%"><stop offset="0%" stopColor="#ff8bd0" stopOpacity="0.32" /><stop offset="100%" stopColor="#ff8bd0" stopOpacity="0" /></radialGradient>
            <radialGradient id="pbw_i2" cx="30%" cy="74%" r="45%"><stop offset="0%" stopColor="#6ff0e0" stopOpacity="0.32" /><stop offset="100%" stopColor="#6ff0e0" stopOpacity="0" /></radialGradient>
            <radialGradient id="pbw_i3" cx="66%" cy="26%" r="42%"><stop offset="0%" stopColor="#ffe38b" stopOpacity="0.28" /><stop offset="100%" stopColor="#ffe38b" stopOpacity="0" /></radialGradient>
          </defs>
          <g>
            <circle cx="32" cy="32" r="28" fill="url(#pbw_b)" />
            <circle cx="32" cy="32" r="28" fill="url(#pbw_i1)" /><circle cx="32" cy="32" r="28" fill="url(#pbw_i2)" /><circle cx="32" cy="32" r="28" fill="url(#pbw_i3)" />
            <circle cx="32" cy="32" r="28" fill="none" stroke="#eaf9ff" strokeWidth="0.8" opacity="0.5" />
            <ellipse cx="23" cy="23" rx="9" ry="6" fill="#ffffff" opacity="0.6" />
            {n === 0 && <circle cx="52" cy="14" r="5" fill="#E0B34A" stroke="#12293a" strokeWidth="1.5" />}
            <animateTransform attributeName="transform" attributeType="XML" type="translate" values="0 0; 0 -3.5; 0 0; 0 2.5; 0 0" dur="6s" repeatCount="indefinite" />
          </g>
        </svg>
      </button>
    </div>
  );
}
