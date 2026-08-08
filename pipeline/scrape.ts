// scrape.ts — the first scraper: HTML spec-table -> normalized provenance record.
// The fetch/scheduling layer is ops (respect robots/ToS; JS-rendered sites need a headless
// browser). This module owns the reusable, testable part: extract a spec table from HTML,
// map its labels (ES/EN) to raw fields, normalize via normalizeSpecs, and emit Prov fields.
import { normalizeShape, normalizeFace, normalizeCore, normalizeSurface, normalizeFrame, parseWeight, parseBalanceCm, parseThicknessMm } from "./normalizeSpecs";
import type { Prov, Source, RacquetRecord } from "./records";

const ENT: Record<string, string> = { nbsp: " ", amp: "&", euro: "€", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü", ordm: "º", deg: "°" };
const decodeEnt = (s: string) => s.replace(/&([a-z]+);/gi, (_, n) => ENT[n.toLowerCase()] ?? " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
const stripTags = (s: string) => decodeEnt(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const low = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Pull label:value pairs from common structures: <tr><td>L</td><td>V</td></tr>, <th>/<td>, <dt>/<dd>.
export function extractSpecTable(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const push = (l: string, v: string) => { const L = low(stripTags(l)); const V = stripTags(v); if (L && V) out[L] = V; };
  let m: RegExpExecArray | null;
  const tr = /<tr[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  while ((m = tr.exec(html))) push(m[1], m[2]);
  const dl = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dl.exec(html))) push(m[1], m[2]);
  // <li><strong>Label:</strong> value</li> and <li><strong>Label</strong>: value</li>
  const li = /<li[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*:?\s*([\s\S]*?)<\/li>/gi;
  while ((m = li.exec(html))) push(m[1].replace(/:\s*$/, ""), m[2]);
  // <strong>Label:</strong> value — label may be wrapped in <p>/<li> (e.g. Padel USA's
  // <li><p><strong>Weight:</strong> 360–375 g</p></li>), value follows the closing tag.
  // Single-word labels only, so marketing bold like "Weight Balance system" can't match.
  const st = /<strong[^>]*>\s*([A-Za-z]{2,16})\s*:?\s*<\/strong>\s*:?\s*([^<]{1,60})/gi;
  while ((m = st.exec(html))) { const l = low(stripTags(m[1])), v = stripTags(m[2]); if (l && v && !out[l]) out[l] = v; }
  // "Label: <span>value</span>" or "Label: value" at a tag boundary (div/inline spec rows).
  // Anchored at (start|>) so it catches structured rows, not colons buried in prose.
  const col = /(?:^|>)\s*([A-Za-z][A-Za-z ]{1,20}?)\s*:\s*(?:<span[^>]*>\s*)?([^<]{1,60})/gi;
  while ((m = col.exec(html))) { const l = low(stripTags(m[1])), v = stripTags(m[2]); if (l && v && !out[l]) out[l] = v; }
  return out;
}

// Retailer label -> our raw field. First keyword found in a label wins.
// Order matters: more-specific labels first (e.g. "outer/inner composition" before bare "surface").
const LABELS: [string, string[]][] = [
  ["shape", ["forma", "shape", "formato"]],
  ["face", ["outer composition", "face material", "cara", "plano", "tejido", "face", "material del plano", "superficie de golpeo", "outer", "layers"]],
  ["core", ["inner composition", "nucleo", "goma", "core", "densidad", "foam", "eva", "inner"]],  // brands often label the core "EVA"
  ["surface", ["playing surface", "superficie", "acabado", "textura", "rugosidad", "terminacion", "surface"]],
  ["frame", ["marco", "frame", "estructura", "chasis", "construccion"]],
  ["weight", ["peso", "weight"]],
  ["balance", ["balance", "equilibrio"]],
  ["thickness", ["grosor", "profile", "perfil", "espesor", "thickness", "beam", "width"]],  // padel stores use Width/Beam for profile depth
  ["holes", ["agujeros", "orificios", "holes"]],
  ["price", ["precio", "pvp", "price"]],
];
export function mapLabels(table: Record<string, string>): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [label, value] of Object.entries(table)) {
    for (const [field, kws] of LABELS) {
      if (raw[field]) continue;
      // word-boundary match so "face" doesn't match inside "surface", etc.
      if (kws.some((k) => (" " + label + " ").includes(" " + k + " "))) { raw[field] = value; break; }
    }
  }
  return raw;
}

// raw fields -> Prov-wrapped record fragment (source-tagged). Numeric fields parsed; enums normalized.
export function scrapeToRecord(html: string, meta: { brand: string; model: string; source: Source; sourceUrl?: string; asOf?: string }): Partial<RacquetRecord> {
  const asOf = meta.asOf || new Date().toISOString().slice(0, 10);
  const raw = mapLabels(extractSpecTable(html));
  const prov = <T>(value: T, confidence: "high" | "medium" | "low"): Prov<T> => ({ value, source: meta.source, sourceUrl: meta.sourceUrl, confidence, asOf });
  const enumField = (v: string | undefined, fn: (s: string) => any) => { if (!v) return undefined; const m = fn(v); return m ? prov(m.value, m.confidence) : undefined; };

  const bareModel = meta.model.replace(/\s*\(\d{4}\)/, "").trim();
  const esc = meta.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleanModel = bareModel.replace(new RegExp("^" + esc + "\\s+", "i"), "").trim() || bareModel;  // drop a repeated brand
  const slug = `${meta.brand} ${cleanModel}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const rec: Partial<RacquetRecord> = {
    id: slug, brand: meta.brand, model: cleanModel,
    year: (meta.model.match(/\((\d{4})\)/) || [])[1] ? +(meta.model.match(/\((\d{4})\)/) as any)[1] : new Date().getFullYear(),
    shapeId: enumField(raw.shape, normalizeShape),
    faceId: enumField(raw.face, normalizeFace),
    coreId: enumField(raw.core, normalizeCore),
    surfaceId: enumField(raw.surface, normalizeSurface),
    frameId: enumField(raw.frame, normalizeFrame),  // only from a real Frame field — never guessed from the face
    thicknessMm: undefined, weightG: undefined, balanceCm: undefined,
  };
  const w = parseWeight(raw.weight || ""); if (w) rec.weightG = prov(w, "high");
  const b = parseBalanceCm(raw.balance || ""); if (b != null) rec.balanceCm = prov(b, "high");
  const t = parseThicknessMm(raw.thickness || ""); if (t != null) rec.thicknessMm = prov(t, "high");
  const hc = (raw.holes || "").match(/\d{2}/); if (hc) rec.holeCount = prov(+hc[0], "high");
  const pr = (raw.price || "").match(/\d{2,4}/); if (pr) rec.priceMsrp = prov(+pr[0], "medium");
  return rec;
}

// ── Shopify adapter: a /products/<handle>.json product object -> record ──────
// Works for any Shopify padel store (padelusa.com, etc.). Specs live in body_html
// as a <ul><li><strong>Label:</strong> value</li> list, which extractSpecTable now reads.
export function fromShopifyProduct(product: any, storeUrl: string, source: Source = "retailer"): Partial<RacquetRecord> | null {
  if (product.product_type && !/rack|racket|pala/i.test(product.product_type)) return null;  // rackets only
  const url = storeUrl.replace(/\/$/, "") + "/products/" + product.handle;
  const rec = scrapeToRecord(product.body_html || "", { brand: product.vendor, model: product.title, source, sourceUrl: url });
  const price = product.variants && product.variants[0] && parseFloat(product.variants[0].price);
  if (price) (rec as any).priceMsrp = { value: Math.round(price), source, confidence: "medium", asOf: new Date().toISOString().slice(0, 10) };
  return rec;
}
