// PaintDev.tsx — standalone Paint Shop preview at ?paint (dev-only).
// Renders JUST the designer with a scratch design + a "build context" bar that
// stands in for the builder (shape + throat), so we can iterate on
// PaintShop.tsx / Racquet3D.tsx without loading or navigating the whole app.
import { useState } from "react";
import RacquetDesigner from "./PaintShop";
import FlowCockpit from "./FlowCockpit";
import { buildToSpec } from "./racquetSpec";

const SHAPE_OPTS: [string, string][] = [
  ["round", "Round"], ["teardrop", "Teardrop"], ["diamond", "Diamond"], ["diamond-wide", "Wide Diamond"],
  ["round-angular", "Round — angular"], ["diamond-angular", "Diamond — angular"],
];

export default function PaintDev() {
  const [design, setDesign] = useState<any>({ finish: "matte" });
  const [shapeId, setShapeId] = useState("teardrop");
  const [bridgeId, setBridgeId] = useState("open");
  const [beamOrientation, setBeamOrientation] = useState("vertical");
  const [beamCount, setBeamCount] = useState(2);
  const [holeDiameterMm, setHoleDiameterMm] = useState(9);
  // Sample builder-style perforation: normalized (-1..1, centre-origin, y-down), clipped to the face.
  const holes = (() => {
    const pts: { x: number; y: number }[] = [];
    for (let r = -3; r <= 3; r++) for (let c = -3; c <= 3; c++) {
      const x = c * 0.26, y = r * 0.24;
      if (Math.sqrt(x * x + y * y) < 0.9) pts.push({ x, y });
    }
    return pts;
  })();
  const sd = (u: any) => setDesign((p: any) => (typeof u === "function" ? u(p) : u));
  const ctl: any = { fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid #cfc8b8", background: "#fff" };
  const lb: any = { fontSize: 11, color: "#6b6459", display: "inline-flex", alignItems: "center", gap: 4 };
  return (
    <div style={{ minHeight: "100vh", background: "#EDE8DC", padding: 16, boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ fontSize: 12, color: "#6b6459", marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em" }}>
          PAINT SHOP · dev preview (?paint) — edits to PaintShop.tsx / Racquet3D.tsx hot-reload here
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10, padding: "8px 10px", background: "#E3DECF", borderRadius: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b6459" }}>BUILD (stands in for the builder):</span>
          <label style={lb}>Shape <select value={shapeId} onChange={e => setShapeId(e.target.value)} style={ctl}>{SHAPE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label style={lb}>Bridge <select value={bridgeId} onChange={e => setBridgeId(e.target.value)} style={ctl}><option value="open">open</option><option value="closed">closed</option></select></label>
          <label style={lb}>Beam <select value={beamOrientation} onChange={e => setBeamOrientation(e.target.value)} style={ctl}><option value="vertical">vertical</option><option value="diagonal">diagonal</option><option value="horizontal">horizontal</option></select></label>
          <label style={lb}>Count <select value={String(beamCount)} onChange={e => setBeamCount(Number(e.target.value))} style={ctl}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
          <label style={lb}>Hole Ø <select value={String(holeDiameterMm)} onChange={e => setHoleDiameterMm(Number(e.target.value))} style={ctl}><option value="9">9mm</option><option value="10">10mm</option><option value="11">11mm</option><option value="12">12mm</option><option value="13">13mm</option></select></label>
        </div>
        <div style={{ marginBottom: 10 }}>
          <FlowCockpit
            spec={buildToSpec({
              shapeId, bridgeId, beamOrientation, beamCount, holes, holeDiameterMm,
              coreId: "eva-medium", faceId: "carbon-12k", frameId: "hollow-tubular-frame", surfaceId: "raw", gripId: "standard-grip",
              lengthMm: 455, widthMm: 255, thicknessMm: 38, weightG: 365, balanceCm: 26, handleLengthMm: 200, design,
            })}
            hasArtwork={(design.layers || []).some((l: any) => l && l.type === "image")}
          />
        </div>
        <RacquetDesigner shapeId={shapeId} bridgeId={bridgeId} beamOrientation={beamOrientation} beamCount={beamCount} holes={holes} holeDiameterMm={holeDiameterMm} design={design} setDesign={sd} />
      </div>
    </div>
  );
}
