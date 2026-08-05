// PaintShop.tsx — Paint Shop designer, extracted from App.tsx.
// Deps: React hooks, Racquet3D (3D view), layerFX helpers. Nothing else external.
import { useState, useRef, useEffect } from "react";
import Racquet3D from "./Racquet3D";
import { layerBox, layerHandlesSVG, computeHandleDrag } from "./layerFX";
import { builderToThroat } from "./racquetSpec";

function RacquetDesigner({ shapeId, bridgeId, beamOrientation, beamCount, holes, holeDiameterMm, design, setDesign }: { shapeId: string; bridgeId?: string; beamOrientation?: string; beamCount?: number; holes?: any[]; holeDiameterMm?: number; design: any; setDesign: (u:any)=>void }) {
  const D = design || {};
  const face = D.face || "#242430", frame = D.frame || "#101015", throatC = D.throatC || "#c0472a", grip = D.grip || "#e9e3d4", accent = D.accent || "#e0b34a", pattern = D.pattern || "solid", layers = (D.layers||[]).filter((l:any)=>l);
  const setFace = (v:any) => setDesign((d:any)=>({ ...d, face:v }));
  const setFrame = (v:any) => setDesign((d:any)=>({ ...d, frame:v }));
  const setThroatC = (v:any) => setDesign((d:any)=>({ ...d, throatC:v }));
  const setGrip = (v:any) => setDesign((d:any)=>({ ...d, grip:v }));
  const setAccent = (v:any) => setDesign((d:any)=>({ ...d, accent:v }));
  const setPattern = (v:any) => setDesign((d:any)=>({ ...d, pattern:v }));
  const setLayers = (fn:any) => setDesign((d:any)=>({ ...d, layers: typeof fn==="function" ? fn(d.layers||[]) : fn }));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{x:number;y:number}>({ x: 0, y: 0 });
  const [selId, setSelId] = useState<number|null>(null); const [view] = useState<"face" | "profile" | "3d">("3d");
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const dragRef = useRef<any>(null); useEffect(() => { const el = wrapRef.current; if (!el) return; const h = (e: WheelEvent) => { e.preventDefault(); setZoom((z) => Math.max(0.5, Math.min(4, z * (e.deltaY < 0 ? 1.08 : 0.92)))); }; el.addEventListener("wheel", h, { passive: false }); return () => el.removeEventListener("wheel", h); }, []);
  useEffect(() => { if (typeof document !== "undefined" && !document.getElementById("pd-fonts")) { const l = document.createElement("link"); l.id = "pd-fonts"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@600&family=Playfair+Display:wght@700&family=Pacifico&family=Barlow+Condensed:wght@600&display=swap"; document.head.appendChild(l); } }, []);
  const BG = "#EDE8DC", CX = 340, HT = 486;
  const CFG: any = { round:{cy:224,rx:170,ry:186,n:2.5,nb:0.05,nt:0.05}, teardrop:{cy:214,rx:166,ry:188,n:2.2,nb:0.30,nt:0.04}, diamond:{cy:220,rx:170,ry:190,n:3.0,nb:0.42,nt:-0.06}, "round-angular":{cy:224,rx:170,ry:186,n:4,nb:0.05,nt:0.05,chamfer:1.44}, "diamond-angular":{cy:220,rx:170,ry:190,n:4,nb:0.32,nt:0.15,chamfer:1.52,chamferTop:1.66,chamferBot:1.54} };
  const FONTS: any[] = [["'Barlow Condensed',sans-serif","Barlow Condensed"],["Anton,sans-serif","Anton"],["Oswald,sans-serif","Oswald"],["'Playfair Display',serif","Playfair"],["Pacifico,cursive","Pacifico"],["Impact,sans-serif","Impact"],["'Courier New',monospace","Mono"]];
  // Shape is build-owned (single source of truth): render straight from the build's shapeId.
  const shape = CFG[shapeId] ? shapeId : (shapeId === "diamond-wide" ? "diamond" : "teardrop");
  // Perforation is build-owned. The builder passes holes as normalized (-1..1, centre-origin,
  // y-down) coords + a global holeDiameterMm. Map them into Paint Shop's CFG pixel-offset space
  // (origin = head centre CX,cy; face half-extents = rx, ry). Fill factors = the fraction of the
  // half-face the builder's ±1 reaches (matched to the builder's own diagram). *** If holes look
  // mis-scaled in ?paint, tune HOLE_FILL_X / HOLE_FILL_Y here. ***
  const HOLE_FILL_X = 0.60, HOLE_FILL_Y = 0.64;
  const _cfgS = CFG[shape] || CFG.teardrop;
  const _pxPerMm = _cfgS.rx / 127.5;                  // 2*rx px == 255 mm face width
  const buildPerf = Array.isArray(holes);
  const buildHoleR = holeDiameterMm ? (holeDiameterMm / 2) * _pxPerMm : 5.6;
  const buildHoles = buildPerf ? (holes as any[]).map((h:any) => ({ x: h.x * _cfgS.rx * HOLE_FILL_X, y: h.y * _cfgS.ry * HOLE_FILL_Y, d: h.d })) : null;
  // Throat is canonical from the build: map bridgeId/beamOrientation/beamCount -> throatType/beams.
  // (No Paint Shop override — the build is the single source of truth. See racquetSpec.ts.)
  const _throat = builderToThroat({ bridgeId, beamOrientation, beamCount });
  const throatType = _throat.throatType;
  const beams = _throat.beams;
  const shade = (hex:string,p:number) => { let c=hex.replace("#",""); if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; let r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16); const f=p<0?0:255,t=Math.abs(p); r=Math.round((f-r)*t+r);g=Math.round((f-g)*t+g);b=Math.round((f-b)*t+b); return "#"+[r,g,b].map(x=>("0"+x.toString(16)).slice(-2)).join(""); };
  const esc = (t:string) => (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const genPts = (dx:number,dy:number) => { const c=CFG[shape]; const rx=c.rx-dx, ry=c.ry-dy, out:any[]=[]; for(let i=0;i<48;i++){ const th=-Math.PI/2+2*Math.PI*i/48; const ct=Math.cos(th),st=Math.sin(th); let ex,ey; if(c.chamfer||c.chamferTop){ const ac=Math.abs(ct),asn=Math.abs(st); const kk=st<0?(c.chamferTop||c.chamfer):(c.chamferBot||c.chamfer); const rr=Math.min(1/Math.max(ac,asn,1e-6), kk/((ac+asn)||1e-6)); ex=ct*rr; ey=st*rr; } else { ex=(ct<0?-1:1)*Math.pow(Math.abs(ct),2/c.n); ey=(st<0?-1:1)*Math.pow(Math.abs(st),2/c.n); } let f=1; if(st>0)f=1-c.nb*st; else f=1-c.nt*(-st); out.push([CX+rx*f*ex, c.cy+ry*ey]); } return out; };
  const crPath = (p:any[]) => { const n=p.length; let d="M"+p[0][0].toFixed(1)+" "+p[0][1].toFixed(1); for(let i=0;i<n;i++){ const p0=p[(i-1+n)%n],p1=p[i],p2=p[(i+1)%n],p3=p[(i+2)%n]; d+=" C"+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+" "+(p1[1]+(p2[1]-p0[1])/6).toFixed(1)+" "+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+" "+(p2[1]-(p3[1]-p1[1])/6).toFixed(1)+" "+p2[0].toFixed(1)+" "+p2[1].toFixed(1); } return d+"Z"; };
  const presetHoles = (pr:string) => { let rows:any[]=[[-70,8],[-42,10],[-14,10],[16,10],[44,10],[74,8]]; if(pr==="dense")rows=[[-84,10],[-62,12],[-40,12],[-18,12],[4,12],[26,12],[48,12],[70,12],[90,10]]; else if(pr==="sparse")rows=[[-56,5],[-24,7],[8,7],[40,5]]; else if(pr==="diamond")rows=[[-74,3],[-52,5],[-30,7],[-8,9],[14,9],[36,7],[58,5],[78,3]]; const pts:any[]=[]; for(const rr of rows){ const nn=rr[1]; const span=(nn-1)*22; for(let i=0;i<nn;i++){ pts.push({x:-span/2+i*22, y:rr[0]}); } } return pts; }; const holesTop = (cy:number) => { let out=""; const hr=(buildPerf?buildHoleR:(D.holeR!=null?D.holeR:5.6)); const pr=D.holePreset||"grid"; let rows:any[]=[[-70,8],[-42,10],[-14,10],[16,10],[44,10],[74,8]]; if(pr==="dense")rows=[[-84,10],[-62,12],[-40,12],[-18,12],[4,12],[26,12],[48,12],[70,12],[90,10]]; else if(pr==="sparse")rows=[[-56,5],[-24,7],[8,7],[40,5]]; else if(pr==="diamond")rows=[[-74,3],[-52,5],[-30,7],[-8,9],[14,9],[36,7],[58,5],[78,3]]; const hpts=buildHoles||(Array.isArray(D.holes)?D.holes:presetHoles(pr)); for(let hi=0;hi<hpts.length;hi++){ const xx=CX+hpts[hi].x, yy=cy+hpts[hi].y; out+='<circle data-hole="'+hi+'" cx="'+xx+'" cy="'+yy+'" r="'+hr+'" fill="'+BG+'"/><circle cx="'+xx+'" cy="'+(yy+0.7)+'" r="'+hr+'" fill="none" stroke="#000" stroke-width="1.5" opacity="0.28"/>'; } return out; };
  const armStr = (a:any,side:number) => { const ax=a[0],ay=a[1]; const hx=CX+side*17,hix=CX+side*3; const iax=ax-side*22,iay=ay+2; const ox1=ax+(hx-ax)*0.34-side*3,oy1=ay+(HT-ay)*0.34,ox2=ax+(hx-ax)*0.68-side*2,oy2=ay+(HT-ay)*0.68; const ix1=iax+(hix-iax)*0.68-side*2,iy1=iay+(HT-iay)*0.68,ix2=iax+(hix-iax)*0.34-side*3,iy2=iay+(HT-iay)*0.34; return '<path d="M'+ax.toFixed(1)+' '+ay.toFixed(1)+' C'+ox1.toFixed(1)+' '+oy1.toFixed(1)+' '+ox2.toFixed(1)+' '+oy2.toFixed(1)+' '+hx+' '+HT+' L'+hix+' '+HT+' C'+ix1.toFixed(1)+' '+iy1.toFixed(1)+' '+ix2.toFixed(1)+' '+iy2.toFixed(1)+' '+iax.toFixed(1)+' '+iay.toFixed(1)+' Z" fill="url(#pd_frG)"/>'; };
  const bridgeStr = (aL:any,aR:any) => { const wy0=Math.min(aL[1],aR[1])-2,wy1=HT+8,my=(wy0+wy1)/2; const sw=throatType==="diagonal"?6:7; const bc=(idx)=>((D.beamColors&&D.beamColors[idx])||throatC); if(throatType==="vertical"){ let b=""; for(let i=0;i<beams;i++){ const fr=beams===1?0.5:i/(beams-1); const xt=CX-16+fr*32, xb=CX-6+fr*12, cq=CX-22+fr*44; b+='<path d="M'+xt.toFixed(1)+' '+wy0.toFixed(1)+' Q'+cq.toFixed(1)+' '+my.toFixed(1)+' '+xb.toFixed(1)+' '+wy1.toFixed(1)+'" stroke="'+bc(i)+'" stroke-width="'+sw+'" fill="none" stroke-linecap="round"/>'; } return b; } if(throatType==="diagonal"){ let b=""; const n2=Math.max(1,beams); const tlx=aL[0]+18, trx=aR[0]-18, ty=Math.max(aL[1],aR[1])+6; for(let k=0;k<n2;k++){ const o=(k-(n2-1)/2)*6; b+='<path d="M'+(tlx+o).toFixed(1)+' '+ty.toFixed(1)+' L'+(CX+6+o).toFixed(1)+' '+wy1.toFixed(1)+'" stroke="'+bc(k)+'" stroke-width="'+sw+'" stroke-linecap="round"/>'; b+='<path d="M'+(trx-o).toFixed(1)+' '+ty.toFixed(1)+' L'+(CX-6-o).toFixed(1)+' '+wy1.toFixed(1)+'" stroke="'+bc(k)+'" stroke-width="'+sw+'" stroke-linecap="round"/>'; } return b; } if(throatType==="horizontal"){ let b=''; for(let i=0;i<beams;i++){ const yy=beams===1?my:(wy0+18+i*((wy1-wy0-36)/Math.max(1,beams-1))); const t=(yy-wy0)/(wy1-wy0); const lx=(aL[0]+22)+((CX-3)-(aL[0]+22))*t-2, rx=(aR[0]-22)+((CX+3)-(aR[0]-22))*t+2; b+='<path d="M'+lx.toFixed(1)+' '+yy.toFixed(1)+' Q'+CX+' '+(yy-3).toFixed(1)+' '+rx.toFixed(1)+' '+yy.toFixed(1)+'" stroke="'+bc(i)+'" stroke-width="8" fill="none" stroke-linecap="round"/>'; } return b; } return ""; };
  const layerStr = () => { let out=""; layers.filter((l:any)=>{const _sd=(l.side||"face");return view==="profile"?_sd==="profile":_sd!=="profile";}).forEach((it:any) => { const _fx=(it.sx==null?1:it.sx),_fy=(it.sy==null?1:it.sy),_kx=(it.skx||0),_ky=(it.sky||0);const tr=' transform="translate('+it.x+' '+it.y+') rotate('+it.rot+') skewX('+_kx+') skewY('+_ky+') scale('+_fx+' '+_fy+') translate('+(-it.x)+' '+(-it.y)+')"'; out+='<g data-layer="'+it.id+'" style="cursor:move">'; if(it.type==="text"){ const w=Math.max(24,(it.text||"").length*it.size*0.62),hh=it.size*1.25; out+='<rect x="'+(it.x-w/2)+'" y="'+(it.y-it.size*0.82)+'" width="'+w+'" height="'+hh+'" fill="transparent"'+tr+'/>'; out+='<text x="'+it.x+'" y="'+it.y+'" text-anchor="middle" font-family="'+it.font+'" font-size="'+it.size+'" fill="'+it.color+'"'+tr+' style="pointer-events:none">'+esc(it.text)+'</text>'; if(it.id===selId) out+='<rect x="'+(it.x-w/2)+'" y="'+(it.y-it.size*0.82)+'" width="'+w+'" height="'+hh+'" rx="3" fill="none" stroke="#2f7cff" stroke-width="1.5" stroke-dasharray="5 4"'+tr+' style="pointer-events:none"/>'; } else { const w=it.baseW*it.scale,hh=it.baseH*it.scale; out+='<rect x="'+(it.x-w/2)+'" y="'+(it.y-hh/2)+'" width="'+w+'" height="'+hh+'" fill="transparent"'+tr+'/>'; out+='<g transform="translate('+it.x+' '+it.y+') rotate('+it.rot+') scale('+it.scale+')" opacity="'+it.opacity+'"><image href="'+it.href+'" x="'+(-it.baseW/2)+'" y="'+(-it.baseH/2)+'" width="'+it.baseW+'" height="'+it.baseH+'" preserveAspectRatio="xMidYMid meet" style="pointer-events:none"/></g>'; if(it.id===selId) out+='<rect x="'+(it.x-w/2)+'" y="'+(it.y-hh/2)+'" width="'+w+'" height="'+hh+'" rx="3" fill="none" stroke="#2f7cff" stroke-width="1.5" stroke-dasharray="5 4"'+tr+' style="pointer-events:none"/>'; } if(it.id===selId){out+=layerHandlesSVG(it);} out+='</g>'; }); return out; };
  const buildProfileSVG = () => { const camS = zoom, tx = CX * (1 - camS) + pan.x, ty = 360 * (1 - camS) + pan.y; return `<svg id="pdsvg" viewBox="0 0 680 720" width="100%" style="display:block;cursor:grab;touch-action:none;user-select:none"><g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${camS})"><rect x="322" y="48" width="36" height="464" rx="18" fill="${frame}"/><rect x="332" y="60" width="16" height="348" rx="8" fill="${face}"/><rect x="325" y="54" width="7" height="360" rx="3" fill="rgba(255,255,255,0.12)"/><rect x="326" y="500" width="28" height="156" rx="12" fill="${grip}"/><g stroke="rgba(0,0,0,0.12)" stroke-width="2"><line x1="326" y1="520" x2="354" y2="530"/><line x1="326" y1="544" x2="354" y2="554"/><line x1="326" y1="568" x2="354" y2="578"/><line x1="326" y1="592" x2="354" y2="602"/><line x1="326" y1="616" x2="354" y2="626"/><line x1="326" y1="640" x2="354" y2="650"/></g><rect x="330" y="650" width="20" height="12" rx="3" fill="#101015"/><clipPath id="pd_pfr"><rect x="322" y="48" width="36" height="464" rx="18"/></clipPath>${D.sideImg?('<g clip-path="url(#pd_pfr)"><image href="'+D.sideImg+'" x="322" y="48" width="36" height="464" preserveAspectRatio="none"/></g>'):''}<g clip-path="url(#pd_pfr)">${layerStr()}</g><g clip-path="url(#pd_pfr)"><rect x="336" y="56" width="8" height="398" rx="4" fill="#c9c9c9"/>${D.leadImg?('<image href="'+D.leadImg+'" x="336" y="56" width="8" height="398" preserveAspectRatio="none"/>'):''}<rect x="335" y="55" width="10" height="400" rx="5" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1.2"/></g></g></svg>`; }; const buildSVG = () => { if (view === "profile") return buildProfileSVG();
    const c=CFG[shape], cy=c.cy;
    const head=genPts(0,0), fpts=genPts(13,13);
    const headD=crPath(head), faceD=crPath(fpts);
    const aR=head[18], aL=head[30];
    const camS=zoom, tx=CX*(1-camS)+pan.x, ty=360*(1-camS)+pan.y;
    const faceFillId = pattern==="gradient" ? "url(#pd_pf)" : face;
    let overlay="";
    if(pattern==="split") overlay+='<rect x="150" y="'+cy+'" width="380" height="260" fill="'+accent+'" clip-path="url(#pd_fc)"/>';
    if(pattern==="stripes") overlay+='<rect x="150" y="40" width="380" height="380" fill="url(#pd_stp)" clip-path="url(#pd_fc)"/>';
    if(pattern==="halo") overlay+='<circle cx="340" cy="'+cy+'" r="96" fill="none" stroke="'+accent+'" stroke-width="13" clip-path="url(#pd_fc)"/><circle cx="340" cy="'+cy+'" r="60" fill="none" stroke="'+accent+'" stroke-width="8" opacity="0.7" clip-path="url(#pd_fc)"/>';
    let wrap="";
    for(let i=0;i<9;i++){ const yy=HT+18+i*18; wrap+='<line x1="326" y1="'+yy+'" x2="354" y2="'+(yy+9)+'"/>'; }
    let closedT="";
    if(throatType==="closed"){ const wy0=Math.max(aL[1],aR[1])+14; closedT='<path d="M'+(aL[0]+22)+' '+wy0+' L'+(CX-3)+' '+HT+' L'+(CX+3)+' '+HT+' L'+(aR[0]-22)+' '+wy0+' Z" fill="'+throatC+'"/>'; }
    return '<svg id="pdsvg" viewBox="0 0 680 720" width="100%" style="display:block;cursor:grab;touch-action:none;user-select:none">'
      +'<defs><clipPath id="pd_fc"><path d="'+faceD+'"/></clipPath><clipPath id="pd_rq"><path d="'+faceD+'"/><path d="M'+(CX-66)+' '+(cy+c.ry-30)+' L'+(CX+66)+' '+(cy+c.ry-30)+' L'+(CX+22)+' '+(HT-4)+' L'+(CX-22)+' '+(HT-4)+' Z"/></clipPath>'
      +'<linearGradient id="pd_frG" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="'+shade(frame,0.30)+'"/><stop offset="0.5" stop-color="'+frame+'"/><stop offset="1" stop-color="'+shade(frame,-0.35)+'"/></linearGradient>'
      +'<linearGradient id="pd_faG" x1="0.1" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="'+shade(face,0.16)+'"/><stop offset="0.45" stop-color="'+face+'"/><stop offset="1" stop-color="'+shade(face,-0.22)+'"/></linearGradient>'
      +'<linearGradient id="pd_pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+accent+'"/><stop offset="1" stop-color="'+face+'"/></linearGradient>'
      +'<pattern id="pd_stp" width="30" height="30" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="'+face+'"/><rect width="15" height="30" fill="'+accent+'"/></pattern>'
      +'<radialGradient id="pd_sheen" cx="0.34" cy="0.24" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.13"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0.03"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
      +'<filter id="pd_shf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12"/></filter>'+'<filter id="pd_wh"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter><mask id="pd_thm" maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="720"><rect width="680" height="720" fill="#000"/><path d="'+faceD+'" fill="#fff"/><g filter="url(#pd_wh)">'+armStr(aL,-1)+armStr(aR,1)+bridgeStr(aL,aR)+closedT+'</g></mask></defs>'
      +'<rect x="0" y="0" width="680" height="720" fill="'+BG+'"/>'
      +'<g transform="translate('+tx.toFixed(1)+' '+ty.toFixed(1)+') scale('+camS+')">'
     
      +armStr(aL,-1)+armStr(aR,1)+bridgeStr(aL,aR)+closedT
      +'<rect x="326" y="'+(HT-6)+'" width="28" height="200" rx="12" fill="'+grip+'"/>'
      +'<g stroke="rgba(0,0,0,0.14)" stroke-width="2">'+wrap+'</g>'
      +'<rect x="322" y="'+(HT+190)+'" width="36" height="12" rx="5" fill="'+shade(frame,-0.2)+'"/>'
      +'<path d="'+headD+'" fill="url(#pd_frG)"/>'
      +'<path d="'+faceD+'" fill="url(#pd_faG)"/><path d="'+faceD+'" fill="'+faceFillId+'" fill-opacity="'+(pattern==="gradient"?1:0.55)+'"/>'
      +overlay
      +'<path d="'+faceD+'" fill="url(#pd_sheen)"/><path d="'+faceD+'" fill="none" stroke="'+shade(face,-0.5)+'" stroke-width="2.5" opacity="0.5"/>'
      +'<g mask="url(#pd_thm)">'+layerStr()+'</g>'+'<g clip-path="url(#pd_rq)" opacity="0">'+layerStr()+'</g>'
      +'<g clip-path="url(#pd_fc)">'+holesTop(cy)+'</g>'
      +'</g></svg>';
  };
  const toRoot = (e:any) => { const svgEl:any = wrapRef.current && wrapRef.current.querySelector("#pdsvg"); if(!svgEl) return {x:0,y:0}; const p=svgEl.createSVGPoint(); p.x=e.clientX; p.y=e.clientY; const r=p.matrixTransform(svgEl.getScreenCTM().inverse()); return {x:r.x,y:r.y}; };
  const onDown = (e:any) => { const p=toRoot(e); if(D.editHoles){ const _hh=e.target.closest&&e.target.closest("[data-hole]"); if(_hh){ const _hi=+_hh.getAttribute("data-hole"); setDesign((d:any)=>({...d, holes:(Array.isArray(d.holes)?d.holes:presetHoles(d.holePreset||"grid")).filter((_:any,i:number)=>i!==_hi)})); return; } const _cyy=CFG[shape].cy; setDesign((d:any)=>({...d, holes:[...(Array.isArray(d.holes)?d.holes:presetHoles(d.holePreset||"grid")), {x:Math.round(p.x-CX), y:Math.round(p.y-_cyy)}]})); return; } const _hn=e.target.closest&&e.target.closest("[data-h]");if(_hn){const _hid=+_hn.getAttribute("data-hl");const _hit=layers.find((l:any)=>l.id===_hid);const _hb=layerBox(_hit);setSelId(_hid);dragRef.current={mode:"handle",id:_hid,handle:_hn.getAttribute("data-h"),sx:p.x,sy:p.y,ox:_hit.x,oy:_hit.y,rot:_hit.rot||0,fsx:(_hit.sx==null?1:_hit.sx),fsy:(_hit.sy==null?1:_hit.sy),skx:_hit.skx||0,sky:_hit.sky||0,hw:_hb.hw,hh:_hb.hh};return;}const g=e.target.closest && e.target.closest("[data-layer]"); if(g){ const id=+g.getAttribute("data-layer"); const it=layers.find((l:any)=>l.id===id); setSelId(id); dragRef.current={mode:"layer",id,sx:p.x,sy:p.y,ox:it.x,oy:it.y}; } else { setSelId(null); dragRef.current={mode:"pan",sx:p.x,sy:p.y,px:pan.x,py:pan.y}; } try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_e){} };
  const onMove = (e:any) => { const d=dragRef.current; if(!d) return; const p=toRoot(e); if(d.mode==="handle"){const _u=computeHandleDrag(d,p,zoom);setLayers((ls:any[])=>ls.map((l:any)=>l.id===d.id?{...l,..._u}:l));return;} if(d.mode==="layer"){ if(view==="profile"){ setLayers((ls:any[])=>ls.map((l:any)=>{ if(l.id!==d.id) return l; let _px=Math.max(328,Math.min(352,Math.round(d.ox+(p.x-d.sx)/zoom))), _py=Math.max(70,Math.min(498,Math.round(d.oy+(p.y-d.sy)/zoom))); return {...l,x:_px,y:_py}; })); return; } const _c=CFG[shape], _fB=_c.cy+_c.ry, _fT=_c.cy-_c.ry; setLayers((ls:any[])=>ls.map((l:any)=>{ if(l.id!==d.id) return l; let _nx=Math.round(d.ox+(p.x-d.sx)/zoom), _ny=Math.round(d.oy+(p.y-d.sy)/zoom); _ny=Math.max(_fT+8, Math.min(HT-14, _ny)); let _hf; if(_ny<=_fB){ const _fp=genPts(10,10); _hf=26; for(let _i=0;_i<_fp.length;_i++){ const _a=_fp[_i], _b=_fp[(_i+1)%_fp.length]; if((_a[1]-_ny)*(_b[1]-_ny)<=0 && _a[1]!==_b[1]){ const _xx=_a[0]+(_b[0]-_a[0])*((_ny-_a[1])/(_b[1]-_a[1])); const _hw=Math.abs(_xx-CX); if(_hw>_hf) _hf=_hw; } } _hf=_hf-6; } else { const _tt=Math.max(0,Math.min(1,(_ny-_fB)/((HT-14)-_fB))); _hf=54-(54-16)*_tt; } _nx=Math.max(CX-_hf, Math.min(CX+_hf, _nx)); return {...l, x:_nx, y:_ny}; })); } else { setPan({x:d.px+(p.x-d.sx),y:d.py+(p.y-d.sy)}); } };
  const onUp = (e:any) => { dragRef.current=null; try{ e.currentTarget.releasePointerCapture(e.pointerId); }catch(_e){} };
  const addText = () => { const id=(layers.reduce((mx:number,l:any)=>Math.max(mx,l.id||0),0)+1); const _tg=(D.paintTarget)||(view==="profile"?"profile":"face"); const _pf=_tg==="profile"; setLayers((ls:any[])=>[...ls,{id,type:"text",text:"New text",x:340,y:_pf?250:(_tg==="throat"?430:150),font:"'Barlow Condensed',sans-serif",size:_pf?20:30,color:"#ffffff",rot:_pf?90:0,side:_tg}]); setSelId(id); };
  const addImage = (e:any) => { const f=e.target.files && e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=(ev:any)=>{ const img=new Image(); img.onload=()=>{ const m=Math.max(img.width,img.height)||1; const base=140/m; const id=(layers.reduce((mx:number,l:any)=>Math.max(mx,l.id||0),0)+1); setLayers((ls:any[])=>[{id,type:"image",href:ev.target.result,baseW:Math.round(img.width*base),baseH:Math.round(img.height*base),x:340,y:((D.paintTarget||(view==="profile"?"profile":"face"))==="throat"?430:(view==="profile"?260:230)),scale:(view==="profile"?3.2:1),rot:0,opacity:1,side:(D.paintTarget||(view==="profile"?"profile":"face"))},...ls]); setSelId(id); }; img.src=ev.target.result; }; rd.readAsDataURL(f); e.target.value=""; };
  const sel:any = selId!=null ? layers.find((l:any)=>l&&l.id===selId) : null;
  const upd = (patch:any) => setLayers((ls:any[])=>ls.map((l:any)=>l&&l.id===selId?{...l,...patch}:l));
  const del = () => { setLayers((ls:any[])=>ls.filter((l:any)=>l.id!==selId)); setSelId(null); };
  const download = () => { const _cv3d:any=wrapRef.current && wrapRef.current.querySelector("canvas"); if(view==="3d" && _cv3d){ try{ const a=document.createElement("a"); a.download="racquet.png"; a.href=_cv3d.toDataURL("image/png"); a.click(); }catch(_e){} return; } const svgEl:any=wrapRef.current && wrapRef.current.querySelector("#pdsvg"); if(!svgEl) return; const s=new XMLSerializer().serializeToString(svgEl); const blob=new Blob(['<?xml version="1.0"?>'+s],{type:"image/svg+xml"}); const url=URL.createObjectURL(blob); const img=new Image(); img.onload=()=>{ const cv=document.createElement("canvas"); cv.width=1020; cv.height=1080; const ctx:any=cv.getContext("2d"); ctx.fillStyle=BG; ctx.fillRect(0,0,1020,1080); ctx.drawImage(img,0,0,1020,1080); URL.revokeObjectURL(url); try{ const a=document.createElement("a"); a.download="palalab-racquet.png"; a.href=cv.toDataURL("image/png"); a.click(); }catch(_e){} }; img.src=url; };
  const lbl:any={fontSize:11,color:"#8A8578",fontFamily:"Inter, sans-serif",display:"flex",flexDirection:"column",gap:6,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600};
  const fld:any={width:"100%",marginTop:2,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(0,0,0,0.12)",background:"#fff",color:"#18181B",fontFamily:"Inter, sans-serif",fontSize:13,cursor:"pointer"};
  const col:any={width:36,height:36,padding:0,border:"2px solid #EDE8DC",borderRadius:"50%",background:"transparent",cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.25)"};
  const btn:any={padding:"9px 16px",borderRadius:999,border:"1px solid rgba(0,0,0,0.16)",background:"#fff",color:"#1A1A1A",fontFamily:"Inter, sans-serif",fontWeight:600,letterSpacing:"0.02em",fontSize:12,cursor:"pointer"};
  // ---- FIP homologation (real-world mm) — Phase 1 -------------------------------------
  // Model units are non-uniform, so calibrate in-plane length/width and hole diameter
  // separately against known references (455mm max length; default 5.6r hole ~ 11mm).
  const MMU = 0.713;   // in-plane mm per model unit (length/width)
  const HMMU = 0.98;   // hole mm per model unit
  // Canonical render set: build holes if provided, else the local preset (dev fallback).
  const renderHoles = buildHoles || (Array.isArray(D.holes) ? D.holes : presetHoles(D.holePreset || "grid"));
  const renderHoleR = buildPerf ? buildHoleR : (D.holeR != null ? D.holeR : 5.6);
  const holeDiaMMout = buildPerf ? (holeDiameterMm || 9) : +((2 * (D.holeR != null ? D.holeR : 5.6) * HMMU).toFixed(1));
  const fip = (() => {
    const cc = CFG[shape] || CFG.teardrop;
    const lengthMM = Math.round((664 - (cc.cy - cc.ry)) * MMU);
    const widthMM = Math.round(2 * cc.rx * MMU);
    const thickMM = 38;  // frame profile depth
    const holeDiaMM = holeDiaMMout;
    const holesArr = renderHoles;
    const holeCount = holesArr.length;
    // FIP: cylindrical holes 9–13 mm in the central area (within 4 cm of the edge they
    // may be larger, up to 20 mm). Our holes are one uniform diameter, so the central
    // 9–13 mm rule is the binding constraint everywhere.
    const checks = [
      { k: "Length", v: lengthMM, u: "mm", lim: "≤ 455", ok: lengthMM <= 455 },
      { k: "Width", v: widthMM, u: "mm", lim: "≤ 260", ok: widthMM <= 260 },
      { k: "Thickness", v: thickMM, u: "mm", lim: "≤ 38", ok: thickMM <= 38 },
      { k: "Hole Ø", v: holeDiaMM, u: "mm", lim: "9–13", ok: holeDiaMM >= 9 && holeDiaMM <= 13 },
    ];
    return { checks, legal: checks.every((c) => c.ok), holeCount, lengthMM, widthMM, thickMM, holeDiaMM };
  })();

  // ---- Phase 2: production artwork template + colour spec (in-app export) -------------
  const hexToRgb = (h:string):[number,number,number] => { let c=(h||"#000000").replace("#",""); if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; return [parseInt(c.slice(0,2),16)||0,parseInt(c.slice(2,4),16)||0,parseInt(c.slice(4,6),16)||0]; };
  const rgbToCmyk = (r:number,g:number,b:number):[number,number,number,number] => { const R=r/255,G=g/255,B=b/255,k=1-Math.max(R,G,B); if(k>=0.9995)return[0,0,0,100]; return [Math.round((1-R-k)/(1-k)*100),Math.round((1-G-k)/(1-k)*100),Math.round((1-B-k)/(1-k)*100),Math.round(k*100)]; };
  const PANTONE:[string,number,number,number][] = [["Black 6 C",39,37,31],["Cool Gray 11 C",83,86,90],["Cool Gray 5 C",177,179,179],["White",255,255,255],["Warm Red C",249,66,58],["185 C",228,0,43],["186 C",200,16,46],["032 C",239,51,64],["021 C",254,80,0],["137 C",255,163,0],["123 C",255,199,44],["Yellow C",254,221,0],["376 C",132,189,0],["355 C",0,158,73],["341 C",0,120,86],["3272 C",0,178,169],["312 C",0,169,206],["Process Blue C",0,133,202],["285 C",0,114,206],["286 C",0,51,160],["2745 C",30,32,91],["Purple C",191,87,193],["241 C",175,13,138],["Rubine Red C",206,0,88],["490 C",92,46,46],["4625 C",70,40,30],["726 C",196,142,102],["468 C",221,203,164]];
  const nearestPantone = (h:string):string => { const [r,g,b]=hexToRgb(h); let best="",bd=1e18; for(const [n,pr,pg,pb] of PANTONE){ const d=(r-pr)**2+(g-pg)**2+(b-pb)**2; if(d<bd){bd=d;best=n;} } return "PMS "+best; };
  const buildProductionSVG = ():string => {
    const S3 = MMU;                                  // mm per model unit (in-plane), true 1:1
    const art = (typeof window!=="undefined" && (window as any).__palaArt) ? (window as any).__palaArt() : null;
    const cc = CFG[shape] || CFG.teardrop;
    const faceWmm = +(680*S3).toFixed(1), faceHmm = +(720*S3).toFixed(1), bleed = 3;
    const cols:[string,string][] = ([["Face",face],["Frame",frame],["Throat",throatC],["Grip",grip],["Accent",accent],["Lead",D.leadChannel||"#c9c9c9"]] as [string,string][]).concat((D.beamColors||[]).map((c:string,i:number)=>["Beam "+(i+1),c] as [string,string])).filter(x=>!!x[1]);
    let head=0; const hp=genPts(0,0); for(let i=0;i<hp.length;i++){const a=hp[i],b=hp[(i+1)%hp.length];head+=Math.hypot(b[0]-a[0],b[1]-a[1]);} const perimMM=Math.round(head*S3);
    const hasRaster = layers.some((l:any)=>l&&l.type==="image");
    // FACE panel: the REAL baked face texture (matches 3D), clipped to the head, holes marked.
    const headPath = crPath(genPts(0,0));
    const hr = renderHoleR;
    const holesArr2 = renderHoles;
    let holeMarks=""; holesArr2.forEach((h:any)=>{ holeMarks+=`<circle cx="${(CX+h.x).toFixed(1)}" cy="${(cc.cy+h.y).toFixed(1)}" r="${hr.toFixed(1)}" fill="none" stroke="#000" stroke-width="0.7"/>`; });
    let faceInner:string;
    if (art && art.face) {
      // place the baked face texture across the FULL head bounding box so it fills to the
      // perimeter (the bake covers only the inner face region, so map it out to the head).
      const hxs=hp.map((p:any)=>p[0]),hys=hp.map((p:any)=>p[1]); const hbx=Math.min(...hxs),hby=Math.min(...hys),hbw=Math.max(...hxs)-hbx,hbh=Math.max(...hys)-hby;
      faceInner = `<defs><clipPath id="pk_hd"><path d="${headPath}"/></clipPath></defs><rect x="0" y="0" width="680" height="720" fill="#fff"/><g clip-path="url(#pk_hd)"><image href="${art.face}" x="${hbx}" y="${hby}" width="${hbw}" height="${hbh}" preserveAspectRatio="none"/></g><path d="${headPath}" fill="none" stroke="#000" stroke-width="1.2"/>${holeMarks}`;
    } else { faceInner = buildSVG().replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""); }
    const mx=16, fx=mx, fy=58;
    const csx = fx + faceWmm + 18;
    const pageW = Math.round(csx + 132 + mx);
    const bandMaxW = pageW - 2*mx, thickMM = fip.thickMM;
    const crop=(x:number,y:number)=>`<path d="M${x-4} ${y}H${x-1}M${x} ${y-4}V${y-1}" stroke="#000" stroke-width="0.3"/>`;
    let colRows=""; cols.forEach((c,i)=>{ const [r,g,b]=hexToRgb(c[1]); const cm=rgbToCmyk(r,g,b); const yy=fy+8+i*12; colRows+=`<rect x="${csx}" y="${yy}" width="9" height="9" fill="${c[1]}" stroke="#999" stroke-width="0.3"/><text x="${csx+13}" y="${yy+3.4}" font-size="4" font-family="Arial">${c[0]}</text><text x="${csx+13}" y="${yy+8.6}" font-size="3.4" font-family="Arial" fill="#555">${c[1].toUpperCase()} · C${cm[0]} M${cm[1]} Y${cm[2]} K${cm[3]} · ${nearestPantone(c[1])}</text>`; });
    let bandY = fy+faceHmm+42; const bandsHeaderY = bandY-12;
    const imgBand=(label:string,img:string|null,w:number,h:number,fallback:string)=>{ const ww=Math.min(w,bandMaxW); const base=`<rect x="${mx}" y="${bandY}" width="${ww}" height="${h}" fill="${fallback}"/>`; const over = img ? `<image href="${img}" x="${mx}" y="${bandY}" width="${ww}" height="${h}" preserveAspectRatio="none"/>` : ``; const s=`<text x="${mx}" y="${bandY-2.5}" font-size="4" font-family="Arial">${label} — ${w} × ${h} mm (1:1)${w>bandMaxW?" · clipped to page":""}</text>${base}${over}<rect x="${mx}" y="${bandY}" width="${ww}" height="${h}" fill="none" stroke="#333" stroke-width="0.3"/>`; bandY += h + 20; return s; };
    const bands = imgBand("Frame edge (unwrapped)", art&&art.edge, perimMM, thickMM, frame)
      + imgBand("Lead strip (unwrapped)", art&&art.lead, perimMM, 11, D.leadChannel||"#c9c9c9")
      + imgBand("Throat rail art", art&&art.throat, 70, 150, throatC);
    // ---- Technical drawing (front + side, dimensioned) ----
    const dsc = 78/Math.max(1,fip.lengthMM);   // draw units per mm (full length = 78 tall)
    const txs=hp.map((p:any)=>p[0]),tys=hp.map((p:any)=>p[1]); const hbx=Math.min(...txs),hby=Math.min(...tys),hbw=Math.max(...txs)-hbx,hbh=Math.max(...tys)-hby;
    const fW=hbw*MMU*dsc, fH=hbh*MMU*dsc, sW=fip.thickMM*dsc, sH=78;
    const tx=mx+8, ty=bandY+16, sx=tx+fW+50;
    const hAr=(x1:number,x2:number,y:number,l:string)=>`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#000" stroke-width="0.3"/><line x1="${x1}" y1="${y-2}" x2="${x1}" y2="${y+2}" stroke="#000" stroke-width="0.3"/><line x1="${x2}" y1="${y-2}" x2="${x2}" y2="${y+2}" stroke="#000" stroke-width="0.3"/><text x="${(x1+x2)/2}" y="${y-2.5}" font-size="4" font-family="Arial" text-anchor="middle">${l}</text>`;
    const vAr=(y1:number,y2:number,x:number,l:string)=>`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#000" stroke-width="0.3"/><line x1="${x-2}" y1="${y1}" x2="${x+2}" y2="${y1}" stroke="#000" stroke-width="0.3"/><line x1="${x-2}" y1="${y2}" x2="${x+2}" y2="${y2}" stroke="#000" stroke-width="0.3"/><text x="${x-3}" y="${(y1+y2)/2}" font-size="4" font-family="Arial" text-anchor="middle" transform="rotate(-90 ${x-3} ${(y1+y2)/2})">${l}</text>`;
    const techDraw = `<text x="${mx}" y="${bandY+8}" font-size="5" font-weight="bold" font-family="Arial">TECHNICAL DRAWING (schematic)</text>`
      + `<svg x="${tx}" y="${ty}" width="${fW}" height="${fH}" viewBox="${hbx} ${hby} ${hbw} ${hbh}"><path d="${headPath}" fill="none" stroke="#000" stroke-width="1.5"/></svg>`
      + hAr(tx, tx+fW, ty+fH+7, `${fip.widthMM} mm`)
      + `<text x="${tx}" y="${ty+fH+15}" font-size="3.6" font-family="Arial" fill="#888">Front (head)</text>`
      + `<rect x="${sx}" y="${ty}" width="${sW}" height="${sH}" rx="${sW/2}" fill="none" stroke="#000" stroke-width="0.6"/>`
      + hAr(sx, sx+sW, ty-4, `${fip.thickMM} mm`)
      + vAr(ty, ty+sH, sx+sW+11, `${fip.lengthMM} mm`)
      + `<text x="${sx}" y="${ty+sH+8}" font-size="3.6" font-family="Arial" fill="#888">Side profile</text>`;
    bandY = ty + Math.max(fH+18, sH+14) + 10;
    // ---- Production spec sheet (data + to-fill fields) ----
    const specX=mx, specW=pageW-2*mx; let sy=bandY+10;
    const sh1=(t:string)=>{const s=`<text x="${specX}" y="${sy}" font-size="5" font-weight="bold" font-family="Arial">${t}</text>`; sy+=9; return s;};
    const row=(a:string,b:string)=>{const s=`<text x="${specX}" y="${sy}" font-size="4" font-family="Arial" fill="#333">${a}</text><text x="${specX+94}" y="${sy}" font-size="4" font-family="Arial" fill="#000">${b}</text><line x1="${specX}" y1="${sy+2.5}" x2="${specX+specW}" y2="${sy+2.5}" stroke="#eee" stroke-width="0.3"/>`; sy+=8; return s;};
    let spec = sh1("PRODUCTION SPEC SHEET");
    spec += row("Model / shape", `${shape} · ${throatType} · ${beams} beam`);
    spec += row("Overall length", `${fip.lengthMM} mm (FIP max 455)`);
    spec += row("Head width", `${fip.widthMM} mm (FIP max 260)`);
    spec += row("Thickness", `${fip.thickMM} mm (FIP max 38)`);
    spec += row("Perforation", `${fip.holeCount} holes, Ø ${fip.holeDiaMM} mm`);
    spec += row("Edge / body profile", `${D.edgeProfile||"standard"} / ${D.bodyProfile||"standard"}${D.uniformHead?" · uniform head":""}${D.leadStrip?" · lead channel":""}`);
    spec += row("Finish", `${D.finish||"matte"}`);
    spec += row("FIP dimensional check", fip.legal?"PASS":"CHECK LIMITS");
    sy+=4; spec += sh1("TO BE COMPLETED BY FACTORY");
    ["Target weight (g)","Balance (mm from butt)","Swingweight","Core — EVA density (soft/med/hard)","Face layup (3K/12K carbon / fibreglass)","Surface (smooth / rough)","Grip size & length (≤ 200 mm)","Lead added (g @ position)","Wrist cord (≤ 350 mm, mandatory)"].forEach(l=>{ spec+=row(l,"______________________________"); });
    const pageH = Math.round(sy + 16);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`+
      `<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#fff"/>`+
      `<text x="${mx}" y="22" font-size="9" font-weight="bold" font-family="Arial">PalaLab — Production Pack</text>`+
      `<text x="${mx}" y="31" font-size="4.5" font-family="Arial" fill="#555">${shape} · ${throatType} · ${fip.lengthMM}×${fip.widthMM}×${fip.thickMM} mm · ${fip.holeCount} holes ${fip.holeDiaMM}mm · FIP ${fip.legal?"LEGAL":"CHECK LIMITS"} · ${new Date().toISOString().slice(0,10)}</text>`+
      `<text x="${mx}" y="38" font-size="3.6" font-family="Arial" fill="#888">TRUE 1:1 (mm). Bleed 3mm dashed red. Artwork is the actual baked design (matches 3D). ${hasRaster?"Raster logos: source ≥300 DPI at placed size.":"Vector + embedded images."}</text>`+
      `<text x="${mx}" y="52" font-size="5" font-weight="bold" font-family="Arial">FACE (front)</text>`+
      `<rect x="${fx-bleed}" y="${fy-bleed}" width="${faceWmm+2*bleed}" height="${faceHmm+2*bleed}" fill="none" stroke="#c00" stroke-width="0.3" stroke-dasharray="1.5 1.5"/>`+
      crop(fx,fy)+crop(fx+faceWmm,fy)+crop(fx,fy+faceHmm)+crop(fx+faceWmm,fy+faceHmm)+
      `<svg x="${fx}" y="${fy}" width="${faceWmm}" height="${faceHmm}" viewBox="0 0 680 720">${faceInner}</svg>`+
      `<text x="${csx}" y="${fy}" font-size="5" font-weight="bold" font-family="Arial">COLOUR SPEC</text>`+colRows+
      `<text x="${mx}" y="${bandsHeaderY}" font-size="5" font-weight="bold" font-family="Arial">PRINTABLE SURFACES (unwrapped)</text>`+bands+techDraw+spec+
      `</svg>`;
  };
  const downloadProductionPack = () => { try{ const svg=buildProductionSVG(); const blob=new Blob([svg],{type:"image/svg+xml"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.download="palalab-production-pack.svg"; a.href=url; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(_e){} };
  return (
    <div className="pd-ctl" style={{ display:"flex", flexDirection:"column", gap:12, maxHeight:"calc(100vh - 120px)", overflowY:"auto", overflowX:"hidden", paddingRight:6 }}><style>{`#pdsvg{max-height:46vh;width:auto;max-width:100%;margin:0 auto;display:block} .pd-ctl input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:3px;background:#D4CCB8;outline:none} .pd-ctl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#1A5C2A;border:2px solid #EDE8DC;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer} .pd-ctl input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#1A5C2A;border:2px solid #EDE8DC;cursor:pointer} .pd-ctl label{letter-spacing:.02em} .pd-ctl>*{flex-shrink:0} .beam-dot::-webkit-color-swatch-wrapper{padding:0} .beam-dot::-webkit-color-swatch{border-radius:50%;border:none} .pd-ctl{background:#FCFBF8;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px} .pd-ctl select:hover,.pd-ctl button:hover{border-color:rgba(0,0,0,0.3)} .pd-ctl input[type=color]::-webkit-color-swatch-wrapper{padding:0} .pd-ctl input[type=color]::-webkit-color-swatch{border-radius:50%;border:none}`}</style>
      <div ref={wrapRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ position:"sticky", top:8, zIndex:5, background:BG, borderRadius:14, overflow:"hidden", boxShadow:"0 6px 24px rgba(0,0,0,0.08)", border:"1px solid rgba(0,0,0,0.06)" }} >{view==="3d" ? <div style={{width:"100%"}} onPointerDown={(e)=>e.stopPropagation()} onPointerMove={(e)=>e.stopPropagation()} onPointerUp={(e)=>e.stopPropagation()}><Racquet3D leadChannel={D.leadChannel||"#c9c9c9"} editHoles={buildPerf?false:D.editHoles} setDesign={setDesign} selId={selId} setSelId={setSelId} zoom={zoom} finish={D.finish||"matte"} shape={shape} throatType={throatType} beams={beams} face={face} frame={frame} throatC={throatC} grip={grip} accent={accent} pattern={pattern} layers={layers} beamColors={D.beamColors||[]} holes={renderHoles} holeR={renderHoleR} leadImg={D.leadImg} leadThroat={D.leadThroat} sideImg={D.sideImg} uniformHead={!!D.uniformHead} edgeProfile={D.edgeProfile||"standard"} leadStrip={!!D.leadStrip} bodyProfile={D.bodyProfile||"standard"} /></div> : <div style={{width:"100%"}} dangerouslySetInnerHTML={{ __html: buildSVG() }} />}</div>
      <div style={{ fontSize:12, color:"#7A7268", fontFamily:"Inter, sans-serif" }}>Throat: {throatType==="closed"?"closed bridge":throatType==="vertical"?(beams+" vertical"):throatType==="diagonal"?"X-brace":"horizontal beams"} — from the build. Drag any text or logo to place it; click it to edit.</div>
      <div style={{ fontSize:12, color:"#7A7268", fontFamily:"Inter, sans-serif" }}>Shape: {(({round:"Round",teardrop:"Teardrop",diamond:"Diamond","diamond-wide":"Wide Diamond","round-angular":"Round — angular","diamond-angular":"Diamond — angular"} as any)[shape]) || shape} — from the build.</div><div style={{display:"flex",alignItems:"center",gap:10,margin:"6px 0 2px"}}><span style={{fontSize:12,color:"#7A7268",fontFamily:"Inter, sans-serif"}}>Beam colors</span>{Array.from({length:beams}).map((_,i)=>(<input key={"bc"+i} className="beam-dot" type="color" title={"Beam "+(i+1)} value={(D.beamColors&&D.beamColors[i])||throatC} onChange={(e)=>setDesign((d)=>{const arr=[...(d.beamColors||[])]; arr[i]=e.target.value; return {...d,beamColors:arr};})} style={{width:30,height:30,borderRadius:"50%",border:"2px solid #EDE8DC",boxShadow:"0 1px 4px rgba(0,0,0,0.25)",padding:0,cursor:"pointer",background:"transparent"}}/>))}</div><div style={{ fontSize:12, color:"#7A7268", fontFamily:"Inter, sans-serif" }}>Perforation: {fip.holeCount} holes · Ø {fip.holeDiaMM} mm — from the build's Face Perforation panel.</div><label style={lbl}>Face pattern<select value={pattern} onChange={e=>setPattern(e.target.value)} style={fld}><option value="solid">Solid</option><option value="gradient">Gradient</option><option value="split">Split</option><option value="stripes">Stripes</option><option value="halo">Halo</option></select></label><label style={lbl}>Finish<select value={D.finish||"matte"} onChange={e=>setDesign((d:any)=>({...d, finish:e.target.value}))} style={fld}><option value="matte">Matte</option><option value="gloss">Gloss</option></select></label><label style={lbl}>Edge profile<select value={D.edgeProfile||"standard"} onChange={e=>setDesign((d:any)=>({...d, edgeProfile:e.target.value}))} style={fld}><option value="standard">Standard</option><option value="rounded">Rounded</option></select></label><label style={lbl}>Profile<select value={D.bodyProfile||"standard"} onChange={e=>setDesign((d:any)=>({...d, bodyProfile:e.target.value}))} style={fld}><option value="standard">Standard</option><option value="curved">Curved (tapered)</option></select></label>
      <button type="button" onClick={()=>setDesign((d:any)=>{const on=!d.uniformHead; const nd={...d,uniformHead:on}; if(on&&nd.paintTarget==="profile")nd.paintTarget="face"; return nd;})} style={{alignSelf:"start",display:"inline-flex",alignItems:"center",gap:8,padding:"7px 13px",borderRadius:999,border:"1px solid "+(D.uniformHead?"#1A5C2A":"rgba(0,0,0,0.16)"),background:D.uniformHead?"#EAF3EC":"#fff",color:"#4A4A44",fontFamily:"Inter, sans-serif",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}><span style={{position:"relative",display:"inline-block",width:30,height:16,borderRadius:999,background:D.uniformHead?"#1A5C2A":"#d8d3c8"}}><span style={{position:"absolute",top:2,left:D.uniformHead?16:2,width:12,height:12,borderRadius:999,background:"#fff",boxShadow:"0 1px 2px rgba(0,0,0,0.3)"}}/></span>Uniform head — one face wraps the whole head (no separate frame)</button>
      <button type="button" onClick={()=>setDesign((d:any)=>({...d,leadStrip:!d.leadStrip}))} style={{alignSelf:"start",display:"inline-flex",alignItems:"center",gap:8,padding:"7px 13px",borderRadius:999,border:"1px solid "+(D.leadStrip?"#1A5C2A":"rgba(0,0,0,0.16)"),background:D.leadStrip?"#EAF3EC":"#fff",color:"#4A4A44",fontFamily:"Inter, sans-serif",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}><span style={{position:"relative",display:"inline-block",width:30,height:16,borderRadius:999,background:D.leadStrip?"#1A5C2A":"#d8d3c8"}}><span style={{position:"absolute",top:2,left:D.leadStrip?16:2,width:12,height:12,borderRadius:999,background:"#fff",boxShadow:"0 1px 2px rgba(0,0,0,0.3)"}}/></span>Lead strip — band around the head profile (own colour + image)</button>
      <div style={{border:"1px solid "+(fip.legal?"#1A5C2A":"#B0361E"),borderRadius:12,padding:"10px 12px",background:fip.legal?"#EFF5EF":"#FBEFEC",fontFamily:"Inter, sans-serif"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:"#6b6459"}}>FIP legal check</span><span style={{fontSize:12,fontWeight:700,color:fip.legal?"#1A5C2A":"#B0361E"}}>{fip.legal?"✓ Legal":"✗ Check limits"}</span></div>
        {fip.checks.map((c:any,i:number)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,color:"#4A4A44",padding:"2px 0"}}><span>{c.k}</span><span style={{display:"inline-flex",gap:8,alignItems:"center"}}><span style={{fontVariantNumeric:"tabular-nums"}}>{c.v}{c.u}</span><span style={{color:"#9A958A",fontSize:11,minWidth:64,textAlign:"right"}}>{c.lim}</span><span style={{color:c.ok?"#1A5C2A":"#B0361E",fontWeight:700,width:12}}>{c.ok?"✓":"✗"}</span></span></div>))}
        <div style={{fontSize:11,color:"#9A958A",marginTop:6,lineHeight:1.4}}>{fip.holeCount} holes · Verify by hand: faces flat, handle ≤ 20cm, mandatory non-elastic wrist cord ≤ 35cm.</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(84px, 1fr))", gap:10 }}>
        <label style={lbl}>Face<input type="color" value={face} onChange={e=>setFace(e.target.value)} style={col} /></label>
        <label style={lbl}>Frame<input type="color" value={frame} onChange={e=>setFrame(e.target.value)} style={col} /></label>
        <label style={lbl}>Throat<input type="color" value={throatC} onChange={e=>setThroatC(e.target.value)} style={col} /></label>
        <label style={lbl}>Grip<input type="color" value={grip} onChange={e=>setGrip(e.target.value)} style={col} /></label>
        <label style={lbl}>Accent<input type="color" value={accent} onChange={e=>setAccent(e.target.value)} style={col} /></label><label style={lbl}>Lead<input type="color" value={D.leadChannel||"#c9c9c9"} onChange={e=>setDesign((d:any)=>({...d, leadChannel:e.target.value}))} style={col} /></label>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"center", padding:"10px", background:"#F2EFE7", borderRadius:10 }}>
        <label style={{fontSize:11,color:"#8A8578",fontWeight:600,marginRight:2}}>Add to</label><select value={D.uniformHead&&(D.paintTarget==="profile")?"face":(D.paintTarget||"face")} onChange={e=>setDesign((d:any)=>({...d,paintTarget:e.target.value}))} style={{...btn,cursor:"pointer"}}><option value="face">Face</option><option value="throat">Throat</option>{!D.uniformHead && <option value="profile">Frame</option>}{D.leadStrip && <option value="lead">Lead strip</option>}</select><button type="button" onClick={addText} style={btn}>+ Add text</button>
        <label style={{ ...btn, display:"inline-flex", alignItems:"center", gap:6 }}>+ Add image<input type="file" accept="image/*" onChange={addImage} style={{ display:"none" }} /></label>
        {sel && <button type="button" onClick={del} style={{ ...btn, borderColor:"#B0361E", color:"#B0361E" }}>Delete selected</button>}
      </div>
      {layers.length>0 && (<div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:170,overflowY:"auto",border:"1px solid rgba(0,0,0,0.08)",borderRadius:10,padding:6,background:"#fff"}}>{layers.slice().reverse().map((l:any)=>(<div key={l.id} onClick={()=>setSelId(l.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,padding:"6px 8px",borderRadius:8,cursor:"pointer",background:l&&l.id===selId?"#EAF3EC":"transparent",border:l&&l.id===selId?"1px solid #1A5C2A":"1px solid transparent"}}><span style={{fontSize:12,color:"#4A4A44",fontFamily:"Inter, sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{l.type==="text"?(l.text||"New text"):"Image"}<span style={{color:"#9A958A",fontSize:10}}>{"  ·  "+(l.side==="profile"?"Frame":l.side==="lead"?"Lead strip":l.side==="throat"?"Throat":"Face")}</span></span><button type="button" title="Bring forward" onClick={(e:any)=>{e.stopPropagation();setLayers((ls:any[])=>{const i=ls.findIndex((x:any)=>x.id===l.id);if(i<0||i>=ls.length-1)return ls;const n=ls.slice();const t=n[i];n[i]=n[i+1];n[i+1]=t;return n;});}} style={{fontSize:11,color:"#6b6459",background:"none",border:"none",cursor:"pointer",flex:"0 0 auto",padding:"0 2px"}}>▲</button><button type="button" title="Send back" onClick={(e:any)=>{e.stopPropagation();setLayers((ls:any[])=>{const i=ls.findIndex((x:any)=>x.id===l.id);if(i<=0)return ls;const n=ls.slice();const t=n[i];n[i]=n[i-1];n[i-1]=t;return n;});}} style={{fontSize:11,color:"#6b6459",background:"none",border:"none",cursor:"pointer",flex:"0 0 auto",padding:"0 2px"}}>▼</button><button type="button" title="Delete" onClick={(e:any)=>{e.stopPropagation();setLayers((ls:any[])=>ls.filter((x:any)=>x.id!==l.id));if(selId===l.id)setSelId(null);}} style={{fontSize:12,color:"#B0361E",background:"none",border:"none",cursor:"pointer",flex:"0 0 auto",padding:"0 2px"}}>✕</button></div>))}</div>)}{sel && (()=>{const it=sel;const isT=it.side==="throat",isL=it.side==="lead",isE=it.side==="profile";const xa=(isE||isL)?324:160,xb=(isE||isL)?356:520,ya=isT?405:50,yb=isT?490:((isE||isL)?510:500),showX=!isT&&!isL;return (<div style={{display:"flex",flexDirection:"column",gap:8,padding:"8px 4px 2px"}}>{showX && <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,color:"#7A7268",width:52}}>Move X</span><input type="range" min={xa} max={xb} value={it.x} onChange={e=>upd({x:+e.target.value})} style={{flex:1}} /></div>}<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,color:"#7A7268",width:52}}>Move Y</span><input type="range" min={ya} max={yb} value={it.y} onChange={e=>upd({y:+e.target.value})} style={{flex:1}} /></div></div>);})()}{sel && sel.type==="text" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <input type="text" value={sel.text} onChange={e=>upd({text:e.target.value})} placeholder="Your text" style={fld} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <label style={lbl}>Font<select value={sel.font} onChange={e=>upd({font:e.target.value})} style={fld}>{FONTS.map((f:any,i:number)=><option key={i} value={f[0]}>{f[1]}</option>)}</select></label>
            <label style={lbl}>Color<input type="color" value={sel.color} onChange={e=>upd({color:e.target.value})} style={col} /></label>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:12, color:"#7A7268", width:44 }}>Size</span><input type="range" min={10} max={80} value={sel.size} onChange={e=>upd({size:+e.target.value})} style={{ flex:1 }} /></div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:12, color:"#7A7268", width:44 }}>Rotate</span><input type="range" min={-90} max={90} value={sel.rot} onChange={e=>upd({rot:+e.target.value})} style={{ flex:1 }} /></div>
        </div>
      )}
      {sel && sel.type==="image" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:12, color:"#7A7268", width:44 }}>Size</span><input type="range" min={10} max={900} value={Math.round(sel.scale*100)} onChange={e=>upd({scale:(+e.target.value)/100})} style={{ flex:1 }} /></div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:12, color:"#7A7268", width:44 }}>Rotate</span><input type="range" min={-180} max={180} value={sel.rot} onChange={e=>upd({rot:+e.target.value})} style={{ flex:1 }} /></div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:12, color:"#7A7268", width:44 }}>Opacity</span><input type="range" min={10} max={100} value={Math.round(sel.opacity*100)} onChange={e=>upd({opacity:(+e.target.value)/100})} style={{ flex:1 }} /></div>
        </div>
      )}
      <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:12, color:"#7A7268" }}>Zoom</span>
        <input type="range" min={60} max={260} value={Math.round(zoom*100)} onChange={e=>setZoom((+e.target.value)/100)} style={{ flex:1, minWidth:120 }} />
        <button type="button" onClick={()=>{ setZoom(1); setPan({x:0,y:0}); }} style={btn}>Reset view</button>
        <button type="button" onClick={download} style={btn}>Download PNG</button><button type="button" onClick={downloadProductionPack} style={{...btn,borderColor:"#1A5C2A",color:"#1A5C2A"}}>Export production pack</button><button onClick={()=>{try{const api=(window as any).__pala3D;if(!api||!api.captureAngles)return;const shots=api.captureAngles();if(!shots||!shots.length)return;const cols=2,cw=560,chh=600,pad=14,lab=26;const rows=Math.ceil(shots.length/cols);const cvs=document.createElement("canvas");cvs.width=cols*cw+pad*(cols+1);cvs.height=rows*(chh+lab)+pad*(rows+1);const g:any=cvs.getContext("2d");g.fillStyle="#EDEADE";g.fillRect(0,0,cvs.width,cvs.height);g.fillStyle="#3a352c";g.font="600 16px Inter,system-ui,sans-serif";g.textAlign="center";let done=0;shots.forEach((s:any,i:number)=>{const im=new Image();im.onload=()=>{const r=Math.floor(i/cols),c=i%cols;const x=pad+c*(cw+pad),y=pad+r*(chh+lab+pad);const ar=(im.width/im.height)||1;let dw=cw,dh=cw/ar;if(dh>chh){dh=chh;dw=chh*ar;}g.drawImage(im,x+(cw-dw)/2,y+(chh-dh)/2,dw,dh);g.fillText((s.name||"").toUpperCase(),x+cw/2,y+chh+18);done++;if(done===shots.length){const a=document.createElement("a");a.download="racquet-angles.png";a.href=cvs.toDataURL("image/png");a.click();}};im.src=s.url;});}catch(_e){}}} style={btn}>Capture angles</button>
      </div>
    </div>
  );
}

export default RacquetDesigner;
