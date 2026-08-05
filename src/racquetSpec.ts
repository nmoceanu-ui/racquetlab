// racquetSpec.ts — the single shared design object for Builder ↔ Paint Shop ↔ engine ↔
// spec sheet. ADDITIVE: nothing imports this yet; wiring happens in the next step.
//
// Canonical throat model = Paint Shop's (throatType + beams). The builder's engine still
// scores from bridgeId/beamOrientation/beamCount, so we map canonical → engine inputs and
// back, with a round-trip that must preserve today's scores (see selfTest).

export const SPEC_VERSION = 1;

export type ThroatType = "closed" | "vertical" | "diagonal" | "horizontal";

// ---- throat mapping (the piece we scoped) -------------------------------------------

// canonical -> the fields the physics engine already consumes
export function throatToEngine(throatType: ThroatType, beams: number): {
  bridgeId: string; beamOrientation: string; beamCount: number;
} {
  const beamCount = Math.max(1, Math.min(3, beams || 2));
  if (throatType === "closed") return { bridgeId: "closed", beamOrientation: "vertical", beamCount };
  return { bridgeId: "open", beamOrientation: throatType, beamCount };
}

// legacy builder fields -> canonical (for migrating existing saved builds)
export function builderToThroat(b: { bridgeId?: string; beamOrientation?: string; beamCount?: number }): {
  throatType: ThroatType; beams: number;
} {
  const beams = Math.max(1, Math.min(3, b.beamCount ?? 2));
  if ((b.bridgeId || "") === "closed") return { throatType: "closed", beams };
  const o = b.beamOrientation;
  const throatType: ThroatType = o === "diagonal" || o === "horizontal" ? o : "vertical";
  return { throatType, beams };
}

// ---- the shared design object --------------------------------------------------------

export interface RacquetSpec {
  schemaVersion: number;

  // structural (drives engine + factory sheet) — single source of truth
  structural: {
    shapeId: string;                 // builder geometry is canonical
    throatType: ThroatType;          // Paint Shop model is canonical
    beams: number;
    thicknessMm: number;
    edgeProfile: "standard" | "rounded";
    bodyProfile: "standard" | "curved";   // cosmetic/construction (does NOT feed physics)
    uniformHead: boolean;                 // cosmetic/construction
    leadStrip: boolean;                   // cosmetic (milled channel only, no mass on sheet)
    perforation: { holeDiameterMm: number; holes: Array<{ x: number; y: number; d?: number }> | null; preset?: string; holeR?: number };
    grip: { id: string; shapeId?: string; bevel?: string };
    materials: { coreId: string; faceId: string; frameId: string; surfaceId: string };
    lengthMm?: number; widthMm?: number; weightG?: number; balanceCm?: number;
  };

  // paint (cosmetic) — Paint Shop owns these
  paint: {
    colours: { face: string; frame: string; throat: string; grip: string; accent: string; lead: string };
    beamColours: string[];
    pattern: string;
    finish: "matte" | "gloss";
    layers: any[];                   // text/image placements
  };

  // provenance — how this spec was created (for the sheet's Design Intent)
  origin?: { kind: "manual" | "basin-solve"; note?: string; target?: any };
}

// ---- migration: any prior shape -> current RacquetSpec -------------------------------

export function migrateSpec(raw: any): RacquetSpec {
  const d = raw || {};
  // Paint fields may be NESTED under `design` (the builder's saved format) or at the TOP
  // level (older/basin-solver objects). Read paint from whichever is present.
  const p = (d.design && typeof d.design === "object") ? d.design : d;
  // throat: prefer explicit legacy Paint Shop overrides, else derive from builder fields
  const throat = (p.paintThroat && p.paintBeams != null)
    ? { throatType: p.paintThroat as ThroatType, beams: p.paintBeams }
    : builderToThroat({ bridgeId: d.bridgeId, beamOrientation: d.beamOrientation, beamCount: d.beamCount });
  return {
    schemaVersion: SPEC_VERSION,
    structural: {
      shapeId: d.shapeId || p.paintShape || "teardrop",
      throatType: throat.throatType,
      beams: throat.beams,
      thicknessMm: d.thicknessMm ?? 38,
      edgeProfile: d.edgeProfile || p.edgeProfile || "standard",
      bodyProfile: p.bodyProfile || "standard",
      uniformHead: !!p.uniformHead,
      leadStrip: !!p.leadStrip,
      perforation: {
        holeDiameterMm: typeof d.holeDiameterMm === "number" ? d.holeDiameterMm : 9,
        holes: Array.isArray(d.holes) ? d.holes : null,
        preset: p.holePreset, holeR: p.holeR,
      },
      grip: { id: d.gripId || "standard", shapeId: d.gripShapeId, bevel: d.gripBevel },
      materials: { coreId: d.coreId || "", faceId: d.faceId || "", frameId: d.frameId || "", surfaceId: d.surfaceId || "" },
      lengthMm: d.lengthMm, widthMm: d.widthMm, weightG: d.weightG, balanceCm: d.balanceCm,
    },
    paint: {
      colours: {
        face: p.face || "#242430", frame: p.frame || "#101015", throat: p.throatC || "#c0472a",
        grip: p.grip || "#e9e3d4", accent: p.accent || "#e0b34a", lead: p.leadChannel || "#c9c9c9",
      },
      beamColours: p.beamColors || [],
      pattern: p.pattern || "solid",
      finish: p.finish || "matte",
      layers: Array.isArray(p.layers) ? p.layers : [],
    },
    origin: d.origin || p.origin,
  };
}

// Assemble the canonical spec from a builder build (flat fields + nested `design`).
// Same operation as migrateSpec (which already accepts that shape); named for call sites.
export const buildToSpec = migrateSpec;

// ---- dev self-test: throat round-trips + engine mapping is score-stable --------------

export function selfTest(): { ok: boolean; fails: string[] } {
  const fails: string[] = [];
  const cases: Array<[ThroatType, number]> = [
    ["closed", 2], ["vertical", 1], ["vertical", 3], ["diagonal", 2], ["horizontal", 3],
  ];
  for (const [tt, b] of cases) {
    const eng = throatToEngine(tt, b);
    const back = builderToThroat(eng);
    if (back.throatType !== tt || back.beams !== b)
      fails.push(`round-trip ${tt}/${b} -> ${back.throatType}/${back.beams}`);
    // engine stability: closed must map to bridgeId "closed"; others must NOT
    if (tt === "closed" && eng.bridgeId !== "closed") fails.push(`closed lost bridge`);
    if (tt !== "closed" && eng.bridgeId === "closed") fails.push(`${tt} wrongly closed`);
    if (tt !== "closed" && eng.beamOrientation !== tt) fails.push(`${tt} orientation lost`);
  }
  return { ok: fails.length === 0, fails };
}
