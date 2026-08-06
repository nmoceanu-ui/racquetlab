// checkins.ts — the per-session feel history and the inference that reads it.
// Each session logs a rotating shot-feel answer + a session-overall anchor. The anchor
// normalizes racquet-feel vs. an off-day (a bad shot on a GOOD session points at the frame).
// The lob is a bipolar calibration: short -> underpowered, deep -> overpowered/low control,
// short+deep mixed -> a sweet-spot / forgiveness signal no single answer can reach.

export type ShotOpt = { label: string; v: number; dim?: string; lob?: "short" | "deep" };
export type Shot = { id: string; q: string; opts: ShotOpt[] };
export type Checkin = { ts: number; shot: string; label: string; v: number; dim?: string; lob?: "short" | "deep"; overV: number };

// v: -1 worse · 0 fine · +1 better. dim feeds the solver (comfort/control/power).
export const SHOTS: Shot[] = [
  { id: "smash", q: "How did your smash land?", opts: [{ label: "harsh", v: -1, dim: "comfort" }, { label: "fine", v: 0 }, { label: "clean", v: 1 }] },
  { id: "bandeja", q: "Your bandeja?", opts: [{ label: "sprayed", v: -1, dim: "control" }, { label: "fine", v: 0 }, { label: "placed", v: 1 }] },
  { id: "defense", q: "Defense off the wall?", opts: [{ label: "sat up", v: -1, dim: "control" }, { label: "fine", v: 0 }, { label: "controlled", v: 1 }] },
  { id: "volley", q: "Your volleys?", opts: [{ label: "floated", v: -1, dim: "control" }, { label: "fine", v: 0 }, { label: "crisp", v: 1 }] },
  { id: "lob", q: "Your lobs?", opts: [{ label: "short", v: -1, dim: "power", lob: "short" }, { label: "perfect", v: 1 }, { label: "deep", v: -1, dim: "control", lob: "deep" }] },
  { id: "serve", q: "Serve / return?", opts: [{ label: "off", v: -1, dim: "control" }, { label: "fine", v: 0 }, { label: "on point", v: 1 }] },
];
export const ARM: Shot = { id: "arm", q: "How did your arm feel after?", opts: [{ label: "sore", v: -1, dim: "comfort" }, { label: "fine", v: 0 }, { label: "fresh", v: 1 }] };
export const ANCHOR = { q: "and the session overall?", opts: [{ label: "rough", v: -1 }, { label: "fine", v: 0 }, { label: "great", v: 1 }] };

const KEY = "pala_checkins_v1";
export function loadCheckins(): Checkin[] { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : []; } catch { return []; } }
export function addCheckin(c: Checkin) {
  try {
    const all = loadCheckins(); all.push(c);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-60)));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("palacheckin", { detail: c }));
  } catch { /* ignore */ }
}
export function sessionCount(): number { return loadCheckins().length; }

// rotate every load: cycle the core shots, occasionally drop in the pure-comfort arm probe
export function nextShot(prevId?: string): Shot {
  if (Math.random() < 0.18) return ARM;
  const i = SHOTS.findIndex((s) => s.id === prevId);
  return SHOTS[(i + 1 + Math.floor(Math.random() * 2)) % SHOTS.length] || SHOTS[0];
}

function agg(entries: Checkin[]) {
  const n = entries.length;
  let comfort = 0, control = 0, power = 0, lobShort = 0, lobDeep = 0, frameHits = 0;
  entries.forEach((e, i) => {
    const recency = 0.5 + 0.5 * (n > 1 ? i / (n - 1) : 1);       // newest weighs most
    const w = (e.overV >= 0 ? 1.6 : 0.5) * recency;               // frame vs off-day
    if (e.v < 0 && e.dim) {
      if (e.dim === "comfort") comfort += w; else if (e.dim === "control") control += w; else if (e.dim === "power") power += w;
      if (e.overV >= 0) frameHits++;
    }
    if (e.lob === "short") lobShort += w; if (e.lob === "deep") lobDeep += w;
  });
  const forgiveness = (lobShort > 0.6 && lobDeep > 0.6) ? Math.min(lobShort, lobDeep) : 0;
  return { comfort, control, power, lobShort, lobDeep, forgiveness, frameHits, n };
}

// Blend the check-in history into the base pool target the solver will chase.
export function deriveTarget(base: { style: number; power: number; comfortFloor: number }, entries: Checkin[]) {
  const a = agg(entries);
  let { style, power, comfortFloor } = base;
  comfortFloor = Math.min(0.85, comfortFloor + Math.min(0.18, a.comfort * 0.035) + a.forgiveness * 0.03);
  power = Math.max(0.05, Math.min(0.97, power + Math.min(0.16, a.lobShort * 0.04) - Math.min(0.16, a.lobDeep * 0.035)));
  const controlNeed = a.control + a.lobDeep;
  style = Math.max(0.04, style - Math.min(0.18, controlNeed * 0.03));

  let receipts = "";
  if (a.forgiveness > 0.6) receipts = "your lobs miss both short and deep — that's a sweet-spot read";
  else {
    const parts: [string, number][] = [["comfort", a.comfort], ["control", a.control], ["short lobs", a.lobShort]];
    parts.sort((x, y) => y[1] - x[1]);
    if (parts[0][1] > 0.8) {
      const lead = parts[0][0];
      receipts = lead === "comfort" ? "harsh contact" + (a.frameHits > 0 ? " even on good sessions" : "")
        : lead === "control" ? "placement slipping" + (a.frameHits > 0 ? " even when you played well" : "")
          : "lobs landing short";
    }
  }
  return { style, power, comfortFloor, receipts, sessions: a.n, confidence: Math.min(1, a.n / 8) };
}
