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
  return { power: s.power, comfort: s.comfort, control: s.control, sweet: s.sweetSpot, spin: s.spin };
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
  return { P: rng("power"), C: rng("comfort"), CT: rng("control") };
})();
const nP = (v: number) => (v - NORM.P[0]) / ((NORM.P[1] - NORM.P[0]) || 1);
const nC = (v: number) => (v - NORM.C[0]) / ((NORM.C[1] - NORM.C[0]) || 1);
const nCt = (v: number) => (v - NORM.CT[0]) / ((NORM.CT[1] - NORM.CT[0]) || 1);
// power-leaning + low relative control reads as aggressive; high control as defensive
const styleNorm = (o: any) => Math.max(0, Math.min(1, 0.6 * nP(o.power) + 0.4 * (1 - nCt(o.control))));

function cost(o: any, T: any) {
  return 5.0 * Math.max(0, T.power - nP(o.power))
    + 6.0 * Math.max(0, T.comfortFloor - nC(o.comfort))
    + 1.5 * Math.abs(styleNorm(o) - T.style);
}

// ---- the inverse search ------------------------------------------------------------
function solveFull(T: any) {
  let b: any = { shape: "teardrop", core: "eva-medium", face: "carbon-12k", frame: FRAMES[0], surf: "rough", grip: GRIPS[0], bridge: "open", beam: "vertical", beams: 2, thick: 36, weight: 365, balance: 26 };
  const dims: any = { shape: SHAPES3, core: CORES, face: FACES, frame: FRAMES, surf: SURF, grip: GRIPS, throat: [0, 1, 2, 3], beams: [1, 2, 3], thick: [30, 32, 34, 36, 38], weight: [350, 358, 365, 372], balance: [25, 25.6, 26.2, 26.8] };
  for (let pass = 0; pass < 6; pass++) {
    for (const k in dims) {
      let bestv: any = null, bestc = cost(forward(b), T);
      for (const v of dims[k]) {
        const t = { ...b };
        if (k === "throat") { t.bridge = THROATS[v][0]; t.beam = THROATS[v][1]; } else t[k] = v;
        if (!fipLegal(t)) continue;
        const c = cost(forward(t), T);
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
    const c = cost(forward(b), T);
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
