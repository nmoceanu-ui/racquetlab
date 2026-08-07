// BasinPool.tsx — the Basin player-map screen.
// FREE TEASER: the pool, drifting your basin, the "N near" count, the closest stock frame,
// and the market-gap read are all open to everyone (client-side, from /api/catalog).
// PAID SOLVE: "Find my build" runs the real-engine inverse solver (/api/basin-solve) and
// Open-in-builder — gated behind canSolve; free users get onRequirePaid() (the paywall).
import { useState, useEffect } from "react";
import { loadProfile, profileToBasin } from "./playerProfile";
import { loadCheckins, deriveTarget } from "./checkins";

const FACE_MOD: any = { fiberglass: 0.15, "carbon-3k": 0.40, "carbon-12k": 0.62, "carbon-18k": 0.82, graphene: 0.92, "carbon-ud": 0.72, "basalt-face": 0.5 };
const CORE_HARD: any = { "eva-soft": 0.25, "foam-pe": 0.32, "eva-medium": 0.52, "hybrid-core": 0.62, "eva-hard": 0.80 };
const SHAPE_AGG: any = { round: 0.12, teardrop: 0.52, diamond: 0.92, "diamond-wide": 0.80 };

// The "loadout": one tap declares a priority and sets the target (style + power + how much
// clean delivery to protect). Sliders are optional fine-tuning behind a toggle.
const PRIORITIES: { id: string; label: string; sub: string; style: number; power: number; floor?: number }[] = [
  { id: "power", label: "Power", sub: "finish points", style: 0.82, power: 0.86, floor: 0.5 },
  { id: "control", label: "Control", sub: "placement", style: 0.22, power: 0.42 },
  { id: "comfort", label: "Comfort", sub: "easy on the arm", style: 0.44, power: 0.48, floor: 0.76 },
  { id: "allaround", label: "All-around", sub: "do it all", style: 0.50, power: 0.56 },
];
// power as a word, never a decimal
const powerTier = (p: number) => (p < 35 ? "Touch" : p < 55 ? "All-court" : p < 75 ? "Powerful" : "Elite");

const X0 = 30, X1 = 450, Y0 = 55, Y1 = 425;
const fx = (x: number) => X0 + 20 + x * (X1 - X0 - 40);
const fy = (y: number) => Y0 + 16 + y * (Y1 - Y0 - 32);

type Frame = { x: number; y: number; name: string };

export default function BasinPool({ onOpenBuild, canSolve = true, onRequirePaid }: { onOpenBuild?: (spec: any) => void; canSolve?: boolean; onRequirePaid?: () => void }) {
  const [cat, setCat] = useState<Frame[]>([]);
  const t0 = deriveTarget(profileToBasin(loadProfile()), loadCheckins());
  const [style, setStyle] = useState(Math.round(t0.style * 100));
  const [power, setPower] = useState(Math.round(t0.power * 100));
  const [comfortFloor, setComfortFloor] = useState(t0.comfortFloor);
  const [confidence, setConfidence] = useState(t0.confidence);
  const [receipts, setReceipts] = useState(t0.receipts);
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  // Reposition + retune the basin whenever the profile or a session check-in updates.
  useEffect(() => {
    const h = () => { const t = deriveTarget(profileToBasin(loadProfile()), loadCheckins()); setStyle(Math.round(t.style * 100)); setPower(Math.round(t.power * 100)); setComfortFloor(t.comfortFloor); setConfidence(t.confidence); setReceipts(t.receipts); setResult(null); };
    window.addEventListener("palaprofile", h); window.addEventListener("palacheckin", h);
    return () => { window.removeEventListener("palaprofile", h); window.removeEventListener("palacheckin", h); };
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/catalog").then((r) => r.json()).then((d) => {
      if (!live) return;
      const raw = (d.racquets || []).map((x: any) => {
        const r = x.spec || x;
        const tn = (r.thicknessMm - 30) / 8, balN = (r.balanceCm - 24) / 3.2;
        const fm = FACE_MOD[r.faceId] ?? 0.5, ch = CORE_HARD[r.coreId] ?? 0.5;
        const pw = 0.40 * fm + 0.26 * ch + 0.18 * tn + 0.16 * (fm * (0.5 + tn));
        const swT = (r.weightG - 340) / 32 * Math.pow(Math.max(0, balN), 1.3);
        const st = 0.42 * balN + 0.34 * (SHAPE_AGG[r.shapeId] ?? 0.5) + 0.24 * Math.max(0, Math.min(1, swT));
        return { pw, st, name: ((x.brand || "") + " " + (x.model || "")).trim() || "Unnamed" };
      });
      const nm = (k: string) => { const vs = raw.map((a: any) => a[k]); const lo = Math.min(...vs), hi = Math.max(...vs); raw.forEach((a: any) => (a[k] = 0.06 + (a[k] - lo) / ((hi - lo) || 1) * 0.88)); };
      nm("pw"); nm("st");
      setCat(raw.map((a: any) => ({ x: a.st, y: a.pw, name: a.name })));
    }).catch(() => { if (live) setErr("Couldn't load the racquet catalog (is the API running?)."); });
    return () => { live = false; };
  }, []);

  const bx = fx(style / 100), by = fy(power / 100);
  // confidence (from session count) tightens the basin: more check-ins = a sharper read
  const r2 = Math.round(74 - confidence * 40), r1 = Math.round(46 - confidence * 24);
  const deep = power / 100 > 0.5, built = !!result;

  // free teaser: nearest stock frame + how many float in the basin
  let near = 0, nearest: Frame | null = null, nearestD = Infinity;
  const dots = cat.map((p, i) => {
    const cx = fx(p.x), cy = fy(p.y); const d = Math.hypot(cx - bx, cy - by); const inB = d < r2;
    if (inB) near++; if (d < nearestD) { nearestD = d; nearest = p; }
    return <circle key={i} cx={cx} cy={cy} r={inB ? 3.1 : 2.0} fill={inB ? "#f2fbff" : "#c3dded"} opacity={inB ? 0.9 : 0.17} />;
  });
  const openWater = nearestD > 58;
  const styleLabel = style < 38 ? "control" : style > 62 ? "aggressive" : "all-court";

  async function solve() {
    if (!canSolve) { onRequirePaid && onRequirePaid(); return; }
    setSolving(true); setErr(null);
    try {
      const resp = await fetch("/api/basin-solve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ style: style / 100, power: power / 100, comfortFloor }) });
      const j = await resp.json();
      if (j.error) throw new Error(j.error);
      setResult(j);
    } catch (e: any) { setErr("Solver error: " + (e && e.message ? e.message : String(e))); }
    setSolving(false);
  }
  function reset() { setResult(null); }
  function pickPriority(pr: { id: string; style: number; power: number; floor?: number }) {
    setStyle(Math.round(pr.style * 100)); setPower(Math.round(pr.power * 100));
    if (pr.floor) setComfortFloor((c) => Math.max(c, pr.floor as number));  // Comfort protects clean delivery
    setPriority(pr.id); reset();
  }

  const tierLabel: any = { "closest-stock": "Closest stock frame", "minimal-custom": "One-change custom", "full-custom": "Full custom" };
  const font = "Inter, system-ui, sans-serif";

  return (
    <div style={{ fontFamily: font, color: "#e8e4db", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 340px", minWidth: 300 }}>
        <svg viewBox="0 0 480 470" style={{ width: "100%", maxWidth: 480, borderRadius: 16, display: "block" }}>
          <defs>
            <linearGradient id="bp_water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbeff7" /><stop offset="22%" stopColor="#a9d3e6" />
              <stop offset="46%" stopColor="#5ea0c4" /><stop offset="72%" stopColor="#2c6d9c" /><stop offset="100%" stopColor="#0d3355" />
            </linearGradient>
            <radialGradient id="bp_glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f2fbff" stopOpacity="0.95" /><stop offset="45%" stopColor="#cdeaf7" stopOpacity="0.55" /><stop offset="100%" stopColor="#cdeaf7" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bp_murk" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#04141f" stopOpacity="0.6" /><stop offset="70%" stopColor="#04141f" stopOpacity="0.38" /><stop offset="100%" stopColor="#04141f" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bp_clear" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bfeeff" stopOpacity="0.5" /><stop offset="100%" stopColor="#bfeeff" stopOpacity="0" />
            </radialGradient>
            <clipPath id="bp_clip"><rect x="30" y="55" width="420" height="370" rx="14" /></clipPath>
          </defs>
          <g clipPath="url(#bp_clip)">
            <rect x="30" y="55" width="420" height="370" fill="url(#bp_water)" />
            {deep && !built && <circle cx={bx} cy={by} r={Math.max(40, r2)} fill="url(#bp_murk)" />}
            {built && <circle cx={bx} cy={by} r={Math.max(42, r2)} fill="url(#bp_clear)" />}
            {dots}
            <circle cx={bx} cy={by} r={20} fill="none" stroke="#eaf7fd" strokeWidth={1.6} opacity={0.5}>
              <animate attributeName="r" values="14;58" dur="3.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0" dur="3.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={bx} cy={by} r={20} fill="none" stroke="#eaf7fd" strokeWidth={1.4} opacity={0.4}>
              <animate attributeName="r" values="14;58" dur="3.4s" begin="1.7s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0" dur="3.4s" begin="1.7s" repeatCount="indefinite" />
            </circle>
            <circle cx={bx} cy={by} r={r2} fill="none" stroke="#dff2fb" strokeWidth={1} opacity={0.32} />
            <circle cx={bx} cy={by} r={r1} fill="none" stroke="#eef8fd" strokeWidth={1.2} opacity={0.5} />
            <circle cx={bx} cy={by} r={30} fill="url(#bp_glow)" />
            <circle cx={bx} cy={by} r={5} fill="#ffffff" />
            {built && <circle cx={bx} cy={by} r={9} fill="#E0B34A" stroke="#7a5b12" strokeWidth={1.6} />}
          </g>
          <rect x="30" y="55" width="420" height="370" rx="14" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} />
          <text x="240" y="26" fontSize="12" fill="#9fb4c0" textAnchor="middle" fontWeight="600" letterSpacing="1">POWER — deeper = more pop ↓</text>
          <text x="40" y="447" fontSize="11" fill="#7d94a2" fontWeight="600">CONTROL</text>
          <text x="240" y="447" fontSize="11" fill="#7d94a2" textAnchor="middle" fontWeight="600">STYLE</text>
          <text x="440" y="447" fontSize="11" fill="#7d94a2" textAnchor="end" fontWeight="600">AGGRESSIVE</text>
        </svg>
      </div>

      <div style={{ flex: "1 1 250px", minWidth: 240, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#9fb4c0" }}>WHAT MATTERS MOST? <span style={{ float: "right", fontWeight: 400, color: "#7d94a2" }}>{styleLabel} · {powerTier(power).toLowerCase()}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {PRIORITIES.map((pr) => {
            const on = priority === pr.id;
            return (
              <button key={pr.id} type="button" onClick={() => pickPriority(pr)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 11, cursor: "pointer", border: "1px solid " + (on ? "#4aa3d5" : "rgba(255,255,255,0.14)"), background: on ? "rgba(74,163,213,0.20)" : "rgba(255,255,255,0.05)", color: "#e8eef2", fontFamily: "inherit" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pr.label}</div>
                <div style={{ fontSize: 10.5, color: "#9fb4c0" }}>{pr.sub}</div>
              </button>
            );
          })}
        </div>
        <div>
          <button type="button" onClick={() => setShowAdjust(!showAdjust)} style={{ background: "none", border: "none", color: "#8ea3b0", fontSize: 12, cursor: "pointer", padding: "2px 0", fontFamily: "inherit" }}>{showAdjust ? "▾ Fine-tune" : "▸ Fine-tune"}</button>
          {showAdjust && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9fb4c0", display: "flex", justifyContent: "space-between" }}>Style <span>{styleLabel}</span></label>
                <input type="range" min={0} max={100} value={style} onChange={(e) => { setStyle(+e.target.value); setPriority(null); reset(); }} style={{ width: "100%", accentColor: "#4aa3d5" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9fb4c0", display: "flex", justifyContent: "space-between" }}>Power <span>{powerTier(power)}</span></label>
                <input type="range" min={0} max={100} value={power} onChange={(e) => { setPower(+e.target.value); setPriority(null); reset(); }} style={{ width: "100%", accentColor: "#2c6d9c" }} />
              </div>
            </div>
          )}
        </div>

        {/* FREE teaser: where you sit + the market gap */}
        {cat.length > 0 && !built && (
          <div style={{ fontSize: 12.5, lineHeight: 1.45, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
            {openWater
              ? <span><b style={{ color: "#d7ecf7" }}>Open water.</b> The nearest stock frame, <b>{nearest ? nearest.name : "—"}</b>, is a stretch from where you play — the market has a gap here.</span>
              : <span><b style={{ color: "#bfeeff" }}>Closest stock frame:</b> {nearest ? nearest.name : "—"}. {near} float in your basin.</span>}
          </div>
        )}
        {receipts && !built && (
          <div style={{ fontSize: 11, color: "#8ea3b0", lineHeight: 1.4, marginTop: -4 }}>◌ Tuned by your sessions: {receipts}.</div>
        )}

        <button type="button" onClick={solve} disabled={solving || cat.length === 0} style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #2c6d9c", background: solving ? "#245a80" : "#2c6d9c", color: "#fff", fontWeight: 700, fontSize: 13, cursor: solving ? "wait" : "pointer" }}>
          {solving ? "Solving on the real engine…" : canSolve ? "Clear the water — find my build" : "Find my custom build — unlock ✦"}
        </button>
        {!canSolve && <div style={{ fontSize: 11, color: "#8ea3b0", textAlign: "center", marginTop: -4 }}>Free: explore the pool & see your gap. Pro: solve your custom build.</div>}
        {err && <div style={{ fontSize: 12, color: "#f2b8a8", background: "rgba(176,54,30,0.15)", border: "1px solid rgba(176,54,30,0.4)", borderRadius: 9, padding: "8px 10px" }}>{err}</div>}

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.ladder.map((r: any, i: number) => {
              const isFull = r.tier === "full-custom";
              return (
                <div key={i} style={{ borderRadius: 10, padding: "9px 11px", background: isFull ? "rgba(224,179,74,0.12)" : "rgba(255,255,255,0.05)", border: "1px solid " + (isFull ? "rgba(224,179,74,0.4)" : "rgba(255,255,255,0.12)") }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isFull ? "#E0B34A" : "#cfe1ec" }}>{tierLabel[r.tier] || r.tier}</span>
                    <span style={{ fontSize: 11, color: "#9fb4c0" }}>pow {r.scores.powerNorm.toFixed(2)} · clean {r.scores.comfortNorm.toFixed(2)} {r.hits.power && r.hits.clean ? "✓" : ""}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#aebfc9", marginTop: 3, lineHeight: 1.4 }}>{r.note}</div>
                  <div style={{ fontSize: 11, color: "#8ea3b0", marginTop: 3 }}>{r.build.shape} · {r.build.throat}{r.build.throat === "closed" ? "" : "/" + r.build.beams} · {r.build.thicknessMm}mm · {r.build.face} face · {r.build.frame} · {r.build.grip}</div>
                  {isFull && onOpenBuild && (
                    <button type="button" onClick={() => onOpenBuild(result.spec)} style={{ marginTop: 8, padding: "7px 11px", borderRadius: 8, border: "none", background: "#E0B34A", color: "#3a2c08", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Open this build in the builder →</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
