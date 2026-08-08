// PalaLab data refresh (SERVER-ONLY, Vercel Node function, cron-driven).
// Pulls every store's public Shopify collection, runs each product through the
// provenance pipeline (normalize -> reconcile -> derive -> status), computes + caches
// engine scores for published records, and upserts the whole set into the Supabase
// `racquets` table. The app + racquet pages read that table; this is the only writer.
//
// Auth: protected by CRON_SECRET (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS for the upsert),
//      CRON_SECRET. All server-only — never prefixed VITE_, never shipped to the client.
import { createClient } from "@supabase/supabase-js";
import { fromShopifyProduct } from "../pipeline/scrape";
import { reconcile, toEngineRow } from "../pipeline/records";
import { scoreSpec } from "./score";

export const config = { runtime: "nodejs", maxDuration: 60 };

export interface Store { name: string; baseUrl: string; source: any; collection: string; }
export const STORES: Store[] = [
  { name: "Padel USA", baseUrl: "https://padelusa.com", source: "retailer", collection: "padel-rackets" },
  { name: "Casas Padel", baseUrl: "https://www.casaspadel.com", source: "retailer", collection: "padel-rackets" },
  { name: "PadelPadel", baseUrl: "https://padelpadel.us", source: "retailer", collection: "padel-rackets" },
];

// A neutral default perforation pattern for the cached score (real per-racquet hole
// geometry isn't in retailer data; it barely moves the averaged score).
const HOLES = Array.from({ length: 50 }, (_, i) => ({ x: Math.cos(i) * 0.4, y: Math.sin(i * 1.3) * 0.5 }));
function scoresFor(e: any) {
  try {
    return scoreSpec({
      shapeId: e.shapeId, coreId: e.coreId, faceId: e.faceId, frameId: e.frameId || "carbon-frame",
      surfaceId: e.surfaceId || "rough", gripId: "pu-grip", bridgeId: "open", beamOrientation: "vertical",
      beamCount: 2, holes: HOLES, holeDiameterMm: 9, weightG: e.weightG || 360, balanceCm: e.balanceCm || 26,
      widthMm: 255, thicknessMm: e.thicknessMm || 38, edgeProfile: "standard", sideProfile: "round",
    }).scores;
  } catch { return null; }
}

// Pure transform (no network / no DB) so it's unit-testable: grouped store products -> upsert rows.
export function buildRows(fetched: { store: Store; products: any[] }[]) {
  const byId: Record<string, any[]> = {}, retailersById: Record<string, any[]> = {}, imageById: Record<string, string> = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const { store, products } of fetched) {
    for (const p of products) {
      const rec = fromShopifyProduct(p, store.baseUrl, store.source);
      if (!rec || !rec.id) continue;
      (byId[rec.id] = byId[rec.id] || []).push(rec);
      const v = p.variants && p.variants[0];
      (retailersById[rec.id] = retailersById[rec.id] || []).push({
        store: store.name,
        url: store.baseUrl.replace(/\/$/, "") + "/products/" + p.handle,
        price: v && v.price ? Math.round(parseFloat(v.price)) : null,
        currency: "USD",
        inStock: !!(p.variants && p.variants.some((x: any) => x.available)),
        asOf: today,
      });
      if (!imageById[rec.id] && p.images && p.images[0]) imageById[rec.id] = p.images[0].src;
    }
  }
  const rows: any[] = [];
  for (const id in byId) {
    const rec: any = reconcile(byId[id]);
    const e = toEngineRow(rec);
    rows.push({
      id: rec.id, brand: rec.brand, model: rec.model, year: rec.year || null,
      status: rec.status, discontinued: !!rec.discontinued,
      shape_id: e.shapeId, core_id: e.coreId, face_id: e.faceId, frame_id: e.frameId, surface_id: e.surfaceId,
      weight_g: e.weightG || null, balance_cm: e.balanceCm || null, thickness_mm: e.thicknessMm || null,
      image_url: imageById[id] || null, price_msrp: (rec.priceMsrp && rec.priceMsrp.value) || null,
      retailers: retailersById[id] || [],
      scores: rec.status === "published" ? scoresFor(e) : null,
      provenance: rec,
      search_text: (rec.brand + " " + rec.model).toLowerCase(),
      updated_at: new Date().toISOString(),
    });
  }
  return rows;
}

async function fetchStore(store: Store): Promise<any[]> {
  const out: any[] = [];
  for (let page = 1; page <= 40; page++) {
    const url = `${store.baseUrl.replace(/\/$/, "")}/collections/${store.collection}/products.json?limit=250&page=${page}`;
    let r: any;
    try { r = await fetch(url); } catch { break; }
    if (!r.ok) break;
    const d: any = await r.json();
    const prods = (d && d.products) || [];
    if (!prods.length) break;
    out.push(...prods);
    if (prods.length < 250) break;
  }
  return out;
}

export default async function handler(req: any, res: any) {
  const secret = process.env.CRON_SECRET;
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  const got = auth.replace(/^Bearer\s+/i, "") || (req.query && req.query.key);
  if (secret && got !== secret) return res.status(401).json({ error: "unauthorized" });

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const fetched: { store: Store; products: any[] }[] = [];
  for (const store of STORES) {
    let products: any[] = [];
    try { products = await fetchStore(store); } catch { /* skip a store that's down */ }
    fetched.push({ store, products });
  }
  const rows = buildRows(fetched);
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await sb.from("racquets").upsert(chunk, { onConflict: "id" });
    if (error) return res.status(500).json({ error: error.message, upserted });
    upserted += chunk.length;
  }
  const published = rows.filter((r) => r.status === "published").length;
  return res.status(200).json({ ok: true, stores: STORES.length, racquets: rows.length, published, pending: rows.length - published, upserted });
}
