import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Hole = { x: number; y: number };

export default function Racquet3D(props: {
  shape: string;
  throatType: string;
  beams: number;
  face: string;
  frame: string;
  throatC: string;
  grip: string;
  accent: string;
  pattern: string;
  finish: string;
  zoom: number;
  layers: any[];
  beamColors: string[];
  holes: Hole[];
  holeR: number;
  editHoles?: boolean;
  setDesign?: (u: any) => void;
  selId?: number | null;
  setSelId?: (id: number | null) => void;
  leadChannel?: string;
  leadImg?: string;
  leadThroat?: boolean;
  sideImg?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ctrlRef = useRef<any>(null);
  const baseDistRef = useRef<number>(1170);
  const camStateRef = useRef<any>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  const frameMatRef = useRef<any>(null);
  const gripMatRef = useRef<any>(null);
  const leadMatRef = useRef<any>(null);
  const leadTexRef = useRef<any>(null);
  const redrawLeadRef = useRef<(() => void) | null>(null);
  const edgeTexRef = useRef<any>(null);
  const redrawEdgeRef = useRef<(() => void) | null>(null);
  const throatTexRef = useRef<any>(null);
  const redrawThroatRef = useRef<(() => void) | null>(null);
  const beamMatsRef = useRef<any[]>([]);
  const imgCacheRef = useRef<Map<string, { img: HTMLImageElement; loaded: boolean }>>(new Map());
  const propsRef = useRef(props);
  propsRef.current = props;

  const { zoom } = props;
  // Heavy rebuild only when geometry actually changes...
  const geoKey = JSON.stringify({
    shape: props.shape, throatType: props.throatType, beams: props.beams,
    holes: props.holes, holeR: props.holeR, finish: props.finish, leadThroat: props.leadThroat,
  });
  // ...re-bake the face texture (no rebuild) when these change — keeps dragging
  // the image size/rotate/opacity/position perfectly smooth. IMPORTANT: never
  // JSON.stringify the whole layers array — image hrefs are giant base64 data
  // URLs, and serializing them on every render/slider-tick is what made the
  // transitions stutter. Build a CHEAP signature from only the fields that affect
  // the bake, fingerprinting hrefs by length + a few chars instead of the payload.
  const hrefSig = (s: string): string => (s ? s.length + "~" + s.slice(0, 24) + "~" + s.slice(-12) : "0");
  const layerSig = (l: any): string => (l
    ? [l.id, l.type, l.side, l.x, l.y, l.size, l.scale, l.rot, l.sx, l.sy, l.skx, l.sky, l.opacity, l.color, l.font, l.text, l.baseW, l.baseH, hrefSig(l.href)].join(",")
    : "_");
  const texKey = (props.layers || []).map(layerSig).join("|") + "||" + (props.face || "") + "|" + (props.pattern || "") + "|" + (props.accent || "") + "|" + hrefSig(props.sideImg || "");
  // ...and just recolour materials in place (instant) when a colour swatch changes.
  const colorKey = JSON.stringify({ frame: props.frame, throatC: props.throatC, grip: props.grip, beamColors: props.beamColors, leadChannel: props.leadChannel });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.style.position = "relative";
    let captionEl: HTMLDivElement | null = null;

    // ---- constants that match the 2D designer ----
    const CX = 340, CY0 = 352;
    const CFG: any = {
      round:    { cy: 224, rx: 170, ry: 186, n: 2.5, nb: 0.05, nt: 0.05 },
      teardrop: { cy: 214, rx: 166, ry: 188, n: 2.2, nb: 0.30, nt: 0.04 },
      diamond:  { cy: 220, rx: 170, ry: 190, n: 3.0, nb: 0.42, nt: -0.06 },
    };
    const shape = CFG[props.shape] ? props.shape : "teardrop";
    const c = CFG[shape];

    const genPts = (dx: number, dy: number): [number, number][] => {
      const rx = c.rx - dx, ry = c.ry - dy;
      const out: [number, number][] = [];
      for (let i = 0; i < 120; i++) {
        const th = -Math.PI / 2 + (2 * Math.PI * i) / 120;
        const ct = Math.cos(th), st = Math.sin(th);
        const ex = (ct < 0 ? -1 : 1) * Math.pow(Math.abs(ct), 2 / c.n);
        const ey = (st < 0 ? -1 : 1) * Math.pow(Math.abs(st), 2 / c.n);
        let f = 1;
        if (st > 0) f = 1 - c.nb * st; else f = 1 - c.nt * (-st);
        out.push([CX + rx * f * ex, c.cy + ry * ey]);
      }
      return out;
    };

    const S = (px: number, py: number): [number, number] => [px - CX, -(py - CY0)];

    const head = genPts(0, 0);
    const fpts = genPts(13, 13);

    // ---- renderer / scene / camera ----
    const scene = new THREE.Scene();
    scene.background = null;
    let W = mount.clientWidth || 480;
    let H = mount.clientHeight || 460;
    const camera = new THREE.PerspectiveCamera(35, W / H, 1, 8000);
    camera.position.set(300, 140, 1120);
    camRef.current = camera;
    baseDistRef.current = camera.position.length();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.9;
    controls.minDistance = 240;
    controls.maxDistance = 2600;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.9;
    controls.target.set(0, 0, 0);
    ctrlRef.current = controls;

    if (camStateRef.current) {
      camera.position.fromArray(camStateRef.current.pos);
      controls.target.fromArray(camStateRef.current.tgt);
      controls.update();
    } else {
      const dir = camera.position.clone().sub(controls.target).normalize();
      const dist = Math.max(controls.minDistance, Math.min(controls.maxDistance, baseDistRef.current / (zoom || 1)));
      camera.position.copy(controls.target.clone().add(dir.multiplyScalar(dist)));
      controls.update();
    }

    // ---- lights ----
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const l1 = new THREE.DirectionalLight(0xffffff, 0.95); l1.position.set(-0.4, 0.8, 1); scene.add(l1);
    const l2 = new THREE.DirectionalLight(0xffffff, 0.45); l2.position.set(0.7, -0.3, 0.6); scene.add(l2);
    const l3 = new THREE.DirectionalLight(0xffffff, 0.35); l3.position.set(0.2, 0.4, -1); scene.add(l3);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.3));

    const group = new THREE.Group();
    scene.add(group);

    const pathOf = (pts: [number, number][]): THREE.Path => {
      const p = new THREE.Path();
      pts.forEach((pt, i) => { const [x, y] = S(pt[0], pt[1]); if (i === 0) p.moveTo(x, y); else p.lineTo(x, y); });
      p.closePath();
      return p;
    };
    const shapeOf = (pts: [number, number][], holes?: THREE.Path[]): THREE.Shape => {
      const sh = new THREE.Shape();
      pts.forEach((pt, i) => { const [x, y] = S(pt[0], pt[1]); if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); });
      sh.closePath();
      if (holes) sh.holes = holes;
      return sh;
    };

    // ---- face texture (base + pattern + layers) baked to a canvas ----
    const sxs = fpts.map((p) => p[0]); const sys = fpts.map((p) => p[1]);
    const sminX = Math.min(...sxs), smaxX = Math.max(...sxs);
    const sminY = Math.min(...sys), smaxY = Math.max(...sys);
    const sW = smaxX - sminX, sH = smaxY - sminY;
    const RES = 5;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(4, Math.round(sW * RES));
    canvas.height = Math.max(4, Math.round(sH * RES));
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    (texture as any).colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    const darken = (hex: string, amt: number): string => {
      const h = (hex || "#242430").replace("#", "");
      const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
      let r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
      if (isNaN(r)) { r = 36; g = 36; b = 48; }
      r = Math.max(0, Math.round(r * (1 - amt)));
      g = Math.max(0, Math.round(g * (1 - amt)));
      b = Math.max(0, Math.round(b * (1 - amt)));
      return "rgb(" + r + "," + g + "," + b + ")";
    };
    const setSvgTransform = () => { ctx.setTransform(RES, 0, 0, RES, -sminX * RES, -sminY * RES); };

    // Re-bake the whole face texture from the LATEST props. Images are cached by
    // href so re-baking (e.g. while dragging size/rotate) never reloads them.
    const redraw = () => {
      const P = propsRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSvgTransform();
      if (P.pattern === "gradient") {
        const g = ctx.createLinearGradient(0, sminY, 0, smaxY);
        g.addColorStop(0, P.face || "#242430");
        g.addColorStop(1, darken(P.face || "#242430", 0.5));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = P.face || "#242430";
      }
      ctx.fillRect(sminX, sminY, sW, sH);
      const cy = c.cy;
      if (P.pattern === "split") { ctx.fillStyle = P.accent || "#e0b34a"; ctx.fillRect(sminX, cy, sW, smaxY - cy); }
      if (P.pattern === "halo") {
        ctx.strokeStyle = P.accent || "#e0b34a"; ctx.lineWidth = 13;
        ctx.beginPath(); ctx.arc(CX, cy, 96, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.7; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(CX, cy, 60, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (P.pattern === "stripes") {
        ctx.fillStyle = P.accent || "#e0b34a";
        for (let x = sminX - sH; x < smaxX + sH; x += 44) {
          ctx.beginPath();
          ctx.moveTo(x, sminY); ctx.lineTo(x + 22, sminY);
          ctx.lineTo(x + 22 - sH, smaxY); ctx.lineTo(x - sH, smaxY);
          ctx.closePath(); ctx.fill();
        }
      }
      (P.layers || []).filter((it: any) => it && (it.side || "face") === "face").forEach((it: any) => {
        if (it.type === "text") {
          ctx.save();
          ctx.translate(it.x, it.y);
          ctx.rotate(((it.rot || 0) * Math.PI) / 180);
          ctx.transform(1, Math.tan(((it.sky || 0) * Math.PI) / 180), Math.tan(((it.skx || 0) * Math.PI) / 180), 1, 0, 0);
          ctx.scale(it.sx == null ? 1 : it.sx, it.sy == null ? 1 : it.sy);
          ctx.font = (it.size || 24) + "px " + (it.font || "sans-serif");
          ctx.fillStyle = it.color || "#ffffff";
          ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
          ctx.fillText(it.text || "", 0, 0);
          ctx.restore();
          return;
        }
        if (!it.href) return;
        let cached = imgCacheRef.current.get(it.href);
        if (!cached) {
          const img = new Image(); img.crossOrigin = "anonymous";
          cached = { img, loaded: false };
          imgCacheRef.current.set(it.href, cached);
          img.onload = () => { cached!.loaded = true; redrawRef.current && redrawRef.current(); };
          img.src = it.href;
        }
        if (cached.loaded) {
          ctx.save();
          ctx.translate(it.x, it.y);
          ctx.rotate(((it.rot || 0) * Math.PI) / 180);
          ctx.transform(1, Math.tan(((it.sky || 0) * Math.PI) / 180), Math.tan(((it.skx || 0) * Math.PI) / 180), 1, 0, 0);
          ctx.scale(it.sx == null ? 1 : it.sx, it.sy == null ? 1 : it.sy);
          ctx.scale(it.scale || 1, it.scale || 1);
          ctx.globalAlpha = it.opacity != null ? it.opacity : 1;
          try { ctx.drawImage(cached.img, -it.baseW / 2, -it.baseH / 2, it.baseW, it.baseH); } catch (e) { /* tainted */ }
          ctx.restore();
        }
      });
      texture.needsUpdate = true;
    };
    redrawRef.current = redraw;

    // ---- materials (gloss vs matte) ----
    const glossy = props.finish === "gloss";
    const faceMat: THREE.Material = glossy
      ? new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.16, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.1, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
    // holes reveal a deep, near-black inner cavity (the foam core), so a
    // perforation always reads as a dark hole — face-on and at any angle —
    // instead of a flat grey disc getting in the way.
    const foamMat = new THREE.MeshStandardMaterial({ color: 0x0d0d11, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide });
    const frameMat: THREE.Material = glossy
      ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(props.frame || "#101015"), roughness: 0.14, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: new THREE.Color(props.frame || "#101015"), roughness: 0.68, metalness: 0.15, side: THREE.DoubleSide });
    const gripMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(props.grip || "#e9e3d4"), roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide });
    frameMatRef.current = frameMat;
    gripMatRef.current = gripMat;
    const beamMats: any[] = [];
    beamMatsRef.current = beamMats;
    const beamMat = (i: number): THREE.Material => {
      const col = new THREE.Color((props.beamColors && props.beamColors[i]) || props.throatC || "#c0472a");
      const m: any = glossy
        ? new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.16, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.1, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.12, side: THREE.DoubleSide });
      beamMats[i] = m;
      return m;
    };

    // ---- depths ----
    const T = 30, tp = 6, Tfoam = 14;

    const setFaceUV = (geo: THREE.ExtrudeGeometry) => {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const X = pos.getX(i), Y = pos.getY(i);
        const px = X + CX, py = CY0 - Y;
        uv.setXY(i, (px - sminX) / sW, (py - sminY) / sH);
      }
      uv.needsUpdate = true;
    };

    const holePaths: THREE.Path[] = (props.holes || []).map((h: any) => {
      const [hx, hy] = S(CX + h.x, c.cy + h.y);
      const p = new THREE.Path();
      p.absarc(hx, hy, props.holeR || 5.6, 0, Math.PI * 2, true);
      return p;
    });

    const frontGeo = new THREE.ExtrudeGeometry(shapeOf(fpts, holePaths), { depth: tp, bevelEnabled: false, steps: 1 });
    setFaceUV(frontGeo);
    const frontPlate = new THREE.Mesh(frontGeo, [faceMat, foamMat]);
    frontPlate.position.z = T / 2 - tp;
    group.add(frontPlate);

    const backGeo = new THREE.ExtrudeGeometry(shapeOf(fpts, holePaths), { depth: tp, bevelEnabled: false, steps: 1 });
    setFaceUV(backGeo);
    const backPlate = new THREE.Mesh(backGeo, [faceMat, foamMat]);
    backPlate.position.z = -T / 2;
    group.add(backPlate);

    // dark inner core sitting a little behind the face, so holes look deep
    const foamGeo = new THREE.ExtrudeGeometry(shapeOf(fpts), { depth: Tfoam, bevelEnabled: false, steps: 1 });
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.position.z = -Tfoam / 2 - 2;
    group.add(foam);

    // invisible pick plane over the whole face (for click-to-edit holes)
    const pickMesh = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(fpts)), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    pickMesh.position.z = T / 2 + 0.5;
    group.add(pickMesh);
    // raycast targets for dragging layers: the face plane, plus the throat panel
    // (added later) so throat art can be grabbed and moved directly in 3D too.
    const pickTargets: any[] = [pickMesh];

    // Solid frame ring — ONE full-depth band around the head with lightly beveled
    // front/back edges. No recessed lead groove: the whole profile is a single clean
    // frame edge, matching the throat rails (which are already solid).
    const FD = T + 8;             // full frame depth (38)
    const frameRingGeo = new THREE.ExtrudeGeometry(shapeOf(head, [pathOf(fpts)]), { depth: FD, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 4, curveSegments: 24, steps: 1 });
    const frameRing = new THREE.Mesh(frameRingGeo, frameMat);
    frameRing.position.z = -FD / 2;
    group.add(frameRing);

    // lead-tape channel: a thin recolourable band running around the frame
    const leadMat: THREE.Material = glossy
      ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(props.leadChannel || "#c9c9c9"), roughness: 0.2, metalness: 0.55, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      : new THREE.MeshStandardMaterial({ color: new THREE.Color(props.leadChannel || "#c9c9c9"), roughness: 0.5, metalness: 0.45, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    leadMatRef.current = leadMat;
    // an optional image wrapped around the channel (patterned lead-tape look)
    const leadCanvas = document.createElement("canvas");
    leadCanvas.width = 2400; leadCanvas.height = 144;
    const lctx = leadCanvas.getContext("2d") as CanvasRenderingContext2D;
    const leadTexture = new THREE.CanvasTexture(leadCanvas);
    leadTexture.wrapS = THREE.ClampToEdgeWrapping;
    leadTexture.wrapT = THREE.ClampToEdgeWrapping;
    (leadTexture as any).colorSpace = THREE.SRGBColorSpace;
    leadTexture.anisotropy = 8;
    leadTexRef.current = leadTexture;
    // (the channel ribbon geometry is built in the throat section below, once the
    // head/throat anchor points are known, so it can flow as one continuous piece)

    // bake the channel image (if any) onto its own texture; else leave colour only
    const redrawLead = () => {
      const P = propsRef.current;
      const lm = leadMatRef.current;
      if (!lm) return;
      // ONLY "Lead strip"-placed layers live on the channel — no legacy image and no
      // edge/face/throat bleed. Images first so text always sits on top.
      const leadLayers = (P.layers || []).filter((l: any) => l && (l.side || "") === "lead");
      if (leadLayers.length === 0) { lm.map = null; lm.color.set(P.leadChannel || "#c9c9c9"); lm.needsUpdate = true; return; }
      const cw = leadCanvas.width, ch = leadCanvas.height;
      lctx.clearRect(0, 0, cw, ch);
      // "Lead strip"-placed layers: each runs ALONG the channel (u = length from the
      // layer's y), centred across the strip. Size/rotate/opacity come from the layer.
      leadLayers.forEach((it: any) => {
        const u = Math.max(0.03, Math.min(0.97, (((it.y != null ? it.y : 150) - 48) / 464)));
        lctx.save();
        lctx.translate(u * cw, ch / 2);
        lctx.rotate(((it.rot || 0) * Math.PI) / 180);
        lctx.transform(1, Math.tan(((it.sky || 0) * Math.PI) / 180), Math.tan(((it.skx || 0) * Math.PI) / 180), 1, 0, 0);
        lctx.scale(it.sx == null ? 1 : it.sx, it.sy == null ? 1 : it.sy);
        if (it.type === "text") {
          lctx.font = Math.max(8, (it.size || 24) * 3.6) + "px " + (it.font || "sans-serif");
          lctx.fillStyle = it.color || "#ffffff";
          lctx.textAlign = "center"; lctx.textBaseline = "middle";
          lctx.fillText(it.text || "", 0, 0);
        } else if (it.href) {
          let cached = imgCacheRef.current.get(it.href);
          if (!cached) {
            const img = new Image(); img.crossOrigin = "anonymous";
            cached = { img, loaded: false };
            imgCacheRef.current.set(it.href, cached);
            img.onload = () => { cached!.loaded = true; redrawLeadRef.current && redrawLeadRef.current(); };
            img.src = it.href;
          }
          if (cached.loaded) {
            const dw = (it.baseW || 100) * (it.scale || 1) * 2.1, dh = (it.baseH || 100) * (it.scale || 1) * 2.1;
            lctx.globalAlpha = it.opacity != null ? it.opacity : 1;
            try { lctx.drawImage(cached.img, -dw / 2, -dh / 2, dw, dh); } catch (e) { /* tainted */ }
          }
        }
        lctx.restore();
      });
      leadTexture.needsUpdate = true;
      lm.map = leadTexture; lm.color.set("#ffffff"); lm.needsUpdate = true;
    };
    redrawLeadRef.current = redrawLead;

    // ---- throat + grip ----
    const zc = 0;
    const beamDepth = T + 8;
    const AL = S(head[75][0], head[75][1]);
    const AR = S(head[45][0], head[45][1]);
    const gripTopL = S(CX - 24, 486);
    const gripTopR = S(CX + 24, 486);
    const gripTopC = S(CX, 486);
    const gripBotC = S(CX, 664);

    const strut = (p1: number[], p2: number[], width: number, depth: number, mat: THREE.Material) => {
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
      const len = Math.max(1, Math.hypot(dx, dy));
      const g = new THREE.BoxGeometry(len, width, depth);
      const m = new THREE.Mesh(g, mat);
      m.position.set((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, zc);
      m.rotation.z = Math.atan2(dy, dx);
      group.add(m);
    };

    // A straight throat rail (same rectangle as the original box strut) but with the
    // very bottom OUTER corner rounded off, where the rail meets the grip. It's a flat
    // 2D silhouette extruded through the frame depth, so the sides stay straight/sharp
    // exactly as before — only that one outside corner is filleted.
    const roundedRail = (A: number[], G: number[], width: number, depth: number, r: number, outerSign: number, mat: THREE.Material) => {
      const w = width / 2;
      const dx = G[0] - A[0], dy = G[1] - A[1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;       // axis A(top) -> G(bottom)
      let nx = -uy, ny = ux;                     // in-plane normal
      if (Math.sign(nx) !== Math.sign(outerSign)) { nx = -nx; ny = -ny; } // make it point OUTWARD
      const rb = Math.min(r, width * 0.96, len * 0.45); // along the bottom edge (capped by the rail width)
      const ru = Math.min(r, len * 0.5);                 // up the outer edge (free to run taller for a bigger fillet)
      const topOut: [number, number] = [A[0] + nx * w, A[1] + ny * w];
      const topIn: [number, number] = [A[0] - nx * w, A[1] - ny * w];
      const botIn: [number, number] = [G[0] - nx * w, G[1] - ny * w];
      const botOut: [number, number] = [G[0] + nx * w, G[1] + ny * w];
      const sh = new THREE.Shape();
      sh.moveTo(topOut[0], topOut[1]);
      sh.lineTo(topIn[0], topIn[1]);
      sh.lineTo(botIn[0], botIn[1]);
      sh.lineTo(botOut[0] - nx * rb, botOut[1] - ny * rb);                                   // stop short of the corner
      sh.quadraticCurveTo(botOut[0], botOut[1], botOut[0] - ux * ru, botOut[1] - uy * ru);   // round only this corner
      sh.lineTo(topOut[0], topOut[1]);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.z = -depth / 2;
      group.add(m);
    };

    roundedRail(AL, gripTopL, 13, T + 8, 17, -1, frameMat);
    roundedRail(AR, gripTopR, 13, T + 8, 17, 1, frameMat);

    // ---- lead-tape channel: ONE continuous ribbon that runs up the left throat
    // rail, around the head (over the top), and back down the right rail. It sits
    // proud of the frame's outer edge, centred in depth (the "profile" middle), so
    // it reads as a single unbroken groove that flows down the profile.
    {
      // by default the channel wraps only the head; the throat rails are optional
      // (lead tape goes inside the frame at the throat, and a strip there looks busy)
      const withThroat = !!props.leadThroat;
      const headS: [number, number][] = head.map((p) => S(p[0], p[1]));
      const path: [number, number][] = [];
      if (withThroat) path.push([gripTopL[0], gripTopL[1]]);
      // head arc the LONG way (over the top): index 75 (lower-left) -> 0 (top) -> 45 (lower-right)
      for (let k = 0; k <= 120; k++) {
        const idx = (75 + k) % 120;
        path.push(headS[idx]);
        if (idx === 45) break;
      }
      if (withThroat) path.push([gripTopR[0], gripTopR[1]]);

      const C: [number, number] = [0, CY0 - c.cy];
      // OUT/IN are negative so the channel surface sits INSIDE the frame's outer
      // edge — recessed into the milled groove. (On the throat rails the large
      // baseOff below lifts it back out so it stays visible on the box rails.)
      const OUT = -4, IN = -7, ZT = 7, ZB = -7, REP = 1;
      const NP = path.length;
      const nrm: [number, number][] = [];
      for (let i = 0; i < NP; i++) {
        const a = path[Math.max(0, i - 1)], b = path[Math.min(NP - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = -ty, ny = tx; // outward-ish perpendicular
        const P = path[i];
        if (nx * (P[0] - C[0]) + ny * (P[1] - C[1]) < 0) { nx = -nx; ny = -ny; }
        nrm.push([nx, ny]);
      }
      const cum: number[] = [0];
      for (let i = 1; i < NP; i++) cum[i] = cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      const total = cum[NP - 1] || 1;
      // head path points already sit on the frame's outer edge; the two grip ends
      // sit on the rail CENTRELINE, so push them out past the rail's outer face
      // (half-width ~6.5) — the ribbon then stays proud all the way down the throat.
      // sit the throat-rail section of the channel right on the rail's outer face
      // (rail half-width ~6.5): visible on top of the rail, but not past its silhouette.
      const baseOff = path.map((_, i) => (withThroat && (i <= 1 || i >= NP - 2)) ? 10 : 0);
      const pos: number[] = [], uv: number[] = [], idxs: number[] = [];
      const vpush = (P: [number, number], n: [number, number], off: number, z: number) => { pos.push(P[0] + n[0] * off, P[1] + n[1] * off, z); };
      for (let i = 0; i < NP; i++) {
        const P = path[i], n = nrm[i], u = (cum[i] / total) * REP, bo = baseOff[i];
        vpush(P, n, bo + OUT, ZT); uv.push(u, 1); // OT
        vpush(P, n, bo + OUT, ZB); uv.push(u, 0); // OB
        vpush(P, n, bo + IN, ZT);  uv.push(u, 1); // IT
        vpush(P, n, bo + IN, ZB);  uv.push(u, 0); // IB
      }
      const quad = (a: number, b: number, cc: number, d: number) => { idxs.push(a, b, cc, a, cc, d); };
      for (let i = 0; i < NP - 1; i++) {
        const s = i * 4, t = (i + 1) * 4;
        quad(s + 0, s + 1, t + 1, t + 0); // outer face
        quad(s + 2, s + 0, t + 0, t + 2); // top cap
        quad(s + 1, s + 3, t + 3, t + 1); // bottom cap
      }
      const rib = new THREE.BufferGeometry();
      rib.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      rib.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      rib.setIndex(idxs);
      rib.computeVertexNormals();
      void rib; // lead strip removed — frame art wraps the whole profile instead
      // The head has a milled groove that recesses the ribbon; the box throat rails do
      // NOT, so the ribbon there gets buried. When the channel runs onto the throat,
      // lay a lead strip down the MIDDLE of each rail's OUTER SIDE EDGE (the profile
      // face), centred in depth and running the rail length — like lead tape on the
      // frame's edge, visible when the racquet is turned side-on.
      if (withThroat) {
        const o = 6.6;   // just proud of the rail's outer face (rail half-width 6.5)
        const zh = 5;    // half-height in depth -> a ~10-unit strip down the edge middle
        const railEdgeStrip = (A: number[], G: number[], outerSign: number) => {
          const dx = G[0] - A[0], dy = G[1] - A[1]; const len = Math.hypot(dx, dy) || 1;
          let nx = -dy / len, ny = dx / len;
          if (Math.sign(nx) !== Math.sign(outerSign)) { nx = -nx; ny = -ny; } // point OUTWARD
          const p = [A[0] + nx * o, A[1] + ny * o, zh, A[0] + nx * o, A[1] + ny * o, -zh, G[0] + nx * o, G[1] + ny * o, -zh, G[0] + nx * o, G[1] + ny * o, zh];
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
          g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2));
          g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
          group.add(new THREE.Mesh(g, leadMat));
        };
        void railEdgeStrip; // lead strip removed
      }

      // Tell the user the target art size: the channel is `total` long and
      // (ZT-ZB) wide in model units; scale to mm via the ~455mm racquet length.
      const headTopY = Math.min.apply(null, head.map((p) => p[1]));
      const mmScale = 455 / (664 - headTopY);
      const lenMm = Math.round(total * mmScale);
      const widMm = Math.round((ZT - ZB) * mmScale);
      const ratio = Math.max(1, Math.round(total / (ZT - ZB)));
      captionEl = document.createElement("div");
      captionEl.style.cssText = "position:absolute;left:10px;bottom:8px;font:11px/1.35 Inter,system-ui,sans-serif;color:#6b6459;background:rgba(255,255,255,0.78);padding:4px 8px;border-radius:8px;pointer-events:none;max-width:78%;";
      captionEl.textContent = "Lead-channel art: 1 long strip ≈ " + lenMm + " × " + widMm + " mm (~" + ratio + ":1). Applied once, length-wise.";
      captionEl = null; // lead strip removed — no caption
    }

    // ---- FRAME ART: bake the "Frame"-tagged (side "profile") layers onto a texture
    // and wrap it around the head's flat frame ring (front + back). u runs around the
    // frame; v runs radially (0 = inner face edge, 1 = outer frame edge). The grey lead
    // strip lives on the side profile and is untouched.
    {
      // full outer-frame path: up the LEFT rail, around the HEAD (over the top),
      // down the RIGHT rail — each entry has an inner + outer edge (S-space), so the
      // frame art wraps the WHOLE frame including the throat rails.
      const railHalf = 6.5;
      const fpath: { in: [number, number]; out: [number, number] }[] = [];
      const pushRail = (A: number[], B: number[], outX: number) => {
        let dx = B[0] - A[0], dy = B[1] - A[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        let nx = -dy, ny = dx;
        if (Math.sign(nx) !== Math.sign(outX)) { nx = -nx; ny = -ny; }
        const NS = 10;
        for (let s = 0; s <= NS; s++) { const t = s / NS, cx = A[0] + (B[0] - A[0]) * t, cy = A[1] + (B[1] - A[1]) * t; fpath.push({ in: [cx - nx * railHalf, cy - ny * railHalf], out: [cx + nx * railHalf, cy + ny * railHalf] }); }
      };
      pushRail(gripTopL, AL, -1);
      for (let k = 0; k <= 120; k++) { const idx = (75 + k) % 120; fpath.push({ in: S(fpts[idx][0], fpts[idx][1]), out: S(head[idx][0], head[idx][1]) }); if (idx === 45) break; }
      pushRail(AR, gripTopR, 1);
      const fN = fpath.length;
      const ecum: number[] = [0];
      for (let i = 1; i < fN; i++) ecum[i] = ecum[i - 1] + Math.hypot(fpath[i].out[0] - fpath[i - 1].out[0], fpath[i].out[1] - fpath[i - 1].out[1]);
      const etot = ecum[fN - 1] || 1;
      const EDEPTH = 36;
      const PPU = 5;
      const EH = Math.round(EDEPTH * PPU);
      const EW = Math.max(512, Math.round(etot * PPU));

      const edgeCanvas = document.createElement("canvas");
      edgeCanvas.width = EW; edgeCanvas.height = EH;
      const ectx = edgeCanvas.getContext("2d") as CanvasRenderingContext2D;
      const edgeTexture = new THREE.CanvasTexture(edgeCanvas);
      edgeTexture.flipY = false;
      edgeTexture.wrapS = THREE.ClampToEdgeWrapping;
      edgeTexture.wrapT = THREE.ClampToEdgeWrapping;
      (edgeTexture as any).colorSpace = THREE.SRGBColorSpace;
      edgeTexture.anisotropy = 8;
      edgeTexRef.current = edgeTexture;
      const edgeMat: any = new THREE.MeshStandardMaterial({ map: edgeTexture, transparent: true, roughness: glossy ? 0.2 : 0.7, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

      const redrawEdge = () => {
        const P = propsRef.current;
        ectx.clearRect(0, 0, EW, EH);
        (P.layers || []).filter((l: any) => l && (l.side || "face") === "profile").forEach((it: any) => {
          const u = (it.y - 48) / 464;
          if (it.type === "text") {
            const v = (it.x - 322) / 36;
            ectx.save();
            ectx.translate(u * EW, v * EH);
            ectx.rotate(Math.PI / 2 + ((it.rot || 0) * Math.PI) / 180);
            ectx.transform(1, Math.tan(((it.sky || 0) * Math.PI) / 180), Math.tan(((it.skx || 0) * Math.PI) / 180), 1, 0, 0);
            ectx.scale(it.sx == null ? 1 : it.sx, it.sy == null ? 1 : it.sy);
            ectx.font = Math.max(8, (it.size || 24) * PPU) + "px " + (it.font || "sans-serif");
            ectx.fillStyle = it.color || "#ffffff";
            ectx.textAlign = "center"; ectx.textBaseline = "middle";
            ectx.fillText(it.text || "", 0, 0);
            ectx.restore();
          } else if (it.href) {
            let cached = imgCacheRef.current.get(it.href);
            if (!cached) {
              const img = new Image(); img.crossOrigin = "anonymous";
              cached = { img, loaded: false };
              imgCacheRef.current.set(it.href, cached);
              img.onload = () => { cached!.loaded = true; redrawEdgeRef.current && redrawEdgeRef.current(); };
              img.src = it.href;
            }
            if (cached.loaded) {
              // Frame images WRAP the whole cross-section: fill the full canvas height
              // (front face -> outer rim/profile -> back face). Size sets how far it
              // wraps around the perimeter; Move Y sets where around the frame it sits.
              const dw = (it.baseW || 100) * (it.scale || 1) * PPU;
              const cxp = u * EW;
              ectx.save();
              ectx.globalAlpha = it.opacity != null ? it.opacity : 1;
              try { ectx.drawImage(cached.img, cxp - dw / 2, 0, dw, EH); } catch (e) { /* tainted */ }
              ectx.restore();
            }
          }
        });
        edgeTexture.needsUpdate = true;
      };
      redrawEdgeRef.current = redrawEdge;
      redrawEdge();

      // Wrap the WHOLE frame cross-section: front face -> outer rim (the PROFILE /
      // side edge) -> back face, around the entire perimeter (head + throat rails).
      // So frame art covers the faces AND the profile side of the racquet — the whole
      // external frame. v runs across the section: 0 = front inner, 0.5 = outer rim,
      // 1 = back inner. A normal-sized image fills v and skins the whole section.
      const Zf = T / 2 + 8;   // proud of the frame front/back
      const cs: [number, number][] = [ [0, Zf], [1, Zf], [1, 0], [1, -Zf], [0, -Zf] ]; // [radial 0..1, z]
      const CSN = cs.length;
      {
        const epos: number[] = [], euv: number[] = [], eidx: number[] = [];
        for (let i = 0; i < fN; i++) {
          const P = fpath[i];
          const dx = P.out[0] - P.in[0], dy = P.out[1] - P.in[1];
          const u = ecum[i] / etot;
          for (let k = 0; k < CSN; k++) {
            const r = cs[k][0], z = cs[k][1];
            epos.push(P.in[0] + dx * r, P.in[1] + dy * r, z);
            euv.push(u, k / (CSN - 1));
          }
        }
        for (let i = 0; i < fN - 1; i++) {
          for (let k = 0; k < CSN - 1; k++) {
            const a = i * CSN + k, b = i * CSN + k + 1, c = (i + 1) * CSN + k + 1, d = (i + 1) * CSN + k;
            eidx.push(a, b, c, a, c, d);
          }
        }
        const eg = new THREE.BufferGeometry();
        eg.setAttribute("position", new THREE.Float32BufferAttribute(epos, 3));
        eg.setAttribute("uv", new THREE.Float32BufferAttribute(euv, 2));
        eg.setIndex(eidx);
        eg.computeVertexNormals();
        group.add(new THREE.Mesh(eg, edgeMat));
      }
    }

    const yT = -46;
    const yB = gripTopC[1] + 4;
    const railX = (side: number, y: number): number => {
      const A = side < 0 ? AL : AR;
      const G = side < 0 ? gripTopL : gripTopR;
      const t = (A[1] - y) / (A[1] - G[1]);
      return A[0] + (G[0] - A[0]) * t;
    };
    const N = Math.max(1, Math.min(3, props.beams || 2));

    if (props.throatType === "closed") {
      const sh = new THREE.Shape();
      sh.moveTo(AL[0], AL[1]); sh.lineTo(AR[0], AR[1]); sh.lineTo(gripTopR[0], gripTopR[1]); sh.lineTo(gripTopL[0], gripTopL[1]); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: T + 8, bevelEnabled: false });
      const m = new THREE.Mesh(g, frameMat); m.position.z = -(T + 8) / 2; group.add(m);
    } else if (props.throatType === "horizontal") {
      for (let i = 0; i < N; i++) {
        const frac = 0.32 + i * 0.26;
        const y = yT + (yB - yT) * frac;
        strut([railX(-1, y) + 3, y], [railX(1, y) - 3, y], 9, beamDepth, beamMat(i));
      }
    } else if (props.throatType === "diagonal") {
      strut([railX(-1, yT), yT], [railX(1, yB), yB], 9, beamDepth, beamMat(0));
      strut([railX(1, yT), yT], [railX(-1, yB), yB], 9, beamDepth, beamMat(1));
    } else {
      const offs = N === 1 ? [0] : (N === 2 ? [-9, 9] : [-15, 0, 15]);
      for (let i = 0; i < N; i++) {
        const x = offs[i];
        strut([x, yB], [x, yT], 8, beamDepth, beamMat(i));
      }
    }

    // ---- THROAT ART: bake throat-tagged layers onto a flat panel that spans the
    // throat trapezoid on the front face. The canvas is transparent except where the
    // user actually placed art, so open (beam) throats stay open — the panel only
    // becomes visible where a logo or text sits, matching the 2D face view.
    {
      const pAL: [number, number] = [head[75][0], head[75][1]];
      const pAR: [number, number] = [head[45][0], head[45][1]];
      const pGL: [number, number] = [CX - 24, 486];
      const pGR: [number, number] = [CX + 24, 486];
      const PYMIN = Math.min(pAL[1], pAR[1], pGL[1], pGR[1]);
      const PYMAX = Math.max(pAL[1], pAR[1], pGL[1], pGR[1]);
      const spanY = Math.max(1, PYMAX - PYMIN);
      const TCW = 384, TCH = 1536; // across the wrap (x) by rail length (y) — 3x res for crisp art
      const throatCanvas = document.createElement("canvas");
      throatCanvas.width = TCW; throatCanvas.height = TCH;
      const tctx = throatCanvas.getContext("2d") as CanvasRenderingContext2D;
      const throatTexture = new THREE.CanvasTexture(throatCanvas);
      throatTexture.flipY = false;
      throatTexture.wrapS = THREE.ClampToEdgeWrapping;
      throatTexture.wrapT = THREE.ClampToEdgeWrapping;
      (throatTexture as any).colorSpace = THREE.SRGBColorSpace;
      throatTexture.anisotropy = 8;
      throatTexRef.current = throatTexture;
      const throatMat: any = new THREE.MeshStandardMaterial({ map: throatTexture, transparent: true, roughness: glossy ? 0.2 : 0.7, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const redrawThroat = () => {
        const P = propsRef.current;
        tctx.clearRect(0, 0, TCW, TCH);
        (P.layers || []).filter((l: any) => l && (l.side || "face") === "throat").forEach((it: any) => {
          // v = position ALONG the rail (from the layer's y); centred across the wrap.
          const v = Math.max(0.04, Math.min(0.96, ((it.y - PYMIN) / spanY)));
          const cx = TCW / 2, cy = v * TCH;
          tctx.save();
          tctx.translate(cx, cy);
          tctx.rotate(((it.rot || 0) * Math.PI) / 180);
          tctx.transform(1, Math.tan(((it.sky || 0) * Math.PI) / 180), Math.tan(((it.skx || 0) * Math.PI) / 180), 1, 0, 0);
          tctx.scale(it.sx == null ? 1 : it.sx, it.sy == null ? 1 : it.sy);
          if (it.type === "text") {
            // the wrap's outer faces are seen from OUTSIDE, so the baked text lands
            // mirror-reversed on them — flip it L-R here so it reads normally.
            tctx.scale(-1, 1);
            tctx.font = Math.max(8, (it.size || 24) * 6.6) + "px " + (it.font || "sans-serif");
            tctx.fillStyle = it.color || "#ffffff";
            tctx.textAlign = "center"; tctx.textBaseline = "middle";
            tctx.fillText(it.text || "", 0, 0);
          } else if (it.href) {
            let cached = imgCacheRef.current.get(it.href);
            if (!cached) {
              const img = new Image(); img.crossOrigin = "anonymous";
              cached = { img, loaded: false };
              imgCacheRef.current.set(it.href, cached);
              img.onload = () => { cached!.loaded = true; redrawThroatRef.current && redrawThroatRef.current(); };
              img.src = it.href;
            }
            if (cached.loaded) {
              const dw = (it.baseW || 100) * (it.scale || 1) * 6.6, dh = (it.baseH || 100) * (it.scale || 1) * 6.6;
              tctx.globalAlpha = it.opacity != null ? it.opacity : 1;
              try { tctx.drawImage(cached.img, -dw / 2, -dh / 2, dw, dh); } catch (e) { /* tainted */ }
            }
          }
          tctx.restore();
        });
        throatTexture.needsUpdate = true;
      };
      redrawThroatRef.current = redrawThroat;
      redrawThroat();
      // Build a ribbon that hugs ONE rail's outer edge, wrapping front -> outer -> back
      // across the rail's depth, and running its full length. Both rails share the same
      // throat texture, so a logo/text appears mirrored on each rail's edge and stays
      // visible from any rotation instead of floating in the open throat.
      const Zt = (T + 8) / 2;   // rail depth half (~19)
      const rw = 6.5;           // rail half-width (rail is 13 wide)
      const OUTP = 1.2;         // sit a hair proud of the rail's outer face
      // cross-section across the wrap: [in-plane offset, z]; u runs front(0) -> back(1).
      // Corners sit AT the rail's outer edge (rw) and its FULL depth (+/-Zt) so the strip
      // truly wraps front face -> outer face -> back face and never bleeds sideways past
      // the rail silhouette.
      const _po = OUTP; // (kept for reference)
      const cs: [number, number][] = [
        [-rw + 0.6, Zt + 0.5],       // front face, near inner edge — a hair PROUD of the face
        [rw + 0.3, Zt + 0.5],        // front-outer corner, proud (kills z-fighting speckle)
        [rw + 0.3, -(Zt + 0.5)],     // back-outer corner
        [-rw + 0.6, -(Zt + 0.5)],    // back face, near inner edge
      ];
      const CSN = cs.length;
      const buildRailWrap = (A: number[], G: number[], outerSign: number) => {
        const dx = G[0] - A[0], dy = G[1] - A[1];
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;   // along the rail (A -> G)
        let nx = -uy, ny = ux;                 // in-plane normal
        if (Math.sign(nx) !== Math.sign(outerSign)) { nx = -nx; ny = -ny; }
        const NS = 44;
        const tpos: number[] = [], tuv: number[] = [], tidx: number[] = [];
        for (let s = 0; s <= NS; s++) {
          const t = s / NS;
          const bx = A[0] + (G[0] - A[0]) * t, by = A[1] + (G[1] - A[1]) * t;
          for (let k = 0; k < CSN; k++) {
            const o = cs[k][0], z = cs[k][1];
            tpos.push(bx + nx * o, by + ny * o, z);
            // flip the wrap U on the right rail so its art reads the same way as the
            // left rail (not mirror-reversed) when the frame is turned around.
            tuv.push(outerSign > 0 ? 1 - k / (CSN - 1) : k / (CSN - 1), t);
          }
        }
        for (let s = 0; s < NS; s++) {
          for (let k = 0; k < CSN - 1; k++) {
            const a = s * CSN + k, b = s * CSN + k + 1, cc = (s + 1) * CSN + k + 1, d = (s + 1) * CSN + k;
            tidx.push(a, b, cc, a, cc, d);
          }
        }
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.Float32BufferAttribute(tpos, 3));
        tg.setAttribute("uv", new THREE.Float32BufferAttribute(tuv, 2));
        tg.setIndex(tidx);
        tg.computeVertexNormals();
        const m = new THREE.Mesh(tg, throatMat);
        group.add(m);
        pickTargets.push(m); // selectable/draggable in 3D
      };
      buildRailWrap(AL, gripTopL, -1);
      buildRailWrap(AR, gripTopR, 1);
    }

    // start the grip a touch higher and gently flare its top out to meet the rails, so
    // the throat eases smoothly into the handle with no hard step or black stem — like 2D.
    const gripTopY = gripTopC[1] + 8;
    const bandBotY = gripTopC[1] - 8;   // the black band is the top slice of the grip
    // lower (grey) part of the grip
    const gripLen = Math.max(20, bandBotY - gripBotC[1]);
    const gripMesh = new THREE.Mesh(new THREE.CylinderGeometry(23.8, 22, gripLen, 48, 1), gripMat);
    gripMesh.position.set(0, (bandBotY + gripBotC[1]) / 2, zc);
    group.add(gripMesh);
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 10, 22, 1), frameMat);
    butt.position.set(0, gripBotC[1] - 3, zc);
    group.add(butt);
    // the black band = the top slice of the grip (same diameter, stacked on the grey
    // part so no z-fight), where the two rails converge and meet, like the 2D model.
    const band = new THREE.Mesh(new THREE.CylinderGeometry(24, 23.8, gripTopY - bandBotY, 48, 1), frameMat);
    band.position.set(0, (gripTopY + bandBotY) / 2, zc);
    group.add(band);

    // initial texture bake
    redraw();
    redrawLead();

    // ---- animate ----
    let raf = 0;
    const animate = () => { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();

    // ---- capture API: current-view PNG + a full set of preset angles ----
    // Exposed on window so the Paint Shop toolbar buttons can trigger a download
    // without threading a ref through props. preserveDrawingBuffer is on, so
    // toDataURL after a manual render returns the actual pixels.
    const renderOnce = () => renderer.render(scene, camera);
    const capturePNG = (): string => { renderOnce(); return renderer.domElement.toDataURL("image/png"); };
    const captureAngles = (): { name: string; url: string }[] => {
      const savedPos = camera.position.toArray();
      const savedTgt = controls.target.toArray();
      const base = baseDistRef.current || 1170;
      const shots: { name: string; dir: [number, number, number]; tgt: [number, number, number]; dist: number }[] = [
        { name: "face",       dir: [0, 0.06, 1],     tgt: [0, 0, 0],     dist: base },
        { name: "back",       dir: [0, 0.06, -1],    tgt: [0, 0, 0],     dist: base },
        { name: "edge-left",  dir: [-1, 0.05, 0.14], tgt: [0, 0, 0],     dist: base },
        { name: "edge-right", dir: [1, 0.05, 0.14],  tgt: [0, 0, 0],     dist: base },
        { name: "throat",     dir: [0, -0.28, 0.95], tgt: [0, -40, 0],   dist: base * 0.6 },
      ];
      const out: { name: string; url: string }[] = [];
      shots.forEach((s) => {
        const t = new THREE.Vector3(s.tgt[0], s.tgt[1], s.tgt[2]);
        const d = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize();
        camera.position.copy(t.clone().add(d.multiplyScalar(s.dist)));
        camera.lookAt(t);
        camera.updateProjectionMatrix();
        renderOnce();
        out.push({ name: s.name, url: renderer.domElement.toDataURL("image/png") });
      });
      camera.position.fromArray(savedPos);
      controls.target.fromArray(savedTgt);
      controls.update();
      renderOnce();
      return out;
    };
    (window as any).__pala3D = { capturePNG, captureAngles };

    // ---- pointer interaction: grab a logo to move it on the face, or click to edit holes ----
    let downXY: number[] | null = null;
    let dragLayer: any = null; // { id, ox, oy }
    const raycaster = new THREE.Raycaster();
    const facePoint = (e: PointerEvent): { px: number; py: number } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pickTargets);
      if (!hits.length) return null;
      const pt = hits[0].point;
      return { px: pt.x + CX, py: CY0 - pt.y };
    };
    const layerAt = (px: number, py: number, layers: any[]): any => {
      for (let i = layers.length - 1; i >= 0; i--) {
        const it = layers[i];
        if (it.side === "profile") continue;
        const rot = (-(it.rot || 0) * Math.PI) / 180;
        const cos = Math.cos(rot), sin = Math.sin(rot);
        const dx = px - it.x, dy = py - it.y;
        const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
        let hw, hh;
        if (it.type === "text") { hw = Math.max(20, (it.text || "").length * (it.size || 24) * 0.34); hh = (it.size || 24) * 0.8; }
        else { hw = (it.baseW || 100) * (it.scale || 1) / 2; hh = (it.baseH || 100) * (it.scale || 1) / 2; }
        if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return it;
      }
      return null;
    };
    const onCanvasDown = (e: PointerEvent) => {
      downXY = [e.clientX, e.clientY];
      dragLayer = null;
      const P = propsRef.current;
      if (P.editHoles) return; // hole editing handled on pointerup
      const fp = facePoint(e);
      if (!fp) return;
      const hit = layerAt(fp.px, fp.py, P.layers || []);
      if (hit) {
        dragLayer = { id: hit.id, ox: hit.x - fp.px, oy: hit.y - fp.py };
        if (P.setSelId) P.setSelId(hit.id);
        e.stopImmediatePropagation(); // don't let OrbitControls rotate while moving a logo
        try { renderer.domElement.setPointerCapture(e.pointerId); } catch (er) { /* noop */ }
      }
    };
    const onCanvasMove = (e: PointerEvent) => {
      if (!dragLayer) return;
      const fp = facePoint(e);
      if (!fp) return;
      const P = propsRef.current;
      P.setDesign && P.setDesign((d: any) => ({ ...d, layers: (d.layers || []).map((l: any) => l.id === dragLayer.id ? { ...l, x: Math.round(fp.px + dragLayer.ox), y: Math.round(fp.py + dragLayer.oy) } : l) }));
    };
    const onCanvasUp = (e: PointerEvent) => {
      const dd = downXY; downXY = null;
      if (dragLayer) { dragLayer = null; try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (er) { /* noop */ } return; }
      const P = propsRef.current;
      if (!P.editHoles || !P.setDesign || !dd) return;
      if (Math.hypot(e.clientX - dd[0], e.clientY - dd[1]) > 5) return;
      const fp = facePoint(e);
      if (!fp) return;
      const hx = Math.round(fp.px - CX), hy = Math.round(fp.py - c.cy);
      const baseHoles = P.holes || [];
      P.setDesign!((d: any) => {
        const cur = (Array.isArray(d.holes) ? d.holes : baseHoles).slice();
        let idx = -1, best = 1e9;
        for (let i = 0; i < cur.length; i++) { const q = Math.hypot(cur[i].x - hx, cur[i].y - hy); if (q < best) { best = q; idx = i; } }
        const hr = (d.holeR != null ? d.holeR : 5.6);
        if (idx >= 0 && best < hr + 6) cur.splice(idx, 1); else cur.push({ x: hx, y: hy });
        return { ...d, holes: cur };
      });
    };
    renderer.domElement.addEventListener("pointerdown", onCanvasDown, true);
    renderer.domElement.addEventListener("pointermove", onCanvasMove);
    renderer.domElement.addEventListener("pointerup", onCanvasUp);

    const onResize = () => {
      W = mount.clientWidth || W; H = mount.clientHeight || H;
      camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H);
    };
    const ro = new ResizeObserver(onResize); ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      camStateRef.current = { pos: camera.position.toArray(), tgt: controls.target.toArray() };
      renderer.domElement.removeEventListener("pointerdown", onCanvasDown, true);
      renderer.domElement.removeEventListener("pointermove", onCanvasMove);
      renderer.domElement.removeEventListener("pointerup", onCanvasUp);
      redrawRef.current = null;
      redrawLeadRef.current = null;
      redrawEdgeRef.current = null;
      redrawThroatRef.current = null;
      try { if ((window as any).__pala3D) delete (window as any).__pala3D; } catch (e) { /* noop */ }
      if (captionEl && captionEl.parentNode) captionEl.parentNode.removeChild(captionEl);
      try { leadTexture.dispose(); } catch (e) { /* noop */ }
      controls.dispose();
      camRef.current = null; ctrlRef.current = null;
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { const arr = Array.isArray(o.material) ? o.material : [o.material]; arr.forEach((m: any) => { if (m.map) m.map.dispose(); m.dispose(); }); }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [geoKey]);

  // Light: only re-bake the textures when layers / face color / pattern change.
  // Coalesce onto a single animation frame so a fast slider drag (many rapid
  // changes) collapses into ONE bake per frame instead of one per event — this
  // is what makes size/rotate/opacity feel seamless instead of glitchy.
  useEffect(() => {
    const h = requestAnimationFrame(() => {
      if (redrawRef.current) redrawRef.current();
      if (redrawEdgeRef.current) redrawEdgeRef.current();
      if (redrawThroatRef.current) redrawThroatRef.current();
      if (redrawLeadRef.current) redrawLeadRef.current();
    });
    return () => cancelAnimationFrame(h);
  }, [texKey]);

  // Instant: recolour materials in place (no rebuild) when a colour swatch changes
  useEffect(() => {
    const P = propsRef.current;
    if (frameMatRef.current) frameMatRef.current.color.set(P.frame || "#101015");
    if (gripMatRef.current) gripMatRef.current.color.set(P.grip || "#e9e3d4");
    // when a channel image is set, keep the material white so the image shows true
    if (leadMatRef.current) leadMatRef.current.color.set(P.leadImg ? "#ffffff" : (P.leadChannel || "#c9c9c9"));
    (beamMatsRef.current || []).forEach((m: any, i: number) => { if (m && m.color) m.color.set((P.beamColors && P.beamColors[i]) || P.throatC || "#c0472a"); });
  }, [colorKey]);

  // Channel image: (re)bake the wrapped texture in place when it changes
  useEffect(() => { if (redrawLeadRef.current) redrawLeadRef.current(); }, [props.leadImg]);

  // Zoom bar -> dolly the camera without rebuilding (keeps current rotation)
  useEffect(() => {
    const cam = camRef.current, ctr = ctrlRef.current;
    if (!cam || !ctr) return;
    const dir = cam.position.clone().sub(ctr.target).normalize();
    const dist = Math.max(ctr.minDistance, Math.min(ctr.maxDistance, baseDistRef.current / (zoom || 1)));
    cam.position.copy(ctr.target.clone().add(dir.multiplyScalar(dist)));
    ctr.update();
  }, [zoom]);

  return <div ref={mountRef} style={{ width: "100%", height: "min(60vh, 540px)", minHeight: 360, touchAction: "none", cursor: "grab" }} />;
}
