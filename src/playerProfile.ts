// playerProfile.ts — the on-device player profile captured by the floating 3-click
// questionnaire. Stored in localStorage (survives visits), and — once we sync it to the
// account — it will follow the player across devices. profileToBasin() turns the three
// answers into the Basin's inputs: where the basin sits (style, power) and how much clean
// delivery to protect (comfortFloor). A "palaprofile" window event fires on save so the
// pool can reposition live.

export type PlayerProfile = { current?: string; wants?: string[]; level?: string; updatedAt?: number };

const KEY = "pala_player_profile_v1";

export function loadProfile(): PlayerProfile {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
export function saveProfile(p: PlayerProfile) {
  try {
    const v = { ...p, updatedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(v));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("palaprofile", { detail: v }));
  } catch { /* storage unavailable — ignore */ }
}
export function hasProfile(p: PlayerProfile): boolean {
  return !!(p && (p.current || (p.wants && p.wants.length) || p.level));
}

// Q1 archetype -> base pool position (style 0..1 control→aggressive, power 0..1 touch→elite)
const ARCH: Record<string, { style: number; power: number }> = {
  "round-control": { style: 0.20, power: 0.28 },
  "allcourt": { style: 0.50, power: 0.52 },
  "power-diamond": { style: 0.82, power: 0.82 },
  "soft-attacker": { style: 0.70, power: 0.42 },
  "new": { style: 0.42, power: 0.44 },
};
// Q3 level -> how much clean delivery to protect (higher = softer / more protective)
const LEVEL_COMFORT: Record<string, number> = { starting: 0.72, social: 0.66, club: 0.58, competitive: 0.50 };

export function profileToBasin(p: PlayerProfile): { style: number; power: number; comfortFloor: number } {
  const base = ARCH[p.current || "new"] || ARCH["new"];
  let style = base.style, power = base.power;
  let comfortFloor = LEVEL_COMFORT[p.level || "social"] ?? 0.6;
  const wants = p.wants || [];
  // Q2 delta: nudge the target in the direction the player wants to move from their current frame
  if (wants.includes("power")) power = Math.min(0.96, power + 0.18);
  if (wants.includes("control")) style = Math.max(0.04, style - 0.16);
  if (wants.includes("comfort")) comfortFloor = Math.min(0.85, comfortFloor + 0.12);
  if (wants.includes("forgiving")) comfortFloor = Math.min(0.85, comfortFloor + 0.05);
  return { style, power, comfortFloor };
}
