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
  layers: any[];
  beamColors: string[];
  holes: Hole[];
  holeR: number;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const key = JSON.stringify(props);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---- constants that match the 2D designer ----
    const CX = 340, CY0 = 352;
    const CFG: any = {
      round:    { cy: 224, rx: 170, ry: 186, n: 2.5, nb: 0.05, nt: 0.05 },
      teardrop: { cy: 214, rx: 166, ry: 188, n: 2.2, nb: 0.30, nt: 0.04 },
      diamond:  { cy: 216, rx: 170, ry: 190, n: 3.0, nb: 0.30, nt: -0.06 },
    };
    const shape = CFG[props.shape] ? props.shape : "teardrop";
    const c = CFG[shape];

    const genPts = (dx: number, dy: number): [number, number][] => {
      const rx = c.rx - dx, ry = c.ry - dy;
      const out: [number, number][] = [];
      for (let i = 0; i < 48; i++) {
        const th = -Math.PI / 2 + (2 * Math.PI * i) / 48;
        const ct = Math.cos(th), st = Math.sin(th);
        const ex = (ct < 0 ? -1 : 1) * Math.pow(Math.abs(ct), 2 / c.n);
        const ey = (st < 0 ? -1 : 1) * Math.pow(Math.abs(st), 2 / c.n);
        let f = 1;
        if (st > 0) f = 1 - c.nb * st; else f = 1 - c.nt * (-st);
        out.push([CX + rx * f * ex, c.cy + ry * ey]);
      }
      return out;
    };

    // svg point (px,py) -> three shape-space (x,y). Flip Y (svg is y-down).
    const S = (px: number, py: number): [number, number] => [px - CX, -(py - CY0)];

    const head = genPts(0, 0);   // outer frame edge
    const fpts = genPts(13, 13); // inner face edge

    // ---- renderer / scene / camera ----
    const scene = new THREE.Scene();
    scene.background = null;
    let W = mount.clientWidth || 480;
    let H = mount.clientHeight || 460;
    const camera = new THREE.PerspectiveCamera(35, W / H, 1, 8000);
    camera.position.set(300, 140, 1120);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 600;
    controls.maxDistance = 2600;
    controls.rotateSpeed = 0.9;
    controls.target.set(0, 0, 0);

    // ---- lights ----
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const l1 = new THREE.DirectionalLight(0xffffff, 0.9); l1.position.set(-0.4, 0.8, 1); scene.add(l1);
    const l2 = new THREE.DirectionalLight(0xffffff, 0.42); l2.position.set(0.7, -0.3, 0.6); scene.add(l2);
    const l3 = new THREE.DirectionalLight(0xffffff, 0.3); l3.position.set(0, 0.2, -1); scene.add(l3);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.28));

    const group = new THREE.Group();
    scene.add(group);

    // ---- shape helpers ----
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
    const RES = 3;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(4, Math.round(sW * RES));
    canvas.height = Math.max(4, Math.round(sH * RES));
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    (texture as any).colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

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

    const drawBase = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSvgTransform();
      if (props.pattern === "gradient") {
        const g = ctx.createLinearGradient(0, sminY, 0, smaxY);
        g.addColorStop(0, props.face || "#242430");
        g.addColorStop(1, darken(props.face || "#242430", 0.5));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = props.face || "#242430";
      }
      ctx.fillRect(sminX, sminY, sW, sH);
      const cy = c.cy;
      if (props.pattern === "split") { ctx.fillStyle = props.accent || "#e0b34a"; ctx.fillRect(sminX, cy, sW, smaxY - cy); }
      if (props.pattern === "halo") {
        ctx.strokeStyle = props.accent || "#e0b34a"; ctx.lineWidth = 13;
        ctx.beginPath(); ctx.arc(CX, cy, 96, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.7; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(CX, cy, 60, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (props.pattern === "stripes") {
        ctx.fillStyle = props.accent || "#e0b34a";
        for (let x = sminX - sH; x < smaxX + sH; x += 44) {
          ctx.beginPath();
          ctx.moveTo(x, sminY); ctx.lineTo(x + 22, sminY);
          ctx.lineTo(x + 22 - sH, smaxY); ctx.lineTo(x - sH, smaxY);
          ctx.closePath(); ctx.fill();
        }
      }
      // text layers
      (props.layers || []).forEach((it: any) => {
        if (it.type !== "text") return;
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(((it.rot || 0) * Math.PI) / 180);
        ctx.font = (it.size || 24) + "px " + (it.font || "sans-serif");
        ctx.fillStyle = it.color || "#ffffff";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(it.text || "", 0, 0);
        ctx.restore();
      });
      texture.needsUpdate = true;
    };

    const drawImageLayer = (it: any, img: HTMLImageElement) => {
      ctx.save();
      setSvgTransform();
      ctx.translate(it.x, it.y);
      ctx.rotate(((it.rot || 0) * Math.PI) / 180);
      ctx.scale(it.scale || 1, it.scale || 1);
      ctx.globalAlpha = it.opacity != null ? it.opacity : 1;
      try { ctx.drawImage(img, -it.baseW / 2, -it.baseH / 2, it.baseW, it.baseH); } catch (e) { /* tainted */ }
      ctx.restore();
      texture.needsUpdate = true;
    };

    drawBase();
    (props.layers || []).forEach((it: any) => {
      if (it.type === "text" || !it.href) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => drawImageLayer(it, img);
      img.src = it.href;
    });

    // ---- materials ----
    const faceMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.08, side: THREE.DoubleSide });
    const foamMat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });
    const frameMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(props.frame || "#101015"), roughness: 0.38, metalness: 0.28, side: THREE.DoubleSide });
    const gripMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(props.grip || "#e9e3d4"), roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide });

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

    // ---- hole paths (bored through the face plates) ----
    const holePaths: THREE.Path[] = (props.holes || []).map((h: any) => {
      const [hx, hy] = S(CX + h.x, c.cy + h.y);
      const p = new THREE.Path();
      p.absarc(hx, hy, props.holeR || 5.6, 0, Math.PI * 2, true);
      return p;
    });

    // front plate (holed): caps = face texture, walls (incl. hole interiors) = foam
    const frontGeo = new THREE.ExtrudeGeometry(shapeOf(fpts, holePaths), { depth: tp, bevelEnabled: false, steps: 1 });
    setFaceUV(frontGeo);
    const frontPlate = new THREE.Mesh(frontGeo, [faceMat, foamMat]);
    frontPlate.position.z = T / 2 - tp;
    group.add(frontPlate);

    // back plate (holed)
    const backGeo = new THREE.ExtrudeGeometry(shapeOf(fpts, holePaths), { depth: tp, bevelEnabled: false, steps: 1 });
    setFaceUV(backGeo);
    const backPlate = new THREE.Mesh(backGeo, [faceMat, foamMat]);
    backPlate.position.z = -T / 2;
    group.add(backPlate);

    // foam core (solid) so holes reveal grey/black, not through to the far side
    const foamGeo = new THREE.ExtrudeGeometry(shapeOf(fpts), { depth: Tfoam, bevelEnabled: false, steps: 1 });
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.position.z = -Tfoam / 2;
    group.add(foam);

    // frame ring (bumper): frame color on every angle
    const ringGeo = new THREE.ExtrudeGeometry(shapeOf(head, [pathOf(fpts)]), { depth: T + 8, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 2, steps: 1 });
    const ring = new THREE.Mesh(ringGeo, frameMat);
    ring.position.z = -(T + 8) / 2;
    group.add(ring);

    // ---- throat + grip ----
    const zc = 0;
    const beamDepth = T * 0.6;
    const AL = S(head[30][0], head[30][1]);
    const AR = S(head[18][0], head[18][1]);
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

    // side rails continue the frame down to the grip
    strut(AL, gripTopL, 13, T * 0.7, frameMat);
    strut(AR, gripTopR, 13, T * 0.7, frameMat);

    const bc = (i: number) => new THREE.MeshStandardMaterial({
      color: new THREE.Color((props.beamColors && props.beamColors[i]) || props.throatC || "#c0472a"),
      roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide,
    });

    const topY = Math.min(AL[1], AR[1]) - 6;
    const botY = gripTopC[1] + 8;
    const spanTopL = AL[0] + 16, spanTopR = AR[0] - 16;
    const spanBotL = gripTopL[0], spanBotR = gripTopR[0];
    const N = Math.max(1, Math.min(3, props.beams || 2));

    if (props.throatType === "closed") {
      const sh = new THREE.Shape();
      sh.moveTo(AL[0], AL[1]); sh.lineTo(AR[0], AR[1]); sh.lineTo(gripTopR[0], gripTopR[1]); sh.lineTo(gripTopL[0], gripTopL[1]); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: T * 0.62, bevelEnabled: false });
      const m = new THREE.Mesh(g, frameMat); m.position.z = -T * 0.31; group.add(m);
    } else if (props.throatType === "horizontal") {
      for (let i = 0; i < N; i++) {
        const t = N === 1 ? 0.5 : i / (N - 1);
        const y = topY + (botY - topY) * t;
        const lx = spanTopL + (spanBotL - spanTopL) * t;
        const rx = spanTopR + (spanBotR - spanTopR) * t;
        strut([lx, y], [rx, y], 9, beamDepth, bc(i));
      }
    } else if (props.throatType === "diagonal") {
      strut([spanTopL, topY], [spanBotR, botY], 9, beamDepth, bc(0));
      strut([spanTopR, topY], [spanBotL, botY], 9, beamDepth, bc(1));
    } else {
      for (let i = 0; i < N; i++) {
        const t = N === 1 ? 0.5 : i / (N - 1);
        const xTop = spanTopL + (spanTopR - spanTopL) * t;
        const xBot = spanBotL + (spanBotR - spanBotL) * t;
        strut([xTop, topY], [xBot, botY], 9, beamDepth, bc(i));
      }
    }

    // grip
    const gripLen = Math.max(20, gripTopC[1] - gripBotC[1]);
    const gripMesh = new THREE.Mesh(new THREE.CylinderGeometry(21, 22, gripLen, 22, 1), gripMat);
    gripMesh.position.set(0, (gripTopC[1] + gripBotC[1]) / 2, zc);
    group.add(gripMesh);
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 10, 22, 1), frameMat);
    butt.position.set(0, gripBotC[1] - 3, zc);
    group.add(butt);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(15, 21, 28, 18, 1), frameMat);
    neck.position.set(0, gripTopC[1] + 10, zc);
    group.add(neck);

    // ---- animate ----
    let raf = 0;
    const animate = () => { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();

    const onResize = () => {
      W = mount.clientWidth || W; H = mount.clientHeight || H;
      camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H);
    };
    const ro = new ResizeObserver(onResize); ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { const arr = Array.isArray(o.material) ? o.material : [o.material]; arr.forEach((m: any) => { if (m.map) m.map.dispose(); m.dispose(); }); }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [key]);

  return <div ref={mountRef} style={{ width: "100%", height: "min(60vh, 540px)", minHeight: 360, touchAction: "none", cursor: "grab" }} />;
}
