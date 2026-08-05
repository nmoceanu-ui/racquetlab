// FlowCockpit.tsx — the Build → Design → Export cockpit.
// A self-completing readiness checklist + stage navigator over the shared RacquetSpec.
// Additive + presentational: it READS the assembled spec and reports what's missing; it
// does not mutate build state and does not touch the Factory paywall (the host still gates
// the actual export/order behind payment). Undo/redo is handled by the host, not here.
import { useState } from "react";
import type { RacquetSpec } from "./racquetSpec";

type ItemStatus = "ok" | "warn" | "todo";
interface CheckItem { stage: "build" | "design" | "export"; label: string; detail?: string; status: ItemStatus; required: boolean; }

// FIP homologation limits (verified 2026 rules). Handle ≤ 20cm; length/width/thickness/holeØ.
function buildChecklist(spec: RacquetSpec, opts: { lowDpiCount?: number; hasArtwork?: boolean }): CheckItem[] {
  const s = spec.structural;
  const items: CheckItem[] = [];
  const mats = s.materials || ({} as any);
  const matsComplete = !!(mats.coreId && mats.faceId && mats.frameId && mats.surfaceId);
  const holes = s.perforation?.holes;
  const holeCount = Array.isArray(holes) ? holes.length : 0;
  const holeDia = s.perforation?.holeDiameterMm ?? 0;
  const len = s.lengthMm, wid = s.widthMm, thk = s.thicknessMm;

  // BUILD
  items.push({ stage: "build", label: "Head shape", detail: s.shapeId, status: "ok", required: true });
  items.push({ stage: "build", label: "Throat", detail: s.throatType === "closed" ? "closed bridge" : `${s.beams} × ${s.throatType}`, status: "ok", required: true });
  items.push({ stage: "build", label: "Materials", detail: matsComplete ? "core · face · frame · surface" : "incomplete", status: matsComplete ? "ok" : "todo", required: true });
  items.push({ stage: "build", label: "Perforation", detail: holeCount ? `${holeCount} holes` : "no holes", status: holeCount > 0 ? "ok" : "todo", required: true });

  // EXPORT / legality (dimensions drive FIP legality)
  const dimCheck = (label: string, v: number | undefined, ok: boolean, lim: string): CheckItem =>
    ({ stage: "export", label, detail: v != null ? `${v} mm (${lim})` : `— (${lim})`, status: v == null ? "warn" : ok ? "ok" : "todo", required: true });
  items.push(dimCheck("Length", len, len != null && len <= 455, "≤ 455"));
  items.push(dimCheck("Width", wid, wid != null && wid <= 260, "≤ 260"));
  items.push(dimCheck("Thickness", thk, thk != null && thk <= 38, "≤ 38"));
  items.push({ stage: "export", label: "Hole Ø", detail: `${holeDia} mm (9–13)`, status: holeDia >= 9 && holeDia <= 13 ? "ok" : "todo", required: true });

  // DESIGN
  items.push({ stage: "design", label: "Colourway", detail: "set", status: "ok", required: false });
  if (opts.hasArtwork) {
    const lowDpi = opts.lowDpiCount || 0;
    items.push({ stage: "design", label: "Artwork resolution", detail: lowDpi > 0 ? `${lowDpi} low-DPI logo${lowDpi > 1 ? "s" : ""}` : "verify at print size", status: lowDpi > 0 ? "warn" : "warn", required: false });
  }
  return items;
}

const STAGES: { id: "build" | "design" | "export"; label: string }[] = [
  { id: "build", label: "Build" }, { id: "design", label: "Design" }, { id: "export", label: "Export" },
];

function stageStatus(items: CheckItem[], stage: string): ItemStatus {
  const inStage = items.filter((i) => i.stage === stage);
  if (inStage.some((i) => i.required && i.status === "todo")) return "todo";
  if (inStage.some((i) => i.status === "warn")) return "warn";
  return "ok";
}

const DOT: Record<ItemStatus, string> = { ok: "#1A5C2A", warn: "#B8860B", todo: "#B0361E" };
const MARK: Record<ItemStatus, string> = { ok: "✓", warn: "!", todo: "○" };

export default function FlowCockpit({ spec, stage, onStage, lowDpiCount, hasArtwork, onExport, exportLabel }: {
  spec: RacquetSpec; stage?: "build" | "design" | "export"; onStage?: (s: "build" | "design" | "export") => void;
  lowDpiCount?: number; hasArtwork?: boolean; onExport?: () => void; exportLabel?: string;
}) {
  const [internalStage, setInternalStage] = useState<"build" | "design" | "export">("build");
  const active = stage ?? internalStage;
  const setStage = (s: "build" | "design" | "export") => { onStage ? onStage(s) : setInternalStage(s); };
  const items = buildChecklist(spec, { lowDpiCount, hasArtwork });
  const requiredTodo = items.filter((i) => i.required && i.status === "todo");
  const ready = requiredTodo.length === 0;
  const shown = items.filter((i) => i.stage === active);

  const font = "Inter, system-ui, sans-serif";
  return (
    <div style={{ fontFamily: font, background: "#FCFBF8", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Navigator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {STAGES.map((st, i) => {
          const ss = stageStatus(items, st.id);
          const on = active === st.id;
          return (
            <div key={st.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <button type="button" onClick={() => setStage(st.id)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 8px", cursor: "pointer",
                borderRadius: 9, border: `1px solid ${on ? "rgba(26,92,42,0.5)" : "rgba(0,0,0,0.08)"}`, background: on ? "rgba(26,92,42,0.10)" : "#fff",
                color: on ? "#1A5C2A" : "#6b6459", fontWeight: 700, fontSize: 12, letterSpacing: "0.02em",
              }}>
                <span style={{ width: 15, height: 15, borderRadius: "50%", background: DOT[ss], color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{MARK[ss]}</span>
                {st.label}
              </button>
              {i < STAGES.length - 1 && <span style={{ padding: "0 4px", color: "#c9c2b4" }}>→</span>}
            </div>
          );
        })}
      </div>

      {/* Overall readiness */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 9, background: ready ? "#EFF5EF" : "#FBF3EC", border: `1px solid ${ready ? "rgba(26,92,42,0.3)" : "rgba(176,54,30,0.3)"}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: ready ? "#1A5C2A" : "#B0361E" }}>
          {ready ? "✓ Factory-ready" : `${requiredTodo.length} item${requiredTodo.length > 1 ? "s" : ""} left`}
        </span>
        {onExport && (
          <button type="button" onClick={onExport} disabled={!ready} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, cursor: ready ? "pointer" : "not-allowed",
            border: "1px solid " + (ready ? "#1A5C2A" : "rgba(0,0,0,0.12)"), background: ready ? "#1A5C2A" : "#EDE8DC", color: ready ? "#fff" : "#9A958A",
          }}>{exportLabel || "Export production pack"}</button>
        )}
      </div>

      {/* Checklist for the active stage */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.map((it, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 7, background: idx % 2 ? "transparent" : "rgba(0,0,0,0.015)" }}>
            <span style={{ width: 16, height: 16, flex: "0 0 auto", borderRadius: "50%", background: DOT[it.status], color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{MARK[it.status]}</span>
            <span style={{ fontSize: 12.5, color: "#4A4A44", fontWeight: 600 }}>{it.label}</span>
            {it.detail && <span style={{ fontSize: 11.5, color: "#9A958A", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{it.detail}</span>}
            {!it.required && <span style={{ fontSize: 9.5, color: "#b8b1a3", border: "1px solid #e4ddcd", borderRadius: 4, padding: "0 4px", marginLeft: it.detail ? 6 : "auto" }}>optional</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
