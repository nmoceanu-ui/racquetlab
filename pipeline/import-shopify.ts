// import-shopify.ts — multi-store Shopify importer. Any Shopify padel store exposes its
// whole collection at /collections/<handle>/products.json (250/page). This pages every
// store, runs each product through the adapter, groups by id ACROSS stores, and reconciles —
// so a racquet that's incomplete on one store gets filled by another.
//
// The network is injected (FetchJson) so this stays testable and the live fetch/rate-limit
// layer is a thin ops wrapper (respect robots/ToS; JSON endpoints don't need a headless browser).
import { fromShopifyProduct } from "./scrape";
import { reconcile } from "./records";
import type { RacquetRecord, Source } from "./records";

export interface ShopifyStore { name: string; baseUrl: string; source: Source; collection?: string; }
export type FetchJson = (url: string) => Promise<any>;

export async function fetchStoreProducts(store: ShopifyStore, fetchJson: FetchJson): Promise<any[]> {
  const coll = store.collection || "padel-rackets"; const out: any[] = [];
  for (let page = 1; page <= 40; page++) {
    const url = `${store.baseUrl.replace(/\/$/, "")}/collections/${coll}/products.json?limit=250&page=${page}`;
    let data: any; try { data = await fetchJson(url); } catch { break; }
    const prods = (data && data.products) || []; if (!prods.length) break;
    out.push(...prods); if (prods.length < 250) break;
  }
  return out;
}

// Import from a list of stores, merging by id. `existing` (e.g. curated/brand records) join
// the reconcile as additional, trust-ranked sources.
export async function importShopify(stores: ShopifyStore[], fetchJson: FetchJson, existing: Partial<RacquetRecord>[] = []) {
  const byId: Record<string, Partial<RacquetRecord>[]> = {};
  const add = (r?: Partial<RacquetRecord> | null) => { if (r && r.id) (byId[r.id] = byId[r.id] || []).push(r); };
  existing.forEach(add);
  for (const store of stores) {
    const products = await fetchStoreProducts(store, fetchJson);
    for (const p of products) add(fromShopifyProduct(p, store.baseUrl, store.source));
  }
  const records = Object.values(byId).map((grp) => (grp.length > 1 ? reconcile(grp) : (grp[0] as RacquetRecord)));
  const report = {
    stores: stores.length, racquets: records.length,
    published: records.filter((r) => r.status === "published").length,
    pending: records.filter((r) => r.status === "pending").length,
    conflict: records.filter((r) => r.status === "conflict").length,
    multiSource: Object.values(byId).filter((g) => g.length > 1).length,
  };
  return { records, report };
}
