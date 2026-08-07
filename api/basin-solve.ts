// PalaLab Basin — inverse solver (SERVER-ONLY, Vercel Edge).
// Reuses the real scoring engine from score.ts (never duplicated / never shipped to the
// client) as the forward model, then runs a bounded coordinate-descent search over
// FIP-legal builds to hit a player's target: high power, delivered clean, in their style.
// Returns a ranked ladder (closest stock frame -> minimal custom -> full custom) plus a
// build spec the builder can open pre-filled (origin: "basin-solve").
import { scoreSpec, CORE_MATERIALS, FACE_MATERIALS, FRAME_MATERIALS, SURFACE_TEXTURES, GRIP_MATERIALS } from "./score";
import { MARKET_RACQUETS } from "./catalog";

export const config = { runtime: "edge" };

const ids = (a: any[]) => a.map((x) => x.id);
const CORES = ids(CORE_MATERIALS), FACES = ids(FACE_MATERIALS), FRAMES = ids(FRAME_MATERIALS), SURF = ids(SURFACE_TEXTURES), GRIPS = ids(GRIP_MATERIALS);
// The solver only recommends commercially real, use-appropriate parts. The manual
// builder still exposes everything — these exclusions ONLY constrain auto-suggestions,
// so the Basin can't "cheat" by reaching for a material that scores well but that no
// player can actually buy or that's mis-used. Reasons inline.
const EXCLUDE_CORES = new Set([
  "two-piece-cassette-core",   // experimental R&D construction, not a stock core
]);
const EXCLUDE_FACES = new Set([
  "kevlar-reinforced",         // frame-reinforcement fiber — shreds when perforated as a face
  "carbon-ud",                 // pure UD face panels are commercially unexplored
  "basalt-face",               // essentially unused in padel — good on paper, not a real buy
]);
const EXCLUDE_FRAMES = new Set([
  "basalt-frame",              // essentially unused commercially in padel
]);
const EXCLUDE_SURF = new Set([
  "hybrid-texture",            // uncommon two-zone finish, not a stock option
]);
const SOLVE_CORES = CORES.filter((id) => !EXCLUDE_CORES.has(id));
const SOLVE_FACES = FACES.filter((id) => !EXCLUDE_FACES.has(id));
const SOLVE_SURF = SURF.filter((id) => !EXCLUDE_SURF.has(id));
// Frames: drop experimental R&D frames AND commercially-unused ones.
const SOLVE_FRAMES = FRAME_MATERIALS.filter((f: any) => !f.experimental && !EXCLUDE_FRAMES.has(f.id)).map((f: any) => f.id);
const SHAPES3 = ["round", "teardrop", "diamond"];
const THROATS: [string, string][] = [["closed", "vertical"], ["open", "vertical"], ["open", "diagonal"], ["open", "horizontal"]];
const HOLES = Array.from({ length: 50 }, (_, i) => ({ x: Math.cos(i) * 0.4, y: Math.sin(i * 1.3) * 0.5 }));
const DAMP_GRIP = GRIPS.indexOf("dampener-integrated-grip") >= 0 ? "dampener-integrated-grip"
  : GRIPS.indexOf("anti-shock-grip") >= 0 ? "anti-shock-grip" : GRIPS[0];

// ---- forward model: the REAL engine ------------------------------------------------
function forward(b: any) {
  const s = scoreSpec({
    shapeId: b.shape, coreId: b.core, faceId: b.face, frameId: b.frame, surfaceId: b.surf, gripId: b.grip,
    bridgeId: b.bridge, beamOrientation: b.beam, beamCount: b.beams, holes: HOLES, holeDiameterMm: 9,
    weightG: b.weight, balanceCm: b.balance, widthMm: 255, thicknessMm: b.thick, edgeProfile: "standard", sideProfile: "round",
  }).scores;
  return { power: s.power, comfort: s.comfort, control: s.control, sweet: s.sweetSpot, spin: s.spin, durability: s.durability };
}
function fipLegal(b: any) { return b.thick <= 38 && b.weight >= 340 && b.weight <= 385; }

// ---- normalization (sampled once at cold start) ------------------------------------
const NORM = (() => {
  const smp: any[] = []; let i = 0;
  for (const c of CORES) for (const f of FACES) {
    smp.push(forward({ shape: SHAPES3[i % 3], core: c, face: f, frame: FRAMES[i % FRAMES.length], surf: SURF[i % SURF.length], grip: GRIPS[i % GRIPS.length], bridge: THROATS[i % 4][0], beam: THROATS[i % 4][1], beams: 1 + (i % 3), thick: 30 + (i % 5) * 2, weight: 350 + (i % 8) * 3, balance: 24.5 + (i % 7) * 0.4 }));
    i++;
  }
  const rng = (k: string): [number, number] => [Math.min(...smp.map((s) => s[k])), Math.max(...smp.map((s) => s[k]))];
  return { P: rng("power"), C: rng("comfort"), CT: rng("control"), D: rng("durability") };
})();
// clamp to [0,1]: the NORM range is sampled over core×face only, so grip/other
// dims can push a real build just past the sampled max (e.g. a damping grip took
// comfort to 1.07). Clamp for now; widen the sampling as a finalizing detail.
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const nP = (v: number) => clamp01((v - NORM.P[0]) / ((NORM.P[1] - NORM.P[0]) || 1));
const nC = (v: number) => clamp01((v - NORM.C[0]) / ((NORM.C[1] - NORM.C[0]) || 1));
const nCt = (v: number) => clamp01((v - NORM.CT[0]) / ((NORM.CT[1] - NORM.CT[0]) || 1));
const nD = (v: number) => clamp01((v - NORM.D[0]) / ((NORM.D[1] - NORM.D[0]) || 1));
// power-leaning + low relative control reads as aggressive; high control as defensive
const styleNorm = (o: any) => Math.max(0, Math.min(1, 0.6 * nP(o.power) + 0.4 * (1 - nCt(o.control))));

// Durability floor: without it the solver treats a fiberglass frame as "free comfort"
// and hands a serious player a fragile beginner frame just because it clears the
// comfort floor by a hair. A durability floor makes the objective reflect how the
// market actually builds a comfortable performance racquet — carbon frame + soft core
// + damping, not a downgraded frame. Weighted below the comfort floor so it only
// breaks ties once power/comfort are genuinely satisfied; never overrides them.
const DUR_FLOOR = 0.55;   // normalized; ~carbon-frame territory
// Frame-tier realism: a soft (entry) frame is only coherent on a comfort-first build.
// On a performance target it's incoherent — durability alone can be rescued by a tough
// face (kevlar), so we penalize a soft frame in proportion to how performance-leaning
// the target is (low comfort floor = more performance = more penalty).
const FRAME_STIFF: Record<string, number> = {};
FRAME_MATERIALS.forEach((f: any) => { FRAME_STIFF[f.id] = f.stiffness; });
const _fs = Object.values(FRAME_STIFF); const FS_MIN = Math.min(..._fs), FS_MAX = Math.max(..._fs);
const frameStiffNorm = (id: string) => clamp01(((FRAME_STIFF[id] ?? 3) - FS_MIN) / ((FS_MAX - FS_MIN) || 1));
function cost(o: any, T: any, b?: any) {
  const durFloor = typeof T.durFloor === "number" ? T.durFloor : DUR_FLOOR;
  const framePenalty = b ? 1.4 * Math.max(0, 1 - T.comfortFloor) * (1 - frameStiffNorm(b.frame)) : 0;
  return 5.0 * Math.max(0, T.power - nP(o.power))
    + 6.0 * Math.max(0, T.comfortFloor - nC(o.comfort))
    + 1.5 * Math.abs(styleNorm(o) - T.style)
    + 2.5 * Math.max(0, durFloor - nD(o.durability))
    + framePenalty;
}

// ---- the inverse search ------------------------------------------------------------
function solveFull(T: any) {
  let b: any = { shape: "teardrop", core: "eva-medium", face: "carbon-12k", frame: "carbon-frame", surf: "rough", grip: GRIPS[0], bridge: "open", beam: "vertical", beams: 2, thick: 36, weight: 365, balance: 26 };
  const dims: any = { shape: SHAPES3, core: SOLVE_CORES, face: SOLVE_FACES, frame: SOLVE_FRAMES, surf: SOLVE_SURF, grip: GRIPS, throat: [0, 1, 2, 3], beams: [1, 2, 3], thick: [30, 32, 34, 36, 38], weight: [350, 358, 365, 372], balance: [25, 25.6, 26.2, 26.8] };
  for (let pass = 0; pass < 6; pass++) {
    for (const k in dims) {
      let bestv: any = null, bestc = cost(forward(b), T, b);
      for (const v of dims[k]) {
        const t = { ...b };
        if (k === "throat") { t.bridge = THROATS[v][0]; t.beam = THROATS[v][1]; } else t[k] = v;
        if (!fipLegal(t)) continue;
        const c = cost(forward(t), T, t);
        if (c < bestc) { bestc = c; bestv = v; }
      }
      if (bestv !== null) { if (k === "throat") { b.bridge = THROATS[bestv][0]; b.beam = THROATS[bestv][1]; } else b[k] = bestv; }
    }
  }
  return b;
}
function closestStock(T: any) {
  let best: any = null, bc = Infinity;
  for (const r of MARKET_RACQUETS) {
    const b = { shape: r.shapeId, core: r.coreId, face: r.faceId, frame: r.frameId, surf: r.surfaceId, grip: GRIPS[0], bridge: "open", beam: "vertical", beams: 2, thick: r.thicknessMm ?? 38, weight: r.weightG, balance: r.balanceCm };
    const c = cost(forward(b), T, b);
    if (c < bc) { bc = c; best = { name: (r.brand || "") + " " + (r.model || ""), b }; }
  }
  return best;
}
function minimalCustom(stockB: any) {
  return { ...stockB, core: "eva-soft", grip: DAMP_GRIP };  // soften + damp, keep face/shape
}

// ---- output shaping ----------------------------------------------------------------
function rung(tier: string, b: any, note: string) {
  const o = forward(b);
  return {
    tier,
    build: { shape: b.shape, throat: b.bridge === "closed" ? "closed" : b.beam, beams: b.beams, thicknessMm: b.thick, core: b.core, face: b.face, frame: b.frame, surface: b.surf, grip: b.grip, weightG: b.weight, balanceCm: b.balance },
    scores: { power: +o.power.toFixed(2), powerNorm: +nP(o.power).toFixed(2), comfort: +o.comfort.toFixed(2), comfortNorm: +nC(o.comfort).toFixed(2), control: +o.control.toFixed(2), styleNorm: +styleNorm(o).toFixed(2) },
    hits: { power: false, clean: false },  // filled by the handler against the target
    note,
  };
}

function toBuildSpec(b: any, T: any) {
  return {
    shapeId: b.shape, coreId: b.core, faceId: b.face, frameId: b.frame, surfaceId: b.surf, gripId: b.grip,
    bridgeId: b.bridge, beamOrientation: b.beam, beamCount: b.beams, thicknessMm: b.thick,
    weightG: b.weight, balanceCm: b.balance, widthMm: 255, holeDiameterMm: 9, edgeProfile: "standard", sideProfile: "round",
    origin: { kind: "basin-solve", target: T },
  };
}

// friendly style label -> 0..1
const STYLE_MAP: any = { control: 0.22, "all-court": 0.5, aggressive: 0.8 };

const CORS = { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };

export default async function handler(req: any) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST a target as JSON" }), { status: 405, headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  try {
    const style = typeof body.style === "string" ? (STYLE_MAP[body.style] ?? 0.5) : (typeof body.style === "number" ? body.style : 0.5);
    const T = {
      power: typeof body.power === "number" ? body.power : 0.8,          // 0..1 normalized target
      comfortFloor: typeof body.comfortFloor === "number" ? body.comfortFloor : 0.55,
      style,
    };
    const stock = closestStock(T);
    const mcB = minimalCustom(stock.b);
    const fullB = solveFull(T);

    const rows = [
      rung("closest-stock", stock.b, "Closest stock frame: " + stock.name),
      rung("minimal-custom", mcB, "One-change custom: soften the core + add a damping grip"),
      rung("full-custom", fullB, "Full custom: the solver's best legal build"),
    ];
    // compute hit-flags against the target
    for (const r of rows) {
      r.hits = { power: r.scores.powerNorm >= T.power - 0.05, clean: r.scores.comfortNorm >= T.comfortFloor - 0.05 };
    }
    return new Response(JSON.stringify({
      target: T,
      ladder: rows,
      spec: toBuildSpec(fullB, T),   // the full-custom build, ready for the builder to open
      norm: { power: NORM.P, comfort: NORM.C },
    }), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "solve_failed", detail: String((e && e.message) || e) }), { status: 500, headers: CORS });
  }
}
