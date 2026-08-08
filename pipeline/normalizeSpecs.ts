// normalizeSpecs.ts — DATA-PIPELINE normalization (not app runtime; kept out of src/ so it
// never ships in the browser bundle). Turns raw brand/retailer spec strings into PalaLab
// engine enums, EN + ES (padel is Spanish-dominant), with a confidence per match.
//
// Rules are ordered MOST-SPECIFIC-FIRST and matched by keyword presence. A hit on an explicit
// term = "high" confidence; a fallback/default rule = "medium"; no hit = null -> the field goes
// `pending` (never silently guessed into an enum). Brand-proprietary names are resolved first
// via alias tables, because the density/modulus they encode is the reliable signal.

export type Conf = "high" | "medium";
export type Match<T = string> = { value: T; confidence: Conf; via: string } | null;

const strip = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const has = (h: string, kw: string) => (" " + h + " ").includes(" " + kw + " ") || h.includes(kw);

type Rule<T = string> = { value: T; kws: string[]; conf?: Conf };

function matchRules<T = string>(raw: string, rules: Rule<T>[]): Match<T> {
  const h = strip(raw);
  if (!h) return null;
  for (const r of rules) for (const kw of r.kws) if (has(h, kw)) return { value: r.value, confidence: r.conf ?? "high", via: kw };
  return null;
}

// ─────────────────────────────────────────────────────────────── SHAPE
export const SHAPE_RULES: Rule[] = [
  { value: "diamond-wide", kws: ["wide body", "widebody", "wide diamond", "diamante ancho", "diamond wide", "maxi diamond"] },
  { value: "diamond", kws: ["diamond", "diamante", "diamant"] },
  { value: "teardrop", kws: ["teardrop", "tear drop", "lagrima", "gota", "hibrida", "hibrido", "hybrid", "gouttiere"] },
  { value: "round", kws: ["round", "redonda", "redondo", "ronde", "rund"] },
];

// ─────────────────────────────────────────────────────────────── FACE MATERIAL
// Specific weaves/materials FIRST; generic "carbon" is the medium-confidence fallback.
export const FACE_RULES: Rule[] = [
  { value: "graphene", kws: ["graphene", "grafeno"] },
  { value: "basalt-face", kws: ["basalt", "basalto", "basalte"] },
  { value: "carbon-ud", kws: ["carbon ud", "carbono ud", "unidirectional", "unidireccional", " ud carbon", "carbon unidir"] },
  { value: "carbon-18k", kws: ["18k", "18 k", "24k", "24 k", "3k 18k"] },   // 24K -> highest-modulus tier
  { value: "carbon-12k", kws: ["12k", "12 k", "15k", "16k"] },              // 15/16K -> mid-high tier
  { value: "carbon-3k", kws: ["3k", "3 k", "6k"] },                          // 6K -> entry tier
  { value: "fiberglass", kws: ["fiberglass", "fibra de vidrio", "fibervidrio", "fiber glass", "glass fiber", "vidrio", "fibre de verre"] },
  // generic fallbacks
  { value: "carbon-12k", kws: ["carbon", "carbono", "carbone"], conf: "medium" },  // weave unspecified -> common midpoint
];
// Faces with no clean enum yet (aramid/kevlar/titanium) -> return null -> pending + review.
export const FACE_REVIEW_KWS = ["kevlar", "aramid", "aramida", "titanium", "titanio", "innegra", "spectra"];

// ─────────────────────────────────────────────────────────────── CORE
export const CORE_RULES: Rule[] = [
  { value: "hybrid-core", kws: ["hybrid", "hibrido", "dual density", "dual core", "doble densidad", "multicore", "multi core", "tri density", "dual dens"] },
  { value: "foam-pe", kws: ["foam", "espuma", "power foam", "tubular foam", "air inside", "polyethylene", "pe foam"] },
  { value: "eva-soft", kws: ["eva soft", "soft eva", "eva blanda", "ultrasoft", "ultra soft", "soft performance", "hr23", "blanda", "soft"] },
  { value: "eva-hard", kws: ["eva hard", "hard eva", "eva dura", "high density", "alta densidad", "hr3", "hr21", "dura", "hard"] },
  { value: "eva-medium", kws: ["eva medium", "eva media", "media densidad", "black eva", "multieva", "medium", "media"] },
  { value: "eva-medium", kws: ["eva"], conf: "medium" },   // bare "EVA" -> medium
];

// ─────────────────────────────────────────────────────────────── SURFACE
export const SURFACE_RULES: Rule[] = [
  // 3D-PRINT must be explicit print language — "3D grain" is a texture (rough), not a printed relief.
  { value: "3d-print", kws: ["3d print", "3d-print", "3d printed", "printed", "impres", "relieve", "relief", "embossed"] },
  { value: "rough", kws: ["rough", "rugosa", "rugoso", "textured", "textura", "grain", "grano", "sandpaper", "grit", "arena", "raw", "spin effect", "aspera"] },
  { value: "smooth", kws: ["smooth", "lisa", "liso", "glossy", "brillo", "gloss", "lisse"] },
];
// Surface default: unstated -> rough (HIGH). This is a documented STANDARD ASSUMPTION, not an
// estimate — rough is ~83% of the market and low-impact (spin only). Flip to `pending` here if
// you'd rather source every surface strictly.

// ─────────────────────────────────────────────────────────────── FRAME (marco)
export const FRAME_RULES: Rule[] = [
  { value: "auxetic-frame", kws: ["auxetic", "auxetico"] },
  { value: "fiberglass-frame", kws: ["fiberglass frame", "marco de fibra", "frame fiberglass"] },
  { value: "hybrid-frame", kws: ["hybrid frame", "carbon fiberglass frame", "marco hibrido"] },
  { value: "carbon-frame", kws: ["carbon frame", "marco de carbono", "carbon"], conf: "medium" }, // default: carbon
];

// ─────────────────────────────────────────────────────────────── BRIDGE / THROAT
// Usually visual, rarely specced. Default open+vertical.
export const BRIDGE_RULES: Rule<{ bridgeId: string; beamOrientation: string }>[] = [
  { value: { bridgeId: "closed", beamOrientation: "vertical" }, kws: ["closed bridge", "puente cerrado", "tubular", "solid throat", "cerrado", "closed throat"] },
  { value: { bridgeId: "open", beamOrientation: "diagonal" }, kws: ["x brace", "x-brace", "diagonal", "cross bridge"] },
  { value: { bridgeId: "open", beamOrientation: "horizontal" }, kws: ["horizontal bridge", "puente horizontal"] },
  { value: { bridgeId: "open", beamOrientation: "vertical" }, kws: ["open bridge", "puente abierto", "abierto", "vertical bridge"], conf: "medium" },
];

// ─────────────────────────────────────────────────────────────── BRAND-PROPRIETARY ALIASES
// Resolved BEFORE the generic rules — proprietary names encode density/modulus reliably.
// Starter set; grows in ops as new lines appear. Keys are normalized (strip()).
export const BRAND_CORE_ALIASES: Record<string, string> = {
  "hr3": "eva-hard", "hr21": "eva-hard", "hr23": "eva-soft", "black eva": "eva-medium",
  "multieva": "eva-medium", "power eva": "eva-hard", "soft eva performance": "eva-soft",
  "exa soft": "eva-soft", "kary soft": "eva-soft", "x eva": "eva-medium",
  "power foam": "foam-pe", "tubular power foam": "foam-pe", "air inside": "foam-pe",
  "technofusion": "foam-pe", "black core": "eva-medium",
};
export const BRAND_FACE_ALIASES: Record<string, string> = {
  "graphene xt": "graphene", "graphene 360": "graphene", "spin blade": "carbon-12k",
  "carbon aluminized": "carbon-12k", "mp carbon": "carbon-12k",
};

function aliasHit(raw: string, table: Record<string, string>): Match {
  const h = strip(raw);
  for (const k of Object.keys(table)) if (has(h, k)) return { value: table[k], confidence: "high", via: k };
  return null;
}

// ─────────────────────────────────────────────────────────────── NUMERIC PARSERS
// weight: "360-375 g" -> {min,max}; "365g" -> {min:365,max:365}
export function parseWeight(raw: string): { min: number; max: number } | null {
  // Grab every plausible gram value (handles "360-375 g", "360 a 375", "365g") and take the span.
  const nums = ((raw || "").toLowerCase().match(/\d{3}(?:[.,]\d)?/g) || [])
    .map((x) => parseFloat(x.replace(",", "."))).filter((v) => v >= 330 && v <= 420);
  if (!nums.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}
// balance: "26 cm" | "260 mm" | "26,5 cm" -> cm number
export function parseBalanceCm(raw: string): number | null {
  const h = (raw || "").toLowerCase().replace(",", ".");   // parse from RAW so decimals survive
  let m = h.match(/(\d{2,3}(?:\.\d+)?)\s*mm/); if (m) { const v = +m[1] / 10; return v >= 22 && v <= 30 ? +v.toFixed(1) : null; }
  m = h.match(/(\d{2}(?:\.\d+)?)\s*cm/); if (m) { const v = +m[1]; return v >= 22 && v <= 30 ? +v.toFixed(1) : null; }
  m = h.match(/\b(2[4-9]\d(?:\.\d+)?)\b/); if (m) { const v = +m[1] / 10; return v >= 22 && v <= 30 ? +v.toFixed(1) : null; }  // bare mm, e.g. "268.0"
  m = h.match(/\b(2[2-9](?:\.\d+)?)\b/); return m ? +(+m[1]).toFixed(1) : null;
}
// thickness: "38 mm" -> 38
export function parseThicknessMm(raw: string): number | null {
  const m = (raw || "").toLowerCase().match(/(\d{2}(?:\.\d+)?)\s*mm/); if (!m) return null;
  const v = +m[1]; return v >= 26 && v <= 40 ? Math.round(v) : null;
}

// ─────────────────────────────────────────────────────────────── TOP-LEVEL
export function normalizeShape(raw: string) { return matchRules(raw, SHAPE_RULES); }
export function normalizeFace(raw: string): Match {
  if (FACE_REVIEW_KWS.some((k) => has(strip(raw), k))) return null;   // aramid/kevlar/etc -> review
  return aliasHit(raw, BRAND_FACE_ALIASES) || matchRules(raw, FACE_RULES);
}
export function normalizeCore(raw: string) { return aliasHit(raw, BRAND_CORE_ALIASES) || matchRules(raw, CORE_RULES); }
export function normalizeSurface(raw: string): Match { return matchRules(raw, SURFACE_RULES) || { value: "rough", confidence: "high", via: "standard-assumption" }; }
export function normalizeFrame(raw: string) { return matchRules(raw, FRAME_RULES); }
export function normalizeBridge(raw: string) { return matchRules(raw, BRIDGE_RULES); }

// Normalize a whole scraped row. Returns {fields, pending[], review[]} — a field is `pending`
// when unmatched/only medium, so the verification bar (see DATA_PIPELINE_SPEC §5) can gate publish.
export function normalizeRacquet(raw: Record<string, string>) {
  const out: any = {}, pending: string[] = [], review: string[] = [];
  const put = (field: string, m: Match | null, critical: boolean) => {
    if (!m) { (critical ? pending : review).push(field); return; }
    out[field] = { value: m.value, confidence: m.confidence, via: m.via };
    if (critical && m.confidence !== "high") pending.push(field);
  };
  put("shapeId", normalizeShape(raw.shape || ""), true);
  put("faceId", normalizeFace(raw.face || raw.faceMaterial || ""), true);
  put("coreId", normalizeCore(raw.core || ""), true);
  put("surfaceId", normalizeSurface(raw.surface || ""), true);
  put("frameId", normalizeFrame(raw.frame || raw.face || ""), false);
  put("bridge", normalizeBridge(raw.bridge || raw.throat || ""), false);
  const w = parseWeight(raw.weight || ""); if (w) out.weightG = { value: w, confidence: "high" }; else pending.push("weightG");
  const b = parseBalanceCm(raw.balance || ""); if (b != null) out.balanceCm = { value: b, confidence: "high" }; else pending.push("balanceCm");
  const t = parseThicknessMm(raw.thickness || ""); if (t != null) out.thicknessMm = { value: t, confidence: "high" }; else pending.push("thicknessMm");
  const CRITICAL = ["shapeId", "faceId", "coreId", "surfaceId", "weightG", "balanceCm", "thicknessMm"];
  return { fields: out, pending, review, status: pending.some((p) => CRITICAL.includes(p)) ? "pending" : "published" };
}
