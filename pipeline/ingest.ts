// ingest.ts — the pipeline orchestrator. For each racquet: start from the curated legacy
// record, ask each SOURCE ADAPTER for its page, scrape → normalize → provenance record,
// then reconcile everything by trust. Produces the merged dataset + a run report.
//
// Source adapters are pluggable: a fixtures adapter for tests now, a real fetch(+headless)
// adapter for live brands/retailers later. Nothing below changes when you swap them in.
import { fromLegacy, reconcile, computeStatus, CRITICAL } from "./records";
import type { RacquetRecord, Source } from "./records";
import { scrapeToRecord } from "./scrape";

export interface SourceAdapter {
  name: string;              // e.g. "adidas-official" / "padelnuestro"
  source: Source;            // trust tier: "brand" | "retailer" | ...
  fetch(rec: { brand: string; model: string }): Promise<string | null>;  // page HTML, or null if not carried
}

export interface RunReport {
  total: number; published: number; pending: number; conflict: number;
  fieldUpgrades: number;                 // critical fields improved beyond the curated baseline
  conflicts: { id: string; fields: string[] }[];
  pendingIds: string[];
}

export async function ingest(legacy: any[], adapters: SourceAdapter[]): Promise<{ records: RacquetRecord[]; report: RunReport }> {
  const records: RacquetRecord[] = [];
  const report: RunReport = { total: legacy.length, published: 0, pending: 0, conflict: 0, fieldUpgrades: 0, conflicts: [], pendingIds: [] };
  for (const r of legacy) {
    const curated = fromLegacy(r);
    const sources: Partial<RacquetRecord>[] = [curated];
    for (const a of adapters) {
      let html: string | null = null;
      try { html = await a.fetch({ brand: r.brand, model: r.model }); } catch { html = null; }
      if (html) sources.push(scrapeToRecord(html, { brand: r.brand, model: r.model, source: a.source, sourceUrl: a.name }));
    }
    const merged = sources.length > 1 ? reconcile(sources) : curated;
    if (sources.length > 1) for (const f of CRITICAL) { const pr = (merged as any)[f]; if (pr && pr.source !== "curated") report.fieldUpgrades++; }
    records.push(merged);
    report[merged.status]++;
    if (merged.conflicts && merged.conflicts.length) report.conflicts.push({ id: merged.id, fields: merged.conflicts });
    if (merged.status === "pending") report.pendingIds.push(merged.id);
  }
  return { records, report };
}

// Convenience: the queue a human needs to work — anything not cleanly published.
export function reviewQueue(records: RacquetRecord[]) {
  return records
    .filter((r) => r.status !== "published")
    .map((r) => ({ id: r.id, brand: r.brand, model: r.model, status: r.status, needs: r.status === "conflict" ? r.conflicts : CRITICAL.filter((f) => { const pr = (r as any)[f]; return !pr || pr.confidence !== "high"; }) }));
}
