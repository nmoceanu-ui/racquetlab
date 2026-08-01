// Free-transform helpers for Paint Shop art layers.
// A layer's affine transform (about its anchor x,y) is:
//   translate(x,y) rotate(rot) skewX(skx) skewY(sky) scale(sx,sy) translate(-x,-y)
// sx/sy can be negative (that is a flip). skx/sky are skew angles in degrees.
// These helpers render the on-preview drag handles and turn a handle drag into a
// layer update, and are shared by the 2D SVG preview and (via the same fields) 3D.

export function layerBox(it: any): { hw: number; hh: number; oy0: number } {
  if (!it) return { hw: 20, hh: 20, oy0: 0 };
  if (it.type === "text") {
    const w = Math.max(24, (it.text || "").length * (it.size || 24) * 0.62);
    // the text box centre sits slightly above the anchor (x,y)
    return { hw: w / 2, hh: ((it.size || 24) * 1.25) / 2, oy0: -(it.size || 24) * 0.195 };
  }
  return { hw: ((it.baseW || 100) * (it.scale || 1)) / 2, hh: ((it.baseH || 100) * (it.scale || 1)) / 2, oy0: 0 };
}

// Apply a layer's full transform to a point (px,py) -> screen/SVG point.
function applyM(it: any, cx: number, cy: number, px: number, py: number): [number, number] {
  const fx = it.sx == null ? 1 : it.sx, fy = it.sy == null ? 1 : it.sy;
  const tkx = Math.tan(((it.skx || 0) * Math.PI) / 180), tky = Math.tan(((it.sky || 0) * Math.PI) / 180);
  const r = ((it.rot || 0) * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
  let x = px - cx, y = py - cy;
  x *= fx; y *= fy;        // scale
  y += tky * x;            // skewY
  x += tkx * y;            // skewX
  const rx = x * cr - y * sr, ry = x * sr + y * cr; // rotate
  return [rx + cx, ry + cy];
}

// SVG markup for the transform handles around the selected layer.
export function layerHandlesSVG(it: any): string {
  if (!it) return "";
  const b = layerBox(it);
  const cx = it.x, cy = it.y, bcy = cy + b.oy0;
  const HS = 6;
  const pts: Record<string, [number, number]> = {
    nw: [-b.hw, -b.hh], n: [0, -b.hh], ne: [b.hw, -b.hh], e: [b.hw, 0],
    se: [b.hw, b.hh], s: [0, b.hh], sw: [-b.hw, b.hh], w: [-b.hw, 0],
  };
  let out = "";
  // thin outline of the (transformed) bounding box
  const c4 = ["nw", "ne", "se", "sw"].map((k) => applyM(it, cx, cy, cx + pts[k][0], bcy + pts[k][1]));
  out += '<polygon points="' + c4.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + '" fill="none" stroke="#1A5C2A" stroke-width="1.2" stroke-dasharray="4 3" style="pointer-events:none"/>';
  for (const k in pts) {
    const P = applyM(it, cx, cy, cx + pts[k][0], bcy + pts[k][1]);
    out += '<rect data-h="' + k + '" data-hl="' + it.id + '" x="' + (P[0] - HS).toFixed(1) + '" y="' + (P[1] - HS).toFixed(1) + '" width="' + 2 * HS + '" height="' + 2 * HS + '" rx="2" fill="#fff" stroke="#1A5C2A" stroke-width="1.5" style="cursor:pointer"/>';
  }
  // rotate handle (green circle above the top edge)
  const RP = applyM(it, cx, cy, cx, bcy - b.hh - 24);
  out += '<circle data-h="rot" data-hl="' + it.id + '" cx="' + RP[0].toFixed(1) + '" cy="' + RP[1].toFixed(1) + '" r="' + HS + '" fill="#1A5C2A" stroke="#fff" stroke-width="1.5" style="cursor:pointer"/>';
  // skew handles (amber diamonds): kx on the top edge, ky on the right edge
  const KX = applyM(it, cx, cy, cx + b.hw * 0.5, bcy - b.hh - 12);
  out += '<rect data-h="kx" data-hl="' + it.id + '" x="' + (KX[0] - HS).toFixed(1) + '" y="' + (KX[1] - HS).toFixed(1) + '" width="' + 2 * HS + '" height="' + 2 * HS + '" fill="#e0b34a" stroke="#8a6d1f" stroke-width="1.2" style="cursor:pointer" transform="rotate(45 ' + KX[0].toFixed(1) + " " + KX[1].toFixed(1) + ')"/>';
  const KY = applyM(it, cx, cy, cx + b.hw + 12, bcy + b.hh * 0.5);
  out += '<rect data-h="ky" data-hl="' + it.id + '" x="' + (KY[0] - HS).toFixed(1) + '" y="' + (KY[1] - HS).toFixed(1) + '" width="' + 2 * HS + '" height="' + 2 * HS + '" fill="#e0b34a" stroke="#8a6d1f" stroke-width="1.2" style="cursor:pointer" transform="rotate(45 ' + KY[0].toFixed(1) + " " + KY[1].toFixed(1) + ')"/>';
  return out;
}

// Turn a handle drag into a partial layer update ({sx?,sy?,skx?,sky?,rot?}).
export function computeHandleDrag(d: any, p: any, zoom: number): any {
  const dxl = (p.x - d.sx) / zoom, dyl = (p.y - d.sy) / zoom;
  const r = ((d.rot || 0) * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
  const H = d.handle, fsx = d.fsx, fsy = d.fsy, hw = d.hw, hh = d.hh;
  if (H === "rot") {
    const bx = 0, by = -hh * fsy - 24;
    const cx0 = bx * cr - by * sr, cy0 = bx * sr + by * cr;
    const a0 = Math.atan2(cy0, cx0), a1 = Math.atan2(cy0 + dyl, cx0 + dxl);
    return { rot: Math.round((d.rot || 0) + ((a1 - a0) * 180) / Math.PI) };
  }
  if (H === "kx") {
    const lx = dxl * cr + dyl * sr;
    const k = (d.skx || 0) + (Math.atan2(lx, Math.max(8, hh)) * 180) / Math.PI;
    return { skx: Math.max(-60, Math.min(60, Math.round(k))) };
  }
  if (H === "ky") {
    const ly = -dxl * sr + dyl * cr;
    const k = (d.sky || 0) + (Math.atan2(ly, Math.max(8, hw)) * 180) / Math.PI;
    return { sky: Math.max(-60, Math.min(60, Math.round(k))) };
  }
  const S: any = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
  const sg = S[H] || [0, 0];
  const bx = sg[0] * hw * fsx, by = sg[1] * hh * fsy;
  const cx0 = bx * cr - by * sr, cy0 = bx * sr + by * cr;
  const nx = cx0 + dxl, ny = cy0 + dyl;
  const lx = nx * cr + ny * sr, ly = -nx * sr + ny * cr; // back to local frame
  const upd: any = {};
  if (sg[0] !== 0) { let s = lx / (sg[0] * hw); if (Math.abs(s) < 0.05) s = s < 0 ? -0.05 : 0.05; upd.sx = Math.round(Math.max(-8, Math.min(8, s)) * 1000) / 1000; }
  if (sg[1] !== 0) { let s = ly / (sg[1] * hh); if (Math.abs(s) < 0.05) s = s < 0 ? -0.05 : 0.05; upd.sy = Math.round(Math.max(-8, Math.min(8, s)) * 1000) / 1000; }
  return upd;
}
