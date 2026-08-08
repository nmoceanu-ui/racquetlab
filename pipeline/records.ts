// records.ts — the provenance-rich racquet record: the pipeline's source of truth.
// - fromLegacy(): retrofit a flat MARKET_RACQUETS row into a provenance record (source "curated").
// - toEngineRow(): flatten a record back to the shape the live engine/catalog consumes.
// - reconcile(): merge multiple source records for one racquet by TRUST, flagging conflicts.
// Pipeline-only (never bundled into the app).

export type Source = "brand-verified" | "brand" | "review-measured" | "retailer" | "curated" | "derived";
export const TRUST: Record<Source, number> = { "brand-verified": 5, brand: 4, "review-measured": 3, retailer: 2, curated: 1, derived: 0 };

export type Conf = "high" | "medium" | "low";
export type Prov<T = any> = { value: T; source: Source; sourceUrl?: string; confidence: Conf; asOf: string };

export interface RacquetRecord {
  id: string; brand: string; model: string; year: number; discontinued?: boolean;
  status: "published" | "pending" | "conflict";
  shapeId?: Prov<string>; thicknessMm?: Prov<number>; faceId?: Prov<string>; coreId?: Prov<string>;
  surfaceId?: Prov<string>; weightG?: Prov<{ min: number; max: number }>; balanceCm?: Prov<number>;
  frameId?: Prov<string>; bridgeId?: Prov<string>; beamOrientation?: Prov<string>;
  holeCount?: Prov<number>; holeDiameterMm?: Prov<number>; priceMsrp?: Prov<number>; imageUrl?: string;
  conflicts?: string[];
  alternatives?: Record<string, Prov[]>;   // competing candidates per conflicted field (for review)
}

export const CRITICAL = ["shapeId", "thicknessMm", "faceId", "coreId", "surfaceId", "weightG", "balanceCm"] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const yearOf = (model: string) => { const m = model.match(/\((\d{4})\)/) || model.match(/\b(20\d{2})\b/); return m ? +m[1] : new Date().getFullYear(); };

// ── retrofit: flat legacy catalog row -> provenance record ──────────────────
export function fromLegacy(r: any, asOf = new Date().toISOString().slice(0, 10)): RacquetRecord {
  const year = yearOf(r.model || "");
  const p = <T>(value: T, conf: Conf = "high"): Prov<T> => ({ value, source: "curated", confidence: conf, asOf });
  const rec: RacquetRecord = {
    id: slug(`${r.brand}-${r.model}`), brand: r.brand, model: (r.model || "").replace(/\s*\(\d{4}\)/, "").trim(), year,
    status: "pending",
    shapeId: r.shapeId != null ? p(r.shapeId) : undefined,
    thicknessMm: r.thicknessMm != null ? p(r.thicknessMm) : undefined,
    faceId: r.faceId != null ? p(r.faceId) : undefined,
    coreId: r.coreId != null ? p(r.coreId) : undefined,
    surfaceId: r.surfaceId != null ? p(r.surfaceId) : undefined,
    weightG: r.weightG != null ? p({ min: r.weightG, max: r.weightG }) : undefined,
    balanceCm: r.balanceCm != null ? p(r.balanceCm) : undefined,
    frameId: r.frameId != null ? p(r.frameId, "medium") : undefined,
  };
  rec.status = computeStatus(rec);
  return rec;
}

// ── flatten: record -> the flat row the engine/catalog expects ──────────────
export function toEngineRow(rec: RacquetRecord): any {
  const w = rec.weightG?.value;
  return {
    id: rec.id, brand: rec.brand, model: rec.year ? `${rec.model} (${rec.year})` : rec.model,
    shapeId: rec.shapeId?.value, coreId: rec.coreId?.value, faceId: rec.faceId?.value,
    frameId: rec.frameId?.value ?? "carbon-frame", surfaceId: rec.surfaceId?.value,
    weightG: w ? Math.round((w.min + w.max) / 2) : undefined,
    balanceCm: rec.balanceCm?.value, thicknessMm: rec.thicknessMm?.value,
  };
}

// ── status gate ─────────────────────────────────────────────────────────────
export function computeStatus(rec: RacquetRecord): "published" | "pending" | "conflict" {
  if (rec.conflicts && rec.conflicts.length) return "conflict";
  // A field is publish-sufficient if it's a high-confidence real value OR an intentional
  // derived estimate (source "derived"). A low-confidence *scrape* is NOT — that stays pending.
  for (const f of CRITICAL) { const pr = (rec as any)[f] as Prov | undefined; if (!pr || (pr.confidence !== "high" && pr.source !== "derived")) return "pending"; }
  return "published";
}

// ── derivation: fill critical fields no source reported, tagged "derived" ─────
// Balance is the common gap in retailer listings. We estimate it from shape (the
// dominant driver: round = low/even, teardrop = mid, diamond = head-heavy) with a
// small weight nudge, and tag it source "derived" so the UI shows an honest gray dot
// rather than a warning. Only balance for now; the same pattern extends to others.
const baseShape = (s?: string) => (s === "round-angular" ? "round" : s === "diamond-angular" ? "diamond" : s === "hybrid" ? "teardrop" : s);
export function deriveBalanceCm(shapeId?: string, weightG?: number): number {
  const base: Record<string, number> = { round: 25.5, teardrop: 26.5, diamond: 27.5 };
  const b = base[baseShape(shapeId) as string] ?? 26.5;
  const nudge = Math.max(-0.4, Math.min(0.4, (((weightG ?? 360) - 360) / 25) * 0.4));
  return Math.round((b + nudge) * 10) / 10;
}
export function deriveMissing(rec: RacquetRecord, asOf = new Date().toISOString().slice(0, 10)): RacquetRecord {
  if (!rec.balanceCm && rec.shapeId) {
    const w = rec.weightG?.value ? (rec.weightG.value.min + rec.weightG.value.max) / 2 : undefined;
    rec.balanceCm = { value: deriveBalanceCm(rec.shapeId.value, w), source: "derived", confidence: "medium", asOf };
  }
  // Surface is frequently unlisted; the modern padel default is a textured/rough face
  // (smooth is the rare control-specialist exception). Default to rough, tagged derived.
  if (!rec.surfaceId) {
    rec.surfaceId = { value: "rough", source: "derived", confidence: "medium", asOf };
  }
  return rec;
}

// ── reconcile: merge source records for ONE racquet by trust, flag conflicts ─
const NUM_TOL: Record<string, number> = { thicknessMm: 2, balanceCm: 0.3, weightG: 6 };
function disagree(field: string, a: any, b: any): boolean {
  if (field === "weightG") return Math.abs((a.min + a.max) / 2 - (b.min + b.max) / 2) > NUM_TOL.weightG;
  if (typeof a === "number") return Math.abs(a - b) > (NUM_TOL[field] ?? 0);
  return a !== b;  // enums: any difference
}
export function reconcile(sources: Partial<RacquetRecord>[]): RacquetRecord {
  const base = sources[0] as RacquetRecord;
  const out: RacquetRecord = { id: base.id, brand: base.brand, model: base.model, year: base.year, status: "pending", conflicts: [] };
  const FIELDS = ["shapeId", "thicknessMm", "faceId", "coreId", "surfaceId", "weightG", "balanceCm", "frameId", "bridgeId", "beamOrientation", "holeCount", "holeDiameterMm", "priceMsrp"];
  for (const f of FIELDS) {
    const cands = sources.map((s) => (s as any)[f] as Prov | undefined).filter(Boolean) as Prov[];
    if (!cands.length) continue;
    cands.sort((a, b) => (TRUST[b.source] - TRUST[a.source]) || (rank(b.confidence) - rank(a.confidence)));
    const winner = cands[0];
    // conflict = two HIGH-confidence sources of trust>=retailer disagree
    const hi = cands.filter((c) => c.confidence === "high" && TRUST[c.source] >= TRUST.retailer);
    if (hi.length >= 2 && hi.slice(1).some((c) => disagree(f, hi[0].value, c.value))) {
      (out.conflicts as string[]).push(f);
      (out.alternatives || (out.alternatives = {}))[f] = cands;   // keep candidates for the review UI
    }
    (out as any)[f] = winner;
  }
  deriveMissing(out);   // fill balance (etc.) that no source reported, tagged "derived"
  out.status = computeStatus(out);
  return out;
}
const rank = (c: Conf) => (c === "high" ? 2 : c === "medium" ? 1 : 0);

// ── apply the review tool's resolutions back into the dataset (closes the loop) ──
export function applyResolutions(records: RacquetRecord[], resolutions: any[], asOf = new Date().toISOString().slice(0, 10)): RacquetRecord[] {
  const byId: Record<string, RacquetRecord> = {}; records.forEach((r) => (byId[r.id] = r));
  const coerce = (field: string, v: any) => {
    if (field === "weightG" && typeof v === "string") { const n = (v.match(/\d{3}/g) || []).map(Number); return n.length ? { min: Math.min(...n), max: Math.max(...n) } : v; }
    if (["balanceCm", "thicknessMm", "holeCount", "holeDiameterMm", "priceMsrp"].includes(field) && typeof v === "string") return parseFloat(v);
    return v;
  };
  for (const res of resolutions) {
    const rec = byId[res.id]; if (!rec) continue;
    (rec as any)[res.field] = { value: coerce(res.field, res.value), source: res.source || "brand-verified", confidence: "high", asOf: res.asOf || asOf };
    if (rec.conflicts) { rec.conflicts = rec.conflicts.filter((f) => f !== res.field); if (!rec.conflicts.length) delete rec.conflicts; }
    if (rec.alternatives) delete rec.alternatives[res.field];
  }
  records.forEach((r) => (r.status = computeStatus(r)));
  return records;
}

// ── generate the live engine catalog from published records (the app-migration bridge) ──
export function generateCatalog(records: RacquetRecord[]): any[] {
  return records.filter((r) => r.status === "published").map(toEngineRow);
}
