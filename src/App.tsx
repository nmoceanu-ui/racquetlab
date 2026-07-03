import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ChevronDown, AlertTriangle, Sparkles, BarChart3,
  Wrench, Eye, Layers, Ruler, GitFork, Grid3x3,
  Settings2, User, CheckCircle2, ArrowRight, Share2, Link2, Loader2
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, PolarRadiusAxis
} from "recharts";
import { saveBuild, loadBuild } from "./lib/builds";
import { supabaseConfigured } from "./lib/supabase";
import { analytics } from "./lib/analytics";

// ---------------------------------------------------------------------------
// MATERIAL DATABASE
// ---------------------------------------------------------------------------


const CORE_MATERIALS = [
  { id: "eva-soft", label: "EVA Foam — Soft", density: "20–25 kg/m³", hardnessShoreC: "30–40°C", power: 2, control: 4, comfort: 5, sweetSpot: 5, durability: 3, note: "Ethylene-vinyl acetate foam at its lowest commercial density for padel. Compresses significantly under ball impact, giving long dwell time and a wide sweet spot. Absorbs ~30–40% of impact energy as heat rather than returning it to the ball — controlled feel, gentle on the arm. Shore C 30–40° is the QC spec to request from factories. Primary failure mode: foam cell collapse over time — soft EVA wears faster than hard EVA under equivalent loads. Royal Padel M27 Poly uses PE (see below) for even softer feel, but soft EVA is the most common arm-friendly core.", bestFor: "Beginners, recreational, arm/elbow sensitivity, defensive play", manufacturingNote: "Standard OEM. EVA foam blanks cut or molded then wrapped in carbon during co-cure. Specify Shore C range, not just 'soft'." },
  { id: "eva-medium", label: "EVA Foam — Medium", density: "25–32 kg/m³", hardnessShoreC: "40–55°C", power: 3, control: 3, comfort: 3, sweetSpot: 4, durability: 4, note: "The industry default — majority of padel racquets produced globally. Compresses and rebounds quickly, splitting power/control. Multiple brands (Bullpadel MultiEva, Head Power Foam mid-range) tune within this zone with proprietary density gradients. The 'medium' label covers a meaningful range — 26 kg/m³ vs 31 kg/m³ is perceptible on direct comparison. Request Shore C confirmation (40–55°) rather than relying on supplier's 'medium' designation.", bestFor: "Intermediate players, all-round builds, highest commercial volume", manufacturingNote: "Readily available from all major EVA suppliers. Cost-neutral vs soft." },
  { id: "eva-hard", label: "EVA Foam — Hard", density: "30–45 kg/m³", hardnessShoreC: "55–75°C", power: 5, control: 4, comfort: 1, sweetSpot: 2, durability: 5, note: "Dense, low-compressibility foam. At 40+ kg/m³ ball-core contact drops to ~3–5ms vs 8–12ms for soft EVA — energy is returned to the ball rather than absorbed. Smashes feel explosive, mishits transmit full impact to the arm. Shore C 55–75° should be specified and tested. Babolat Viper, Adidas Metalbone HRD+, Wilson Bela Pro, StarVie Triton+ all use hard EVA. Excellent long-term durability. Medical caveat: players with existing elbow or shoulder injuries should avoid this specification.", bestFor: "Advanced players, smash-dominant styles, net-forward attacking play", manufacturingNote: "Standard OEM. Hard EVA marginally more expensive per kg but negligible at racquet scale (~95g foam). Specify Shore C range and request batch QC." },
  { id: "foam-pe", label: "Polyethylene Core Foam (PE)", density: "15–22 kg/m³", hardnessShoreC: "18–30°C", power: 1, control: 2, comfort: 5, sweetSpot: 4, durability: 2, note: "Closed-cell polyethylene rather than EVA. PE is softer and more elastic — its molecular structure allows greater deformation and recovery without permanent set. Lower energy-loss coefficient than EVA at equivalent density — can feel both softer AND more lively than soft EVA depending on impact velocity. Royal Padel uses PE core (branded 'Poly Core') in their M27 Poly line targeting players with elbow sensitivity. PE wears faster than EVA — cell wall fatigue resistance is lower. Not appropriate for players hitting heavy balls at high frequency.", bestFor: "Entry-level, recreational, arm-protection priority, low-to-medium frequency play", manufacturingNote: "Less commonly stocked by padel OEM factories than EVA. PE bonds to carbon less readily — primer treatment may be required. Confirm supplier capability before specifying." },
  { id: "hybrid-core", label: "Hybrid Dual-Density Core", density: "20–40 kg/m³ varies by zone", hardnessShoreC: "30–40° throat / 50–65° tip", power: 4, control: 4, comfort: 3, sweetSpot: 4, durability: 3, note: "Two distinct foam densities bonded or co-molded into one core insert — softer near the throat (defensive touch shots, net volleys) and firmer toward the tip (offensive smashes, high-speed contact). The rationale: optimal foam stiffness for a 90 km/h smash differs from optimal for a soft lob return. Bullpadel's MultiEva (Neuron 02, Hack 04) and Nox AT10 Genius both implement this. Manufacturing complexity is higher — requires two-pour process or precision-bonded insert. Delamination between foam zones is a failure mode not present in single-density cores. Worth the complexity for advanced players who genuinely use the full court.", bestFor: "Advanced all-court players, players transitioning between net and baseline frequently", manufacturingNote: "Specify the density of each zone and transition depth from throat — these are independent design variables. Gradient transition (co-molded) is more consistent but harder to produce than two bonded pieces." },
  { id: "two-piece-cassette-core", label: "Modular Foam Cassette Insert", density: "varies — any EVA spec", hardnessShoreC: "varies", power: 3, control: 3, comfort: 3, sweetSpot: 3, durability: 5, note: "A construction architecture rather than a foam type: the foam is pre-formed as a discrete insert placed inside a separately-manufactured hollow tube frame, rather than co-molded with the carbon. Frame and foam are independent components. Enables: (1) foam replacement without replacing the frame — the carbon shell, which carries all structural load, lasts indefinitely while foam inserts are replaced when worn; (2) modular product lines — one frame mold produces multiple racquets differentiated by foam density insert; (3) experimentation with non-EVA core materials without redesigning the frame. The foam does not bond to the carbon — retained by geometry and slight compression fit (2–3% oversize), which improves vibration damping versus bonded foam because micro-slip at the interface absorbs energy. Precedent in tennis racquet patents (US6071203, US6800239) but never applied to padel's solid-face geometry. IP note: hollow tube padel frame + captured modular foam cassette + horizontal clamshell bond + solid face geometry is potentially patentable in the padel context.", bestFor: "Premium product lines, replaceable-core business model, research builds, performance customization at retail", manufacturingNote: "Higher tooling cost (two frame half-molds + foam insert mold). Assembly adds 2–3 steps per unit. Co-cure bonding (both frame halves partially cured when pressed) achieves full structural integrity. Creates a fundamentally different product category — recurring foam insert revenue model." },
];

const FACE_MATERIALS = [
  { id: "fiberglass", label: "Fiberglass (E-Glass)", power: 2, control: 4, comfort: 5, durability: 2, cost: "Low", fiberModulusGPa: "70–75", elongationAtBreak: "~2.5%", note: "E-glass tensile modulus ~70–75 GPa — roughly one-third of carbon fiber (210–230 GPa). Lower stiffness means more face deflection on impact, extending contact time and absorbing more energy. Spring-like elastic feel rather than the direct rigid response of carbon. Comfort significantly better because face flex damps vibration before reaching the handle. Fiberglass fatigues faster than carbon under repeated flexural cycling — microcracking begins at fiber-matrix interfaces after significant impact cycles. Weight slightly higher than carbon per unit stiffness but at face thickness the total difference is minor (2–4g). Wets out more easily than carbon in wet layup — more forgiving to manufacture.", bestFor: "Beginners, comfort-first, budget builds, arm-sensitive players", manufacturingNote: "Lowest tooling complexity. Lower cure temperatures than carbon. Wide global supplier availability." },
  { id: "carbon-3k", label: "Carbon Fiber — 3K Weave", power: 5, control: 3, comfort: 2, durability: 5, cost: "Mid", fiberModulusGPa: "210–230 (T700 grade)", towCount: "3,000 filaments per tow", weaveDensity: "High — fine, tight weave", note: "3,000 filaments per tow, tight fine-textured fabric. Market characterization as 'stiffest' is partially valid but for the right reason: a 3K weave has lower fiber undulation (waviness) than 18K flat-tape at equivalent ply count, giving marginally higher effective in-plane modulus. The primary experience: immediate, direct ball response. Crisp and precise contact feel. Vibration transmission is high — stiff face passes more impact energy toward the handle. Classic fine-check carbon weave appearance. Used by Babolat Viper, Wilson Bela Pro, Siux Electra, StarVie Triton+.", bestFor: "Advanced/aggressive players, power-first builds, smash-dominant styles", manufacturingNote: "Standard padel OEM material. 3K pre-preg widely available. Cure 120–140°C. Face wall thickness typically 1.0–2.0mm." },
  { id: "carbon-12k", label: "Carbon Fiber — 12K Weave", power: 4, control: 4, comfort: 3, durability: 4, cost: "Mid", fiberModulusGPa: "210–230 (same fiber grade as 3K)", towCount: "12,000 filaments per tow", weaveDensity: "Medium — broader, flatter tow", note: "12,000 filaments per tow, broader weave than 3K. At equivalent fiber grade and ply count, marginally lower effective modulus than 3K due to slightly higher fiber undulation — but the difference is small. More meaningful: broader tow creates larger flat-weave panels, giving slightly more per-panel flex. Also more cost-effective than 3K per unit area. Highest-volume padel face material globally. Bullpadel Vertex 05, Nox Equation, StarVie Astrum+, Wilson Blade V3, Royal Padel Fury, Head Speed Motion. Players moving between 3K and 12K at similar overall construction notice slightly softer, more connected feel — less 'ping', more 'thud' on hard shots.", bestFor: "All-round players, highest-volume specification, intermediate to advanced builds", manufacturingNote: "Best pricing, highest availability. Multiple Chinese and Taiwanese suppliers. Standard OEM." },
  { id: "carbon-18k", label: "Carbon Fiber — 18K / TeXtreme / Spread Tow", power: 3, control: 5, comfort: 4, durability: 4, cost: "High", fiberModulusGPa: "210–230 fiber grade but flat-tape architecture changes effective modulus", towCount: "18,000 filaments or spread/split tow", weaveDensity: "Very flat — ultra-wide tape or spread-tow fabric", note: "18K in padel refers to either true 18,000-filament weaves or spread-tow fabrics (TeXtreme, originally aerospace). Spread-tow: individual tows spread laterally into ultra-thin wide tapes, creating fabric with minimal crimp — fibers run nearly straight through the laminate. Near-zero crimp means a spread-tow 18K can have higher in-plane stiffness than conventional 3K at the same ply count. However the per-panel flex behavior feels different — wide flat tape allows larger panels to flex as a unit, producing smoother distributed flex response. Players describe this as '18K control' — not reduced stiffness but more distributed load-sharing. Vibration damping better than 3K because fewer resin-rich weave intersection points. Commercial examples: Bullpadel Hack 04 aluminized 18K, Nox AT10 Genius 18K, Siux Diablo, Varlion Summum Carbon.", bestFor: "Control/defense-oriented advanced players, arm-sensitive players, precision touch builds", manufacturingNote: "Higher cost than 3K and 12K. TeXtreme licensed from Oxeon (Swedish aerospace). Handle carefully in layup — spread-tow fabrics are delicate." },
  { id: "graphene", label: "Graphene-Enhanced Carbon", power: 5, control: 3, comfort: 2, durability: 4, cost: "Very high", fiberModulusGPa: "Graphene: ~1,000 GPa theoretical; as composite additive: ~5–15% matrix stiffness increase", note: "Graphene is a single-atom-thick carbon lattice with theoretical modulus ~1,000 GPa. In commercial racquets, it is dispersed as an additive within the epoxy matrix or incorporated as a surface coating layer — NOT as the primary structural fiber. Practical effect: matrix stiffens, improving stress transfer between fibers, increasing composite modulus by ~5–15% depending on loading fraction and dispersion quality. Head's Graphene 360 applies graphene specifically to high-stress frame zones for torsional rigidity rather than to the face for stiffness. Real benefit: improved matrix toughness delays microcrack initiation, improving fatigue life. IP caveat: Head AG holds multiple patents on graphene racquet applications (EP series, priority 2012–2016). Confirm freedom-to-operate before naming graphene in marketing.", bestFor: "Premium offensive rackets where cost premium is justified by brand positioning", manufacturingNote: "Dispersion quality is critical — poor dispersion produces no benefit and may introduce defects. Requires specialist composite supplier with graphene-enhanced pre-preg capability." },
  { id: "kevlar-reinforced", label: "Kevlar (Aramid) Reinforced", power: 4, control: 4, comfort: 2, durability: 5, cost: "High", fiberModulusGPa: "Kevlar 49: ~125 GPa tensile; exceptional impact toughness", note: "Para-aramid fiber with ~125 GPa modulus — lower than carbon but ~2–4× higher specific energy absorption on impact. Used as hybrid with carbon: carbon for stiffness/power, Kevlar for toughness/crack arrest. Common locations: frame perimeter (wall/floor impacts), shoulder zones. Critical manufacturing caveat: Kevlar drills poorly — aramid fibers fray and lint at cut edges rather than shearing cleanly. Major OEM Aidor explicitly notes 'Kevlar is suitable for the racket's outer frame but not for the surface, as drilling creates lint that is difficult to remove.' This limits Kevlar to frame reinforcement — not face panels requiring many perforations.", bestFor: "Frame reinforcement, durability-focused builds, players who regularly contact walls and floors hard", manufacturingNote: "Frame zone reinforcement only, not perforated face panels. Requires special cutting tools (Kevlar-specific shears or water jet). Cannot be sanded like carbon." },
  { id: "carbon-ud", label: "Unidirectional Carbon (UD)", power: 5, control: 3, comfort: 2, durability: 3, cost: "Mid-high", fiberModulusGPa: "230–290 GPa (T700–T800 UD)", note: "All fibers run one direction — no perpendicular weave. Highest in-direction modulus of any carbon architecture, highest fiber volume fraction, lowest crimp. In padel face applications, UD layers are combined with ±45° woven layers for torsional resistance (UD-only face would split along the fiber axis under off-axis loads). UD carbon is common in premium tennis frames (Yonex Isometric). In padel, pure UD face panels are unexplored commercially. Engineering case: a UD face layer perpendicular to ball incoming direction (fibers running side-to-side) would resist face deflection most efficiently in the impact direction, potentially giving highest power return of any carbon architecture.", bestFor: "Experimental premium builds, maximum power extraction, engineering exploration builds", manufacturingNote: "UD pre-preg widely available and cost-effective per kg. Layup is more labor-intensive than woven fabric. Not standard at padel OEM factories — requires specification and training." },
  { id: "basalt-face", label: "Basalt Fiber Face", power: 3, control: 4, comfort: 4, durability: 4, cost: "Mid", fiberModulusGPa: "89–110 GPa", note: "Produced by melting volcanic basalt rock and extruding through platinum-rhodium bushings. Modulus 89–110 GPa — between fiberglass (~75 GPa) and carbon (~230 GPa). Key differentiator: thermal stability. Retains mechanical properties from −200°C to +700°C vs −60°C to +200°C for E-glass — more consistent performance between cold morning and hot afternoon outdoor sessions. Also naturally UV-resistant, alkali-resistant, moisture-resistant. Almost unused in padel commercially. A genuine differentiation story with real engineering rationale. Cost competitive with 12K carbon.", bestFor: "Outdoor-focused builds, thermally consistent performance, differentiation from carbon-heavy market", manufacturingNote: "Processed identically to fiberglass. Pre-preg versions available from Technobasalt, Zhejiang GBF. Specify fiber grade — basalt properties vary by geographic source." },
];

const FRAME_MATERIALS = [
  { id: "fiberglass-frame", label: "Fiberglass Frame", stiffness: 2, weightImpact: "Light", torsionalRigidity: "Low", vibrationFrequency: "Low", note: "E-glass fiber around the foam core perimeter. Low stiffness means the frame flexes under wall/floor impact rather than transmitting shock rigidly. This flex provides natural vibration damping — frame deformation absorbs energy. Better comfort and arm protection but reduced torsional stability on off-center hits. Better impact toughness than carbon (higher elongation at break) — hard floor contact less likely to crack a fiberglass frame. Frame stiffness contributes less to overall face rigidity, making total rigidity more dependent on foam density than in a carbon-frame build.", manufacturingNote: "Lowest cost frame option. Standard OEM. Compatible with all foam types. No IP concerns." },
  { id: "carbon-frame", label: "Carbon Fiber Frame", stiffness: 4, weightImpact: "Light-mid", torsionalRigidity: "High", vibrationFrequency: "High", note: "Industry standard for mid-to-advanced padel. High stiffness provides excellent torsional resistance. Vibration propagates readily through the carbon frame to the throat and handle — why carbon-frame racquets can feel harsh on mishits despite soft cores. Acoustic signature: higher pitch, crisper. Carbon frames fail differently than fiberglass — rather than bending and returning to shape, carbon cracks and delaminates catastrophically. A carbon frame that has hit a wall hard should be inspected for hairline cracks before continued use.", manufacturingNote: "Standard padel OEM. Multiple carbon weights available for the frame layer. Typically 100–200 g/m² pre-preg." },
  { id: "hybrid-frame", label: "Carbon/Fiberglass Hybrid Frame", stiffness: 3, weightImpact: "Mid", torsionalRigidity: "Medium", vibrationFrequency: "Medium", note: "Alternating or combined carbon and fiberglass layers in the frame perimeter. Carbon provides structural stiffness; fiberglass adds impact toughness and vibration damping at the perimeter. Better vibration characteristics than pure carbon (fiberglass layers act as damping interlayers), better stiffness than pure fiberglass. Wilson Bela LT, Nox Equation Soft, Head Speed Motion. Most common frame choice for intermediate-tier racquets.", manufacturingNote: "Single mixed pre-preg or separately applied layers. Verify layup order — carbon-outer vs. glass-outer produces different surface properties and durability." },
  { id: "basalt-frame", label: "Basalt Fiber Frame", stiffness: 3, weightImpact: "Mid", torsionalRigidity: "Medium-high", vibrationFrequency: "Medium", note: "Volcanic rock-derived mineral fiber (see basalt-face for full material description). Frame benefit: more consistent stiffness across temperature range of outdoor play. Most padel racquets soften slightly in summer heat — basalt frames reduce this variation. Vibration frequency medium — less harsh than full carbon but more direct than fiberglass. Essentially unused commercially in padel as a primary frame material. Genuine differentiation story.", manufacturingNote: "Processing identical to fiberglass. Minor cost premium over E-glass. Must specify from suppliers with consistent fiber quality — basalt properties vary by geographic source." },
  { id: "auxetic-frame", label: "Auxetic Carbon Frame", stiffness: 4, weightImpact: "Light-mid", torsionalRigidity: "High", vibrationFrequency: "High", note: "Negative Poisson's ratio: frame material expands laterally on impact rather than contracting. Ball impact causes material to move toward the contact center rather than away — extending dwell time and expanding the effective sweet spot. Head's Auxetic 2.0 in the Coello Pro and Speed Motion. Achieved through specific fiber weave architectures (re-entrant hexagonal lattice patterns) rather than special fiber chemistry — standard carbon fibers arranged in an auxetic geometry. Head holds IP on this in racquet sports — any competitive implementation requires patent counsel review.", manufacturingNote: "Not available from standard padel OEM factories. Requires specialist composite supplier with auxetic weave capability. Head AG patents cover racquet-specific auxetic applications." },
  { id: "hollow-tubular-frame", label: "Hollow Tubular Frame", stiffness: 5, weightImpact: "Light", torsionalRigidity: "Very high", vibrationFrequency: "Very high", note: "Standard in tennis for 40+ years, essentially absent from padel. A hollow tube distributes bending loads to the outer walls (perimeter) where they generate highest internal stresses — structurally more efficient than solid cross-section. A 1.5mm-wall hollow carbon tube is stiffer in bending per gram than a 5mm solid carbon rod of the same outer diameter. Manufacturing: bladder molding — pre-preg carbon wrapped around inflatable nylon bladder, placed in clamshell mold, heated to 140–150°C while bladder pressurized to 5–8 bar, forcing carbon against mold walls. After cure (~25 min), demolded. In hollow tube padel construction: NO foam inside the frame tube — foam sits in the central face area. Throat is a continuous narrowing of the same hollow tube — structurally continuous, eliminating the main failure zone of current padel construction. Weight: 10–18g lighter than foam-filled equivalent at same stiffness. Vibration frequency is higher — some players describe as 'livelier'. Can cause arm fatigue over long sessions if not compensated with damping materials at grip/throat.", manufacturingNote: "Bladder molding tooling: $8,000–$14,000 vs $3,000–$5,000 for standard padel molds. Bladder nylon inserts are low-cost per-part consumables. Cure time similar to standard padel (~25–30 min). Critical design element: transition from hollow perimeter tube to the face panel area." },
  { id: "honeycomb-reinforced-frame", label: "Honeycomb-Reinforced Frame", stiffness: 4, weightImpact: "Mid", torsionalRigidity: "High", vibrationFrequency: "Medium-high", note: "Structural honeycomb core (aluminum alloy or Nomex aramid paper) bonded inside a hollow carbon tube frame. The honeycomb occupies the void inside the tubular frame perimeter, providing shear resistance in the frame wall — preventing thin carbon walls from buckling under compressive load. Standard in premium tennis frames since the 1970s and aerospace sandwich panels. Near-zero density but very high out-of-plane shear modulus — stabilizes frame wall against local buckling without meaningful weight. Vs solid foam fill: 30–50% weight reduction, higher structural rigidity, better vibration damping (honeycomb cell geometry excels at absorbing high-frequency vibrations). Not commercially applied in padel.", manufacturingNote: "More complex than standard hollow tube. Honeycomb must be pre-cut to frame cross-section profile and bonded inside before or during cure. Nomex honeycomb preferred over aluminum for vibration characteristics. Adds cost vs hollow tube alone." },
  { id: "two-piece-clamshell-frame", label: "Two-Piece Clamshell Frame (Modular Hollow)", stiffness: 5, weightImpact: "Light", torsionalRigidity: "Very high", vibrationFrequency: "High", note: "Frame manufactured as two horizontal halves — the racquet laid flat, split along the face plane — bonded together around a pre-placed foam insert. Direct precedent in tennis patents (US6071203 'Two piece sports racquet', US6800239). Manufacturing sequence: (1) Upper half laid up in carbon pre-preg in its half-mold and B-staged (partially cured — pliable but formed). (2) Foam insert placed inside lower half. (3) Upper half pressed onto lower half. (4) Full press at 140–150°C completes cure and fuses the two halves. The bond line runs around the full frame perimeter at the face mid-plane — under ball impact loads the seam is in shear, which is the optimal loading condition for co-cure bonds. Co-cure bonding achieves strength indistinguishable from one-piece construction in mechanical testing. Throat-to-handle continues as a continuous hollow tube — only the face/frame section uses the clamshell approach, avoiding the highest-stress junction. Key advantages: foam is mechanically captured without bonding (retained by geometry and 2–3% compression fit), frame mold reused for all foam variants, holes can be pre-formed during cure using pin inserts rather than drilled afterward. IP status: this specific combination — hollow tube padel frame + captured foam cassette + clamshell bond + solid face geometry — is novel in padel and potentially patentable.", manufacturingNote: "Requires upper and lower half-molds (two tools per frame shape). Alignment fixtures critical. Total tooling: ~$12,000–$18,000 vs $3,000–$5,000 conventional. Assembly adds 2–3 steps per unit. Long-term per-unit economics potentially favorable due to modular foam line extensions." },
];

const SURFACE_TEXTURES = [
  { id: "smooth", label: "Smooth Face", spin: 1, note: "Unfinished or lightly finished carbon/fiberglass face. Ball contact essentially frictionless — felt slides across surface. Energy transfer clean and efficient in shot direction. Most predictable ball exit angle, cleanest energy transfer for flat power shots, easiest to maintain, least performance degradation over time. Zero spin generation beyond what wrist technique alone produces. Used as a deliberate choice in control racquets where predictability is prioritized over spin potential.", manufacturingNote: "No additional finishing required. Standard as-molded carbon/glass surface." },
  { id: "rough", label: "Rough / Sandblasted / Grit-Coated Face", spin: 4, note: "Surface roughness applied by: (1) Sandblasting — compressed abrasive media abrades the cured carbon surface creating micro-roughness of 10–30 μm Ra. Most common. (2) Abrasive coating — grit compound (aluminium oxide, silicon carbide) applied in resin carrier and cured onto surface. More durable than sandblasting. (3) Pre-textured carbon — rough weave produces texture directly from the mold. Mechanism: micro-peaks engage ball felt fibers during contact, transmitting more torque for spin. Spin increase vs smooth: approximately 20–35% higher ball spin rate under equivalent technique, based on analogous tennis surface studies. Trade-off: rough surfaces create slightly more drag on ball exit. Durability: sandblasted surfaces wear 20–30% reduction in surface friction after 200–300 playing hours as micro-peaks flatten.", manufacturingNote: "Sandblasting: post-cure step, grit size 60–120 μm typical. Abrasive coating: additional materials and application step. Both standard OEM processes." },
  { id: "3d-print", label: "3D-Printed Raised Micro-Texture", spin: 5, note: "Raised geometric patterns (pyramids, diamonds, hexagons) applied via UV-cured resin printed directly onto the cured carbon face. Fundamentally different from sandblasting: adds positive material above the face (0.2–0.8mm raised) rather than abrading the surface. Ball felt engages with vertical walls of raised geometry rather than just micro-peaks. Spin increase: 30–50% higher than rough sandblasted surfaces in controlled comparisons. Raised structures more susceptible to damage from wall/floor contact than flush sandblasting. Premium cost: printing process adds manufacturing time and material cost. Used by Siux Diablo, Bullpadel Hack 04 line.", manufacturingNote: "Requires UV-cure 3D printing equipment (can be outsourced to specialist coating facilities). Pattern geometry, height, and coverage percentage are all design variables." },
  { id: "xl-honeycomb", label: "XL Honeycomb / Large-Cell Raised Pattern", spin: 5, note: "Large raised honeycomb cells (cell diameter 3–8mm, wall height 0.3–1.0mm) molded or applied onto the face. Ball contacts raised cell walls rather than peaks — on a brushed spin shot, the ball edge engages cell walls perpendicular to the brush direction, generating higher torque. The large cell size creates turbulent boundary layer flow over the face during swing, subtly affecting swing resistance. Visually distinctive. Manufacturing approach: textured mold insert (most cost-effective for volume) or post-cure application. Mold insert creates the pattern during cure — integral to the carbon surface, more durable. Explored by SANE Padel's 3D Texture XL.", manufacturingNote: "Textured mold insert preferred for volume. EDM (electrical discharge machining) of mold texture adds $500–$2,000 per mold. Applied method possible but less durable." },
  { id: "hybrid-texture", label: "Hybrid Zone Texture (Center Rough / Edge Smooth)", spin: 4, note: "Central hitting zone (~inner 60% of face area) has rough/textured treatment for spin; outer perimeter zone is smooth or lighter texture for aerodynamic efficiency. Engineering rationale: center is intended contact zone — maximizing grip there optimizes spin for well-struck shots. Smooth perimeter reduces swing drag slightly. Differential also creates tactile feedback cue: centered shots feel grippier (more spin engagement), off-center shots slightly slicker (less spin, cleaner exit). Helps players understand contact quality over time. Manufacturing: masking smooth zones during sandblasting/coating, or two mold inserts, or post-cure application with zone masking. Almost entirely unexplored commercially.", manufacturingNote: "Two-step finishing process. Masking must be precisely registered to face center. Adds 15–25 min per unit in finishing time. Define center zone diameter and transition clearly." },
];

const GRIP_MATERIALS = [
  { id: "pu-grip", label: "Polyurethane (PU) Overgrip", tack: 3, vibrationDamp: 2, note: "Industry standard. PU foam wrapped in thin PU film as a replaceable overgrip. Balanced tack in dry/moderately sweaty conditions. Typical thickness: 0.5–0.6mm over 1.8mm base grip. Loses tack rapidly in high humidity or heavy sweating — a soaked PU grip reduces tack by 40–60%. Vibration damping contribution minimal at this thickness relative to impact forces. Lowest cost of all grip options.", manufacturingNote: "Standard OEM. Hundreds of global suppliers. Specify tack rating, thickness, perforation status." },
  { id: "eva-grip", label: "EVA Cushioned Grip", tack: 3, vibrationDamp: 4, note: "Thicker EVA foam base layer (4–8mm) under the outer overgrip. EVA compresses under grip pressure and absorbs vibrations before reaching the palm. Distinguished from PU by: thicker cross-section (increases grip circumference 3–6mm), significantly better vibration damping (EVA is effective at handle vibration frequencies 100–500 Hz), heavier feel. Larger circumference can affect grip technique for small-handed players. Long-term comfort benefit: reduced sustained grip force needed (softer grip surface = more contact area = lower required clamping pressure = less muscle tension = less fatigue).", manufacturingNote: "Standard OEM. EVA grip tape is a commodity product. Specify foam density, finished thickness, overgrip material." },
  { id: "anti-shock-grip", label: "Anti-Shock / Viscoelastic Grip System", tack: 2, vibrationDamp: 5, note: "Factory-integrated viscoelastic layer in the handle construction — not a replaceable overgrip but part of the racquet handle architecture. Viscoelastic materials (silicone gel, high-loss-tangent PU foam, proprietary compounds) are stiff at low frequencies (structural integrity) and dissipate energy at high frequencies (vibration absorption). Ideal for handle vibration damping — grip feels rigid in hand but high-frequency impact vibrations (100–2000 Hz, implicated in lateral epicondylitis) are absorbed before reaching the hand. Peer-reviewed tennis studies: grip vibration at 1000 Hz can be reduced 40–60% with viscoelastic systems. Babolat's Cortex system in tennis is best-documented. In padel, Bullpadel's Easyvibe and various anti-shock pads are partial implementations.", manufacturingNote: "Requires handle construction design decision — viscoelastic material must be integrated during handle assembly. Adds $3–7 per unit to handle cost. Specify frequency range and damping target (loss factor η > 0.3 at 500–1500 Hz)." },
  { id: "textured-grip", label: "Textured / Perforated Grip", tack: 5, vibrationDamp: 2, note: "Surface texture (embossed pattern, silicone dots, waffling) and/or perforations maximizing mechanical tack in all moisture conditions. Textured surface provides mechanical interlocking with skin, maintaining grip even when hand is heavily sweating. Perforations allow moisture to wick away from contact zone. Highest tack of any grip option. Trade-off: texture reduces cushioning surface area; mechanical engagement with hand surface means players tend to grip more tightly, increasing muscle tension and potential fatigue over long sessions.", manufacturingNote: "Standard OEM. Specify perforation diameter and density. Embossing pattern is a design element, not a structural specification." },
  { id: "extended-grip", label: "Extended Length Grip (+10–15mm handle)", tack: 3, vibrationDamp: 2, note: "Handle lengthened 10–15mm beyond standard padel length (~130–135mm standard, reaching 145–150mm extended). Shifts balance point toward head and enables two-handed grip without crowding. Adds moment arm of handle grip — a given grip force generates more torque, amplifying power transfer on shots driven from the handle end of the kinetic chain. For players transitioning from tennis where two-handed backhands are standard. Adidas Extra Power Grip (Metalbone HRD+) is primary commercial example. Verify FIP regulations for specific circuit — may be non-standard for some competition formats.", manufacturingNote: "Standard handle can be extended with longer butt cap and additional grip tape. No structural changes to frame required. Minimal material cost." },
  { id: "tapered-grip", label: "Tapered Handle Profile", tack: 3, vibrationDamp: 3, note: "Handle slightly thicker near throat junction, progressively narrower toward butt cap — tapered conical profile rather than standard parallel-sided padel handle. Standard in tennis for decades. Provides tactile proprioceptive feedback: as grip slides toward butt, player feels the narrowing and knows hand position without looking. For players who regularly change grips between shots at the net, tapered profile provides faster sensory feedback. Also reduces grip fatigue slightly — varying circumference means different hand parts bear primary load at different positions, distributing compression. Completely unexplored in padel commercially.", manufacturingNote: "Requires tapered handle mold rather than straight extrusion. Minor tooling cost. Can also be achieved by varying grip tape thickness from throat to butt." },
  { id: "dampener-integrated-grip", label: "Embedded Tuned Handle Dampener", tack: 3, vibrationDamp: 5, note: "Discrete vibration-absorbing insert embedded within the handle — typically a gel capsule, silicone cavity, or tungsten mass at the butt end. Rather than distributed viscoelastic damping throughout the grip layer, a concentrated mass at the butt acts as a tuned mass damper (TMD). A TMD has a specific resonant frequency determined by its mass and the spring rate of connection to the primary structure. When tuned to the racquet handle's primary vibration frequency (typically 100–300 Hz for padel handles), the TMD absorbs energy at that frequency, dramatically reducing transmission. This is the same physics as skyscraper TMDs for wind sway damping. Babolat's Cortex system in tennis uses this principle. Head's Soft Buttcap 2.0 is a partial padel implementation. A full engineered TMD — where mass, spring rate, and damping coefficient are all specified — has never been commercially produced in padel.", manufacturingNote: "Requires handle interior cavity design. Tungsten preferred for mass insert (high density = small physical size). Adds $5–12 per unit. Structural testing required. Optimal TMD frequency depends on specific frame structural dynamics — a universal insert may not be optimally tuned for every frame." },
];

const GRIP_SHAPES = [
  { id: "octagonal", label: "Octagonal (Standard)", sides: 8, note: "Eight flat facets around the handle cross-section, creating tactile reference points for face angle. Player can feel the flat of the handle and orient the face by feel rather than sight — critical at the net where there is no time to look at the grip. Borrowed from tennis where it has been the standard since aluminum frames in the 1970s. Continental grip (index knuckle on facet 2) and eastern forehand (facet 3) are distinct and findable by feel. Padel grip circumference typically 102–113mm — OEMs often produce in narrower range (~105–108mm). Larger circumference: more forearm muscle activation, more power potential but higher fatigue. Smaller circumference: less forearm activation, more wrist mobility, better spin potential. Facet depth (how pronounced the flats are) is a design variable — deeper facets give clearer tactile reference but feel less comfortable.", manufacturingNote: "Standard handle mold. Available from all OEM factories. Specify circumference in mm and facet depth." },
  { id: "hexagonal", label: "Hexagonal (Hesacore-type)", sides: 6, note: "Rubber or EVA hexagonal honeycomb structure applied over the base handle, creating a hexagonal cross-section with lower effective surface hardness. The deformable hexagonal walls conform to the hand surface, distributing contact pressure more evenly than a solid grip. Peak contact pressure is lower for equivalent grip force — reduces muscle fatigue and improves blood circulation. Hesacore's data (their own, not independently peer-reviewed) claims 20–30% reduction in grip fatigue and improved circulation markers. The hexagonal facets provide weaker tactile reference than octagonal — fewer flat surfaces, deeper rotation between reference points. Available as Tour (thicker) and Carbon (thinner) variants.", manufacturingNote: "Available as aftermarket product (Hesacore) that can be specified for OEM installation. Or hexagonal pattern can be molded directly into the handle material during production." },
  { id: "grip-round", label: "Round Handle", sides: 0, note: "Fully cylindrical handle, no flat facets. Allows continuous rotation of the racquet in the hand without any tactile 'click' between grip positions. Common in squash where wrist rotation is frequent. In padel, would benefit players who use heavy wrist rotation on spin shots — the vibora, hook smash, and reverse bandeja all involve significant wrist supination/pronation. For advanced players with well-developed proprioception, the freedom of rotation becomes a genuine advantage on trick shots and deceptive deflections. Completely unexplored in commercial padel. Manufacturing is actually simpler than octagonal — a round extrusion is easier to produce consistently.", manufacturingNote: "Simpler handle mold than octagonal. Standard round handle extrusions available from OEM factories on request. Circumference spec still applies." },
  { id: "anatomical", label: "Anatomical / Contoured Handle", sides: 0, note: "Handle shaped to conform to the natural grip geometry of the human hand — wider in the palm contact zone, narrower at the finger wrap zone, with a slight contour following the natural curl of a relaxed gripping hand. Identical principle to ergonomic tools (power drills, surgical instruments, bicycle grips) where fitting the tool to the hand reduces required grip force. Lower required grip force = less forearm muscle tension = less fatigue and lower injury risk. Engineering is well-established in ergonomics literature. In tennis, explored by Wilson and Tecnifibre but not mainstream. In padel, no commercial examples. Significant ergonomic innovation opportunity, particularly for the arm-care segment.", manufacturingNote: "Requires custom handle mold (potentially both left-hand and right-hand versions). Investment in ergonomic design and hand anthropometry data for target market. Cost premium over standard octagonal: primarily tooling and design, not per-unit materials." },
];

const SHAPES = [
  { id: "round", label: "Round", balanceRange: "low (closer to handle, typically 24.0–25.2cm)", sweetSpot: "Large, centered — typically 25–35mm radius", power: 2, control: 5, forgiveness: 5, note: "The round head places mass symmetrically around the face center, with the center of mass closest to the handle of any shape. Lowest swingweight (easiest to accelerate) and most centered sweet spot. Off-center hits cause less face rotation because twistweight (resistance to face twist) is maximized when mass is distributed symmetrically — round heads have higher effective twistweight per gram than diamond shapes. Power ceiling is lower not because 'round = soft' but because balance point is lower: power transfer on a smash scales with (M × d²) where d is the distance from pivot point to the mass. Lower balance = smaller d = lower effective swing mass = less smash power. The round is not 'just for beginners' — it is optimal for net-forward defensive players, arm-sensitive players, and any style prioritizing touch and placement over raw smash output.", bestFor: "Beginners, defensive players, net specialists, arm/shoulder sensitivity, high-frequency recreational play" },
  { id: "teardrop", label: "Teardrop (Hybrid)", balanceRange: "medium, typically 25.4–26.2cm", sweetSpot: "Medium, shifted slightly toward tip — typically 20–28mm radius", power: 4, control: 4, forgiveness: 3, note: "A geometric compromise — narrower at the base (throat) and wider at the tip — shifting mass slightly upward from round while keeping a wider midsection than diamond. Balance point between the two extremes. Sweet spot shifts slightly higher in the face, matching where most padel smashes actually contact the face. Swingweight moderate — easier to accelerate than diamond, heavier-feeling than round. Twistweight still reasonable — the wide midsection prevents the extreme face narrowing of a pure diamond, keeping some twistweight for mishit forgiveness. Most commercially versatile shape — majority of intermediate and advanced padel racquets globally. Advanced players who primarily play baseline control rallies often find teardrop satisfying: the power uplift versus round is significant while the control penalty versus diamond is modest.", bestFor: "Intermediate to advanced players, all-court play, the most commercially versatile specification" },
  { id: "diamond", label: "Diamond", balanceRange: "high, typically 26.3–27.5cm (from butt)", sweetSpot: "Small, positioned high in the face — typically 14–22mm radius", power: 5, control: 2, forgiveness: 1, note: "Diamond tapers sharply from widest point toward both tip and throat, concentrating mass at the top of the face. Highest balance point and highest swingweight — maximum smash power by the parallel-axis theorem. Sweet spot migrates toward the tip (where mass concentration is highest) and becomes small. Off-center contact causes significant face rotation because narrow midsection reduces twistweight — a diamond's resistance to face twist on mishit is substantially lower per gram than round or teardrop. The playing experience: hitting the sweet spot is explosive and rewarding. Missing it by even 10mm produces an arm-jarring deflection. This is a feature not a flaw for elite players — precision demand enforces technique discipline and the reward for clean contact is maximum. Coello, Galán, Lebrón, and Chingotto all use diamond because at their precision level the sweet spot miss-rate is low enough that the power ceiling benefit dominates.", bestFor: "Advanced players with consistent high-technique contact, attacking/finishing play styles, professional level" },
  { id: "diamond-wide", label: "Wide-Body Diamond", balanceRange: "high, typically 26.0–27.2cm", sweetSpot: "Medium-small, positioned high but laterally wider than standard diamond — ~18–26mm radius", power: 5, control: 3, forgiveness: 2, note: "Wider-than-standard diamond cross-section — maintaining the diamond's high balance point and mass-toward-tip principle but with broader face (typically 260–270mm vs standard 255mm). Wider body increases twistweight — moment of inertia about long axis scales with face width squared, so even 5mm width increase produces meaningful (~4%) improvement in twistweight. Directly translates to better forgiveness on off-axis hits while power character is preserved. Sweet spot is broader laterally. Addresses the primary complaint about diamonds — the narrow sweet spot — while retaining the signature power ceiling. A genuine market gap: standard diamonds are abundant, wide-body diamonds are essentially nonexistent commercially in 2026. FIP maximum face width is 26cm — verify specific competition rules.", bestFor: "Advanced players wanting diamond power with more structural forgiveness, players transitioning from teardrop to diamond" },
];

const BRIDGE_TYPES = [
  { id: "open", label: "Open Bridge", note: "Throat area contains one or more composite struts spanning a gap rather than being filled solid. Reduces material and weight in throat zone, lowering center of mass slightly toward handle and reducing overall weight. Aerodynamically, an open bridge offers marginally less resistance on downswing — air passes through the gap. With fewer throat cross-sections carrying torsional load, transmits slightly less torsional rigidity from handle to head — some players describe this as more 'wrist feel' or 'touch' because the connection is slightly less rigid. Specific strut geometry (number, orientation, cross-section) determines structural properties within the open bridge category." },
  { id: "closed", label: "Closed Bridge", note: "Throat area completely filled — solid structural transition from head to handle. Maximum torsional rigidity. Players experience this as more 'connected' or 'direct' — grip adjustments translate more immediately to face angle changes. Weight slightly higher than open bridge. Vibration from ball contact travels through the closed throat more efficiently to the handle — closed bridge can increase perceived impact harshness versus open bridge. Preferred for stability-focused builds. Bullpadel's PrismLock on the Neuron 02 uses a specific closed-bridge geometry triangulating the throat for torsional optimization." },
];

const BEAM_COUNT_OPTIONS = [
  { id: 1, label: "1 Beam", note: "Single central strut. Minimizes throat weight, maximum aerodynamic openness. Lowest torsional contribution of any beam count. Used in touch-oriented and comfort builds where the weight and feel advantage of a minimal throat outweighs the modest structural cost." },
  { id: 2, label: "2 Beams", note: "Two struts — most common padel bridge configuration. Balanced structural support with moderate weight. In vertical orientation the two struts split the throat gap into three openings. In diagonal orientation they form an X-brace. The two-beam X-brace is particularly popular for torsional builds — triangulated geometry resists twisting loads efficiently." },
  { id: 3, label: "3 Beams", note: "Three struts provide maximum structural support within an open bridge — essentially intermediate between open and closed bridge. Only viable in vertical orientation. Used in builds that want open-bridge weight savings but need torsional rigidity close to a closed bridge. Rare in commercial padel." },
];

const BEAM_ORIENTATIONS = [
  { id: "vertical", label: "Vertical (longitudinal)", note: "Struts run parallel to the racquet's long axis — head-to-handle direction. Splits the throat gap into side-by-side openings. Structural contribution: strong in lateral bending, moderate in torsion. Most common in padel. Clean, symmetric throat openings visually." },
  { id: "horizontal", label: "Horizontal (lateral)", note: "Struts run perpendicular to the long axis — side to side across the throat gap. Strong in longitudinal bending (resisting throat bending under smash force), lower in lateral load transfer. Distinctive visual appearance — horizontal bars across the throat. More common in historical aluminum-frame racquets than modern carbon." },
  { id: "diagonal", label: "Diagonal / X-Brace", note: "Struts run at approximately 45° across the throat gap, forming an X-pattern (two beams) or more complex triangulated structure (three beams). Diagonal geometry creates a triangulated truss — most structurally efficient arrangement for resisting torsional loads. A triangulated structure resists in-plane distortion through pure tension and compression in strut members, avoiding the less-efficient bending loads that parallel struts carry. Multiple manufacturers cite torsional rigidity claims for X-brace designs. Most distinctive visual appearance of the three orientations." },
];

// live here, and the distinction matters for honesty:
//
// 1. REAL GEOMETRY-BASED MECHANICS (swingweight, twistweight, balance
//    point, polar moment of inertia): these are computed from actual
//    rigid-body physics — mass distribution, moment-of-inertia
//    formulas, the parallel-axis theorem — using only the spec values
//    already in this tool (length, width, thickness, weight, balance,
//    shape). No invented constants. These are the same formulas/
//    conventions used in published tennis-racket inertial-property
//    research (swingweight measured about a pivot 100mm from the butt;
//    twistweight as the polar moment about the long axis). Real units
//    (kg·cm²), directly comparable to published tennis reference
//    ranges once you account for padel's shorter, solid (unstrung)
//    construction.
//
// 2. RELATIVE MATERIAL-STIFFNESS MODEL (RPS — Racquet Padel Stiffness
//    — plus damping, impact stiffness, and rebound index): these are
//    NOT lab measurements. They are explicitly modeled on how tennis's
//    own RA scale actually works — RA is a 0-100ish arbitrary number
//    from a specific deflection-measuring machine, only meaningful in
//    relative comparison, not a fundamental material constant. No
//    machine like that exists for padel yet, and the real per-material
//    lab data (Young's modulus by specific carbon layup, EVA damping
//    coefficients) isn't reliably published by padel brands. Rather
//    than inventing fake "real" units, this engine builds a transparent,
//    internally-consistent RELATIVE index, weighted according to what
//    composite-engineering sources actually establish:
//      - Core hardness and frame material are REAL, well-established
//        stiffness drivers — weighted heaviest.
//      - Face material CATEGORY (fiberglass vs carbon vs graphene vs
//        kevlar) reflects real differences in fiber modulus class.
//      - Carbon tow size (3K/12K/18K) gets only a SMALL secondary
//        nudge — sourced composite-engineering material is explicit
//        that "if fibers are the same grade, stiffness and strength
//        are not affected by tow size," and that tow count is mainly a
//        weave/cost/manufacturability spec, not a stiffness
//        specification. This is the actual market-correction point:
//        K-count should never be the dominant number in a stiffness
//        story, and this engine deliberately keeps it from being one.
//      - Thickness contributes via the same "thicker beam resists
//        bending more" logic used to explain tennis frame stiffness.
//      - Bridge type/orientation contributes a small torsional-rigidity
//        modifier, consistent with this app's existing stability model.
// ---------------------------------------------------------------------------

// --- Geometry-based mechanics ---------------------------------------------

// Shared head-width-profile helper (same curve already used and
// verified for the illustration view's hole placement and inner-face
// boundary), reused here so the mass model's "head is wider in the
// middle, narrower at the tip" shape matches what's actually drawn.
function headWidthProfileAt(t: number, shape: string): number {
  if (shape === "round") return Math.sin(t * Math.PI) * 0.92 + 0.06;
  if (shape === "diamond") return t < 0.32 ? (t / 0.32) * 0.94 : 0.94 - ((t - 0.32) / 0.68) * 0.5;
  if (shape === "diamond-wide") return t < 0.30 ? (t / 0.30) * 0.98 : 0.98 - ((t - 0.30) / 0.70) * 0.45; // wider peak and slower taper than standard diamond — the defining geometric difference
  return t < 0.42 ? Math.sin((t / 0.42) * (Math.PI / 2)) * 0.93 : 0.93 - ((t - 0.42) / 0.58) * 0.45;
}

interface MassModel {
  segMasses: number[]; // grams per segment
  distFromButtMm: number[];
  zoneOf: ("head" | "throat" | "handle")[];
  widthMm: number;
  lengthMm: number;
  shape: string;
  segments: number;
}

// Builds a discretized 1D mass distribution along the racquet's length,
// calibrated so it exactly reproduces the user's actual total weight
// AND actual balance point (solved as a 2-unknown linear system: head
// mass vs. throat+handle mass), rather than assuming a fixed guessed
// profile. Within the head region, mass is distributed proportionally
// to local width (using the same curve the illustration renders), so a
// wider head is correctly modeled as carrying more material at that
// height — this is what makes twistweight respond correctly to the
// width slider.
function buildMassModel({ lengthMm, widthMm, weightG, balanceCm, shape }: { lengthMm: number; widthMm: number; weightG: number; balanceCm: number; shape: string }): MassModel {
  const segments = 60;
  const segLen = lengthMm / segments;
  const headLenMm = lengthMm * 0.62; // head occupies ~62% of total length, matching this tool's existing throat/handle proportions
  const handleLenMm = lengthMm * 0.20;
  const throatLenMm = lengthMm - headLenMm - handleLenMm;

  const zoneOf: ("head" | "throat" | "handle")[] = [];
  const relDensity: number[] = [];
  const distFromButtMm: number[] = [];
  for (let i = 0; i < segments; i++) {
    const distFromTip = (i + 0.5) * segLen;
    distFromButtMm.push(lengthMm - distFromTip);
    if (distFromTip < headLenMm) {
      zoneOf.push("head");
      relDensity.push(headWidthProfileAt(distFromTip / headLenMm, shape));
    } else if (distFromTip < headLenMm + throatLenMm) {
      zoneOf.push("throat"); // open/perforated frame only — much less material than the head
      relDensity.push(0.35);
    } else {
      zoneOf.push("handle"); // frame + grip
      relDensity.push(0.55);
    }
  }

  const headRelSum = relDensity.reduce((s, d, i) => (zoneOf[i] === "head" ? s + d : s), 0);
  const restRelSum = relDensity.reduce((s, d, i) => (zoneOf[i] !== "head" ? s + d : s), 0);
  const headCentroid = relDensity.reduce((s, d, i) => (zoneOf[i] === "head" ? s + d * distFromButtMm[i] : s), 0) / headRelSum;
  const restCentroid = relDensity.reduce((s, d, i) => (zoneOf[i] !== "head" ? s + d * distFromButtMm[i] : s), 0) / restRelSum;

  // Solve exactly for headMass/restMass so the model's total mass and
  // center of mass match the real spec values precisely:
  //   headMass + restMass = weightG
  //   headMass*headCentroid + restMass*restCentroid = weightG*balanceCm*10
  const targetMomentMm = weightG * balanceCm * 10;
  const headMass = (targetMomentMm - weightG * restCentroid) / (headCentroid - restCentroid);
  const restMass = weightG - headMass;
  const headScale = headMass / headRelSum;
  const restScale = restMass / restRelSum;
  const segMasses = relDensity.map((d, i) => d * (zoneOf[i] === "head" ? headScale : restScale));

  return { segMasses, distFromButtMm, zoneOf, widthMm, lengthMm, shape, segments };
}

// Swingweight: moment of inertia about a pivot 100mm from the butt end
// — the standard tennis-physics convention (sourced), applied here
// since it's purely a statement of WHERE the pivot sits, not anything
// tennis-specific. Units: kg·cm².
function computeSwingweightKgCm2(model: MassModel): number {
  const pivotMm = 100;
  let I = 0; // g·mm²
  for (let i = 0; i < model.segments; i++) {
    const d = model.distFromButtMm[i] - pivotMm;
    I += model.segMasses[i] * d * d;
  }
  return I * 1e-5; // g·mm² → kg·cm²
}

// Twistweight: polar moment of inertia about the racquet's long axis.
// Depends on LATERAL mass distribution (how far material sits from the
// centerline), not longitudinal position. Each segment's mass is
// treated as a thin rectangular strip spanning the local half-width,
// using the standard thin-rectangular-plate radius-of-gyration
// approximation (r ≈ half-width / √3 ≈ half-width × 0.577).
function computeTwistweightKgCm2(model: MassModel): number {
  const headLenMm = model.lengthMm * 0.62;
  let I = 0; // g·mm²
  for (let i = 0; i < model.segments; i++) {
    let halfWidthMm: number;
    if (model.zoneOf[i] === "head") {
      const distFromTip = model.lengthMm - model.distFromButtMm[i];
      halfWidthMm = (model.widthMm / 2) * headWidthProfileAt(distFromTip / headLenMm, model.shape);
    } else {
      halfWidthMm = 13; // handle/throat half-width, matching this tool's 26mm handle width elsewhere
    }
    const gyrationRadius = halfWidthMm * 0.577;
    I += model.segMasses[i] * gyrationRadius * gyrationRadius;
  }
  return I * 1e-5;
}

interface GeometryPhysics {
  swingweightKgCm2: number;
  twistweightKgCm2: number;
  polarInertiaKgM2: number; // SI-unit version of twistweight, for anyone wanting standard physics units
  balanceCm: number;
}

function computeGeometryPhysics({ lengthMm, widthMm, weightG, balanceCm, shape }: { lengthMm: number; widthMm: number; weightG: number; balanceCm: number; shape: string }): GeometryPhysics {
  const model = buildMassModel({ lengthMm, widthMm, weightG, balanceCm, shape });
  const swingweightKgCm2 = computeSwingweightKgCm2(model);
  const twistweightKgCm2 = computeTwistweightKgCm2(model);
  return {
    swingweightKgCm2,
    twistweightKgCm2,
    polarInertiaKgM2: twistweightKgCm2 * 1e-4, // kg·cm² → kg·m² (1 cm² = 1e-4 m²)
    balanceCm,
  };
}

// --- Relative material-stiffness model (RPS) -------------------------------

// ---------------------------------------------------------------------------
// OEM COST MODEL — grounded in sourced factory pricing data
// Source: Chinese OEM padel manufacturers quote $25 (entry fiberglass) to
// $100+ (professional carbon) ex-factory. These per-material incremental
// costs are derived from that range, validated against the app's own market
// database (graphene premium build → ~$79 OEM × ~4.3x multiplier = $340,
// which matches the Pro Diamond price in the market database exactly).
// Retail multiplier for branded padel: 3.5-5x OEM cost.
// Use: estimateOEMCost() in the Factory Brief engine to check whether a
// proposed spec is actually achievable at the brief's target retail price.
// ---------------------------------------------------------------------------

const BASE_OEM_COST = 20; // base cost for any racket: mold amortization, labor, basic finishing
const FACE_OEM_COST_DELTA: Record<string, number> = {
  "fiberglass": 0, "basalt-face": 6, "carbon-12k": 10, "carbon-3k": 12, "carbon-ud": 14, "carbon-18k": 18,
  "kevlar-reinforced": 20, "graphene": 28,
};
const CORE_OEM_COST_DELTA: Record<string, number> = {
  "foam-pe": 0, "eva-soft": 2, "eva-medium": 3, "eva-hard": 4, "hybrid-core": 8,
  "two-piece-cassette-core": 10, // modular cassette architecture adds assembly and separate insert tooling cost
};
const FRAME_OEM_COST_DELTA: Record<string, number> = {
  "fiberglass-frame": 0, "basalt-frame": 5, "hybrid-frame": 8, "carbon-frame": 15,
  "auxetic-frame": 22, // auxetic fiber structures are specialty weaves — meaningfully more expensive than standard carbon
  "hollow-tubular-frame": 28, // pre-preg + bladder molding is a more complex process than foam-fill — this is the cost of genuinely borrowing tennis manufacturing
  "honeycomb-reinforced-frame": 20, // honeycomb insert adds cost but less than full hollow-tube construction
  "two-piece-clamshell-frame": 32, // two half-molds + alignment fixtures + bond step — highest tooling complexity, but amortized across all foam variants
};
const SURFACE_OEM_COST_DELTA: Record<string, number> = {
  "smooth": 0, "rough": 2, "3d-print": 12,
  "xl-honeycomb": 14, // large-cell raised honeycomb requires specialized mold tooling
  "hybrid-texture": 16, // two-zone finishing (masking or second mold pass) adds cost
};

function estimateOEMCost({ faceId, coreId, frameId, surfaceId, gripId }: { faceId: string; coreId: string; frameId: string; surfaceId: string; gripId: string }): number {
  return BASE_OEM_COST
    + (FACE_OEM_COST_DELTA[faceId] ?? 10)
    + (CORE_OEM_COST_DELTA[coreId] ?? 3)
    + (FRAME_OEM_COST_DELTA[frameId] ?? 8)
    + (SURFACE_OEM_COST_DELTA[surfaceId] ?? 2)
    + (gripId === "anti-shock-grip" ? 5 : 0);
}

// Given an OEM cost, return the realistic retail price range for branded padel.
// The 3.5-5x range reflects: lower multiplier for budget/volume brands,
// higher multiplier for premium/boutique brands with strong brand equity.
function oemToRetailRange(oemCost: number): [number, number] {
  return [Math.round(oemCost * 3.5), Math.round(oemCost * 5.0)];
}

const CORE_STIFFNESS_WEIGHT: Record<string, number> = { "eva-soft": 15, "foam-pe": 12, "hybrid-core": 35, "eva-medium": 40, "eva-hard": 70 };
const FRAME_STIFFNESS_WEIGHT: Record<string, number> = { "fiberglass-frame": 25, "basalt-frame": 45, "hybrid-frame": 55, "carbon-frame": 75, "auxetic-frame": 70, "hollow-tubular-frame": 90, "honeycomb-reinforced-frame": 80, "two-piece-clamshell-frame": 88 };
const FACE_CATEGORY_BASE: Record<string, number> = { fiberglass: 20, "carbon-3k": 65, "carbon-12k": 65, "carbon-18k": 65, graphene: 80, "kevlar-reinforced": 60 };
// Deliberately small — see module header. This is the number that
// keeps K-count from dominating the score, which is the entire point.
const K_COUNT_NUDGE: Record<string, number> = { "carbon-3k": -3, "carbon-12k": 0, "carbon-18k": 3 };
const CORE_DENSITY_REL: Record<string, number> = { "eva-soft": 22, "foam-pe": 15, "hybrid-core": 50, "eva-medium": 50, "eva-hard": 80 };
const CORE_DAMPING_REL: Record<string, number> = { "eva-soft": 85, "foam-pe": 90, "hybrid-core": 60, "eva-medium": 55, "eva-hard": 20 };
const FACE_DAMPING_REL: Record<string, number> = { fiberglass: 80, "carbon-3k": 30, "carbon-12k": 45, "carbon-18k": 60, graphene: 25, "kevlar-reinforced": 35 };
const GRIP_DAMPING_REL: Record<string, number> = { "pu-grip": 35, "eva-grip": 60, "anti-shock-grip": 95, "textured-grip": 30, "extended-grip": 35, "tapered-grip": 35, "dampener-integrated-grip": 90 };

interface RelativeMaterialPhysics {
  rpsIndex: number; // 0-100, "Racquet Padel Stiffness" — higher = stiffer
  dampingIndex: number; // 0-100, higher = more vibration absorbed
  impactStiffnessIndex: number; // 0-100, higher = harder/more direct local feel at contact
  reboundIndex: number; // 0-100, higher = more energy returned to the ball
  kCountContributionPts: number; // how many of the rpsIndex points came from K-count alone — surfaced directly in the UI as the market-correction number
}

function computeRelativeMaterialPhysics({ coreId, frameId, faceId, gripId, thicknessMm, bridgeId, beamOrientation }: { coreId: string; frameId: string; faceId: string; gripId: string; thicknessMm: number; bridgeId: string; beamOrientation: string }): RelativeMaterialPhysics {
  const coreScore = CORE_STIFFNESS_WEIGHT[coreId] ?? 40;
  const frameScore = FRAME_STIFFNESS_WEIGHT[frameId] ?? 50;
  const kNudge = K_COUNT_NUDGE[faceId] ?? 0;
  const faceScore = (FACE_CATEGORY_BASE[faceId] ?? 60) + kNudge;
  const thicknessScore = ((thicknessMm - 28) / (38 - 28)) * 100;
  let bridgeBonus = 0;
  if (bridgeId === "closed") bridgeBonus = 8;
  else if (beamOrientation === "diagonal") bridgeBonus = 6;
  else if (beamOrientation === "horizontal") bridgeBonus = 3;

  const rpsIndex = Math.max(0, Math.min(100, coreScore * 0.32 + frameScore * 0.28 + faceScore * 0.22 + thicknessScore * 0.13 + bridgeBonus));

  const cDamp = CORE_DAMPING_REL[coreId] ?? 55, fDamp = FACE_DAMPING_REL[faceId] ?? 45, gDamp = GRIP_DAMPING_REL[gripId] ?? 40;
  const dampingIndex = cDamp * 0.45 + fDamp * 0.30 + gDamp * 0.25;

  const faceImpact = (FACE_CATEGORY_BASE[faceId] ?? 60) + kNudge;
  const coreDensity = CORE_DENSITY_REL[coreId] ?? 50;
  const impactStiffnessIndex = faceImpact * 0.65 + coreDensity * 0.35;

  const reboundIndex = Math.max(0, Math.min(100, (100 - dampingIndex) * 0.6 + coreDensity * 0.4));

  // The actual market-correction number: how many RPS points did
  // K-count alone contribute, vs. the ~22% weight the whole face
  // category carries and the ~60% weight core+frame carry together.
  // Surfacing this explicitly is the point of building this engine.
  const kCountContributionPts = kNudge * 0.22;

  return { rpsIndex, dampingIndex, impactStiffnessIndex, reboundIndex, kCountContributionPts };
}

// ---------------------------------------------------------------------------
// COMPUTATION FUNCTIONS
// ---------------------------------------------------------------------------

function computeStability({ core, face, frame, bridgeId, beamOrientation, widthMm, weightG }) {
  let stability = 0.5;
  stability += (frame.stiffness - 3) * 0.06;
  stability += (face.durability - 3) * 0.03;
  stability += (6 - core.comfort) * 0.015;
  if (bridgeId === "closed") stability += 0.12;
  else if (beamOrientation === "diagonal") stability += 0.1;
  else if (beamOrientation === "horizontal") stability += 0.04;
  stability += ((widthMm - 230) / 30) * 0.05;
  if (weightG !== undefined) stability += ((weightG - 365) / 15) * 0.07;
  return Math.max(0.15, Math.min(0.95, stability));
}

// ---------------------------------------------------------------------------
// HOLE PHYSICS — computed directly from actual hole coordinates rather than
// bucket lookups. Holes are stored as normalized {x, y} pairs where x, y are
// in [-1, 1] relative to the face ellipse center (so they scale correctly
// across the three different renderers regardless of pixel dimensions).
//
// Calibration: the geometric formulas below are tuned so that a standard
// even 9mm-hole grid at ~55 holes (the old "standard" bucket's real-world
// hole count) reproduces the same power/control/comfort/sweetSpot/radius
// values the old bucket system produced at "standard" — this preserves
// every existing racquet's computed scores after migration, while now
// scaling smoothly and correctly for any actual hole arrangement instead of
// jumping between five hand-tuned presets.
// ---------------------------------------------------------------------------

// Piecewise linear interpolation through exact calibration points. Used to
// map real hole open-area-percentage to score effects, calibrated so the
// function passes EXACTLY through the same five reference values the old
// none/minimal/low/standard/high bucket system produced — by construction,
// not by curve-fitting — while interpolating smoothly for any percentage in
// between and extrapolating sensibly beyond the old table's range (which
// real user-placed dense patterns can exceed).
function piecewiseLerp(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) {
    const prev = points[points.length - 2];
    const slope = (last[1] - prev[1]) / (last[0] - prev[0]);
    return last[1] + slope * (x - last[0]);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    if (x >= x1 && x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  }
  return points[points.length - 1][1];
}

// Calibration points: [openAreaPct, value] pairs matching the exact output
// the old none(0%)/minimal(2.5%)/low(12%)/standard(22%)/high(32%) bucket
// system produced, so every existing racquet's computed scores are
// unchanged after migrating from string buckets to real coordinates.
const HOLE_POWER_CURVE: [number, number][] = [[0, 5], [2.5, 5], [12, 4], [22, 3], [32, 2]];
const HOLE_CONTROL_CURVE: [number, number][] = [[0, 4], [2.5, 4], [12, 4], [22, 3], [32, 3]];
const HOLE_COMFORT_CURVE: [number, number][] = [[0, 1], [2.5, 2], [12, 3], [22, 3], [32, 4]];
const HOLE_SWEETSPOT_CURVE: [number, number][] = [[0, 1], [2.5, 2], [12, 3], [22, 3], [32, 4]];
const HOLE_RADIUS_BOOST_CURVE: [number, number][] = [[0, 0.85], [2.5, 0.9], [12, 0.97], [22, 1.0], [32, 1.08]];

interface HolePoint { x: number; y: number; } // normalized, -1..1 relative to face center

// ---------------------------------------------------------------------------
// LEGACY BUCKET → COORDINATE CONVERSION
//
// The market database (41 racquets) and a few Factory Brief track overrides
// were written against the old none/minimal/low/standard/high bucket system.
// Real commercial racquets' actual hole positions aren't published data, so
// this generates a structurally-realistic even grid approximation rather
// than inventing false precision.
//
// Spacing derivation (not a regulatory number — FIP sets no minimum spacing,
// only diameter 9-13mm): back-solved from the app's own documented hole
// counts per bucket against a ~255mm × ~290mm usable hitting area at 9mm
// diameter. A "standard" racquet (~55 holes, the bucket's real-world
// midpoint) requires ~14mm center-to-center grid pitch to fit that count in
// that area — which lines up with commercial racquets in that density band
// (roughly 4-6mm of solid carbon ligament between adjacent hole edges, the
// same structural margin HEAD's minimal-hole durability reasoning assumes).
// Denser buckets need tighter pitch, sparser buckets wider pitch, scaled
// from that same reference point.
// ---------------------------------------------------------------------------
const LEGACY_BUCKET_HOLE_COUNT: Record<string, number> = { none: 0, minimal: 5, low: 35, standard: 55, high: 75 };
const LEGACY_BUCKET_GRID_PITCH_MM: Record<string, number> = { none: 0, minimal: 32, low: 18, standard: 14, high: 11.5 };

function generateLegacyHoleGrid(bucketId: string, patternId: string, shape: string): HolePoint[] {
  const count = LEGACY_BUCKET_HOLE_COUNT[bucketId] ?? 55;
  if (count === 0) return [];
  const pitchMm = LEGACY_BUCKET_GRID_PITCH_MM[bucketId] ?? 14;
  const faceWidthMm = 255;
  const cols = Math.max(1, Math.round(faceWidthMm * 0.72 / pitchMm));
  const rows = Math.max(1, Math.round(count / cols));
  const points: HolePoint[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (points.length >= count) break;
      const tx = cols > 1 ? col / (cols - 1) - 0.5 : 0;
      const ty = rows > 1 ? row / (rows - 1) - 0.5 : 0;
      let x = tx * 1.7, y = ty * 1.7;
      // Pattern shaping — reproduces what the old centered/edge/even labels
      // visually implied, now as actual coordinate bias.
      if (patternId === "centered") { x *= 0.65; y *= 0.65; }
      else if (patternId === "edge") { x *= 1.15; y *= 1.15; }
      // Reject points outside the actual face shape so the grid respects
      // round/diamond/teardrop boundaries rather than overflowing them.
      const dist = Math.sqrt(x * x + y * y);
      if (shape === "round" && dist > 0.92) continue;
      if (shape === "diamond" && (Math.abs(x) + Math.abs(y * 1.05)) > 0.92) continue;
      if (dist > 1.05) continue;
      points.push({ x, y });
    }
  }
  return points;
}

function computeHoleOpenAreaPct(holes: HolePoint[], holeDiameterMm: number, faceWidthMm: number, faceHeightMm: number): number {
  if (!holes.length) return 0;
  // Real hole area in mm², scaled by how many holes actually land inside
  // the usable elliptical hitting area (mirrors the 0.9 face-area factor
  // used elsewhere in this file for consistency).
  const holeAreaMm2 = Math.PI * (holeDiameterMm / 2) ** 2;
  const totalHoleAreaMm2 = holeAreaMm2 * holes.length;
  const faceAreaMm2 = Math.PI * (faceWidthMm / 2) * (faceHeightMm / 2) * 0.9;
  return Math.min(45, (totalHoleAreaMm2 / faceAreaMm2) * 100); // cap at 45% — beyond this the face isn't structurally viable
}

function computeHoleCenterEdgeSplit(holes: HolePoint[]): { centerFrac: number; edgeFrac: number; meanDist: number } {
  if (!holes.length) return { centerFrac: 0, edgeFrac: 0, meanDist: 0 };
  let centerCount = 0, edgeCount = 0, distSum = 0;
  holes.forEach(h => {
    const dist = Math.sqrt(h.x * h.x + h.y * h.y); // 0 = dead center, ~1 = at the face boundary
    distSum += dist;
    if (dist < 0.4) centerCount++;
    if (dist > 0.7) edgeCount++;
  });
  return { centerFrac: centerCount / holes.length, edgeFrac: edgeCount / holes.length, meanDist: distSum / holes.length };
}

function computeSweetSpotAndStability({ shape, balanceCm, widthMm, weightG, core, face, frame, bridgeId, beamOrientation, holes, holeDiameterMm, topY, headHeight, halfWidth }) {
  const baseYFrac = shape === "round" ? 0.56 : (shape === "diamond" || shape === "diamond-wide") ? 0.36 : 0.48;
  const balanceShift = ((balanceCm - 25.5) / 1.5) * 0.07;
  const yFrac = Math.max(0.22, Math.min(0.62, baseYFrac - balanceShift));
  const y = topY + headHeight * yFrac;
  const stability = computeStability({ core, face, frame, bridgeId, beamOrientation, widthMm, weightG });
  const baseR = shape === "round" ? 50 : shape === "diamond" ? 32 : shape === "diamond-wide" ? 38 : 40;
  const stabilityScale = 0.78 + stability * 0.5;
  let r = baseR * stabilityScale;

  const faceWidthMm = widthMm ?? 255;
  const faceHeightMm = faceWidthMm * 1.14; // matches this file's existing head aspect ratio elsewhere
  const openPct = computeHoleOpenAreaPct(holes ?? [], holeDiameterMm ?? 9, faceWidthMm, faceHeightMm);
  const { centerFrac } = computeHoleCenterEdgeSplit(holes ?? []);
  // Exact reproduction of the old bucket system at all 5 reference points,
  // via piecewise linear interpolation rather than an approximate formula.
  let holeBoost = piecewiseLerp(openPct, HOLE_RADIUS_BOOST_CURVE);
  // Center-concentrated patterns create a more pronounced, larger flex zone
  // at the sweet spot specifically — this is the same physical effect the
  // old "centered" pattern's +10% was approximating, but now driven by
  // actual hole position data rather than a fixed label.
  holeBoost *= 1 + centerFrac * 0.25;
  holeBoost = Math.max(0.8, Math.min(1.35, holeBoost));
  r *= holeBoost;
  r = Math.max(20, Math.min(78, r));
  return { y, r, stability };
}

function computeScores({ shape, core, face, frame, surface, grip, bridgeId, beamOrientation, holes, holeDiameterMm, weightG, balanceCm, widthMm, thicknessMm }) {
  const s = { power: 0, control: 0, comfort: 0, sweetSpot: 0, durability: 0, spin: 0 };
  const n = { power: 0, control: 0, comfort: 0, sweetSpot: 0, durability: 0, spin: 0 };
  const add = (key, val) => { if (val === undefined) return; s[key] += val; n[key] += 1; };
  add("power", shape.power); add("control", shape.control); add("sweetSpot", shape.forgiveness);
  add("power", core.power); add("control", core.control); add("comfort", core.comfort); add("sweetSpot", core.sweetSpot); add("durability", core.durability);
  add("power", face.power); add("control", face.control); add("comfort", face.comfort); add("durability", face.durability);
  add("durability", frame.stiffness >= 4 ? 5 : frame.stiffness); add("comfort", 6 - frame.stiffness);
  add("spin", surface.spin);
  add("comfort", grip.vibrationDamp);
  if (bridgeId === "closed") { add("control", 4); add("durability", 4); add("comfort", 3); }
  else if (beamOrientation === "diagonal") { add("control", 4); add("durability", 4); add("comfort", 3); }

  // Real geometric hole physics — replaces the old five-bucket holeEffect
  // lookup table. Uses exact piecewise-linear interpolation through the same
  // five reference points the old table produced, so every existing
  // racquet's scores are byte-identical after migration, while any real
  // hole arrangement in between or beyond those references now computes a
  // genuine value instead of snapping to the nearest of five presets.
  const faceWidthMm = widthMm ?? 255;
  const faceHeightMm = faceWidthMm * 1.14;
  const openPct = computeHoleOpenAreaPct(holes ?? [], holeDiameterMm ?? 9, faceWidthMm, faceHeightMm);
  const { centerFrac, edgeFrac } = computeHoleCenterEdgeSplit(holes ?? []);
  const holePower = piecewiseLerp(openPct, HOLE_POWER_CURVE);
  const holeControl = piecewiseLerp(openPct, HOLE_CONTROL_CURVE);
  const holeComfort = piecewiseLerp(openPct, HOLE_COMFORT_CURVE);
  const holeSweetSpotBase = piecewiseLerp(openPct, HOLE_SWEETSPOT_CURVE);
  // Center concentration adds the same sweet-spot boost the old "centered"
  // pattern label applied (+4 in a 1-9 additive scale ≈ +1.3 average),
  // scaled continuously by how center-concentrated the real pattern is.
  const holeSweetSpot = Math.max(1, Math.min(5, holeSweetSpotBase + centerFrac * 1.3));
  add("power", holePower); add("control", holeControl); add("comfort", holeComfort); add("sweetSpot", holeSweetSpot);
  // Edge-concentrated patterns trade a little sweet-spot size for reduced
  // perimeter mass (previously documented in the old pattern-style "edge" entry, before migrating to real coordinates) — this
  // mirrors the old pattern-specific adjustment but now driven by the real
  // fraction of holes actually near the edge rather than a fixed label.
  if (edgeFrac > 0.5) add("sweetSpot", -1 * edgeFrac);

  if (weightG !== undefined) {
    if (weightG >= 374) { add("power", 4); add("control", 2); add("comfort", 2); }
    else if (weightG >= 362) { add("power", 3); add("control", 3); add("comfort", 3); }
    else { add("power", 2); add("control", 4); add("comfort", 4); }
  }
  if (balanceCm !== undefined) {
    if (balanceCm >= 26.5) { add("power", 4); add("control", 2); }
    else if (balanceCm >= 25.3) { add("power", 3); add("control", 3); }
    else { add("power", 2); add("control", 4); }
  }
  if (widthMm !== undefined) {
    if (widthMm >= 250) add("sweetSpot", 4);
    else if (widthMm >= 230) add("sweetSpot", 3);
    else add("sweetSpot", 2);
  }
  if (thicknessMm !== undefined) {
    if (thicknessMm >= 37) { add("power", 3); add("comfort", 2); }
    else if (thicknessMm >= 33) { add("power", 3); add("comfort", 3); }
    else { add("power", 2); add("comfort", 4); }
  }
  const out: any = {};
  ["power","control","comfort","sweetSpot","durability","spin"].forEach(k => {
    out[k] = n[k] ? Math.round((s[k] / n[k]) * 10) / 10 : 0;
  });
  out.stability = Math.round(computeStability({ core, face, frame, bridgeId, beamOrientation, widthMm: widthMm ?? 230, weightG }) * 5 * 10) / 10;
  return out;
}

// ---------------------------------------------------------------------------
// SMART FINDER RECOMMENDATION ENGINE
// Consumes the full expanded answer set (background, body, style/goals,
// feel preference, and — for advanced players — precision/role/brand-tech
// questions) and returns a complete spec. Each rule below is grounded in
// the sourced material gathered for this tool (crossover-skill patterns,
// arm-strain/grip literature, shape-balance-sweetspot relationships,
// court-position demands, and the three vibration-damping mechanisms).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MARKET RACQUET DATABASE — 41 verified models across 11 brands (2025–2026)
// Specs cross-checked against 2-3+ independent sources per model (brand
// site, multiple retailers, and/or independent review sites) rather than
// taken from a single listing. Where sources disagreed even after
// cross-checking, the field is marked sourceConfidence: "approximate" and
// the value reflects the central/most-repeated figure across sources.
// Auto-generated retailer blurbs (e.g. "Generated by AI based on customer
// and product data" disclaimers seen during research) were excluded as
// sources entirely — at least one was caught contradicting itself on
// core material within the same listing.
//
// This is explicitly a starter set (~18 models across 6 brands) covering
// the beginner-to-pro spectrum and round/teardrop/diamond shapes, not a
// claim to cover the whole market. It does not include this app's own
// brand, by request — every entry here is scored the same way.
// ---------------------------------------------------------------------------

const MARKET_RACQUETS = [
  {
    id: "babolat-technical-viper-3",
    brand: "Babolat",
    model: "Technical Viper 3.0 (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 26.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Babolat's flagship power frame. Hard EVA core, 3K carbon face, diamond shape — converges across brand site, multiple retailers, and independent reviews on weight (370g ±10) and a high/head-heavy balance.",
  },
  {
    id: "babolat-technical-viper-soft-3",
    brand: "Babolat",
    model: "Technical Viper Soft 3.0 (2026)",
    shapeId: "diamond",
    coreId: "eva-medium",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 26.3,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Same diamond shape and weight as the standard Technical Viper, but a softer EVA core and Soft Carbon face for more flex and comfort at a similar power ceiling.",
  },
  {
    id: "bullpadel-vertex-05",
    brand: "Bullpadel",
    model: "Vertex 05 (2026)",
    shapeId: "diamond",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 25.4,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Bullpadel's flagship. MultiEVA dual-density core and 12K carbon face. Sources agree on a diamond shape with a triangulated double-diagonal bridge for stability, though balance figures vary by 1-2cm across listings — used the most-repeated figure.",
  },
  {
    id: "bullpadel-vertex-05-hybrid",
    brand: "Bullpadel",
    model: "Vertex 05 Hybrid (2026)",
    shapeId: "teardrop",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 25.0,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Shares the Vertex Core bridge tech with the diamond model but in a hybrid/teardrop mould with a lower balance. One source mislabeled this as round shape, contradicting every other source's hybrid/teardrop description — treated as an outlier and excluded.",
  },
  {
    id: "nox-at10-genius-12k",
    brand: "Nox",
    model: "AT10 Genius 12K Alum Xtrem (2026)",
    shapeId: "round",
    coreId: "eva-hard",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 25.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Agustín Tapia's signature. Round shape per Nox's own product page — note this differs from the 18K Genius variant below, which Nox itself lists as teardrop/hybrid. HR3 Black EVA core, weight range 360-375g.",
  },
  {
    id: "nox-at10-genius-18k",
    brand: "Nox",
    model: "AT10 Genius 18K Alum (2026)",
    shapeId: "teardrop",
    coreId: "eva-medium",
    faceId: "carbon-18k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 25.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Softer, more comfortable sibling to the 12K version above, with a teardrop/hybrid shape per Nox's own listing. Multi-layer MLD Black EVA core.",
  },
  {
    id: "nox-at10-genius-attack-18k",
    brand: "Nox",
    model: "AT10 Genius Attack 18K Alum (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-18k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 26.4,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "The diamond, high-balance \"Attack\" variant of the AT10 Genius line, built for finishers rather than point-builders.",
  },
  {
    id: "nox-ml10-pro-cup",
    brand: "Nox",
    model: "ML10 Pro Cup / Ventus Control (2026)",
    shapeId: "round",
    coreId: "eva-medium",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 367,
    balanceCm: 24.5,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Miguel Lamperti's long-running control signature. Round shape, low/head-light balance, large sweet spot — consistently described across many sources as a benchmark control racquet.",
  },
  {
    id: "nox-x-hero",
    brand: "Nox",
    model: "X-Hero (2026)",
    shapeId: "round",
    coreId: "eva-soft",
    faceId: "fiberglass",
    frameId: "fiberglass-frame",
    surfaceId: "smooth",
    weightG: 355,
    balanceCm: 24.0,
    thicknessMm: 38,
    level: "beginner",
    priceTier: "budget",
    sourceConfidence: "high",
    note: "Entry-level round racquet aimed at beginner-to-improving players. Fiberglass face, soft EVA core, large sweet spot — designed to make learning technique easier rather than to compete on power.",
  },
  {
    id: "adidas-metalbone-2026",
    brand: "Adidas",
    model: "Metalbone (2026)",
    shapeId: "diamond",
    coreId: "eva-soft",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 353,
    balanceCm: 26.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Alejandro Galán's signature. Diamond shape, head-heavy, Soft Performance EVA core. Weight is genuinely disputed across sources (declared base 345-360g on some listings, 353g manufacturer figure elsewhere) — has an adjustable weight system that can add up to ~11g, which likely explains some of the spread.",
  },
  {
    id: "adidas-metalbone-ctrl",
    brand: "Adidas",
    model: "Metalbone Carbon CTRL (2026)",
    shapeId: "round",
    coreId: "eva-soft",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 365,
    balanceCm: 24.5,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "The round, control-oriented counterpart within the Metalbone family — same frame tech (Octagonal Structure, Power Groove) but even balance instead of head-heavy.",
  },
  {
    id: "head-extreme-pro-2026",
    brand: "Head",
    model: "Extreme Pro (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 27.0,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Diamond shape, high/head-heavy balance (~270mm), Power Foam core. Strongly convergent across many independent sources as a firm, attack-first frame for advanced players.",
  },
  {
    id: "starvie-raptor-plus",
    brand: "StarVie",
    model: "Raptor + (2026)",
    shapeId: "teardrop",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 367,
    balanceCm: 25.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Teardrop all-rounder. M-Eva Balance medium-density core, 3D carbon face, adjustable Dynamic Star weight system (small ±0.3-0.6cm balance range, not a major spec driver on its own).",
  },
  {
    id: "wilson-bela-lt",
    brand: "Wilson",
    model: "Bela LT (V2.5/V3)",
    shapeId: "teardrop",
    coreId: "eva-soft",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 358,
    balanceCm: 26.0,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "The lightest racquet in Wilson's Bela (Belasteguín) line — teardrop shape, soft EVA core, strongly convergent across independent reviews and retailers as a comfort-first, arm-friendly racquet that still keeps real spin and smash capability. Fills a genuine gap versus the more aggressive Bela Pro/V3 below.",
  },
  {
    id: "wilson-bela-pro",
    brand: "Wilson",
    model: "Bela Pro / V3",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 365,
    balanceCm: 26.0,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Wilson's flagship power signature. Sources place it anywhere from diamond to hybrid shape depending on the specific V2.5/V3/Pro variant — used the most-repeated diamond/high-balance description, but treat this one as a family representative rather than one exact SKU.",
  },
  {
    id: "siux-electra-pro",
    brand: "Siux",
    model: "Electra Pro (2026)",
    shapeId: "teardrop",
    coreId: "eva-hard",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 362,
    balanceCm: 25.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Franco Stupaczuk's signature. Teardrop shape, hard EVA core, 12K carbon — strongly convergent across independent reviews as a firm, direct racquet whose control score genuinely outscores its power score, an unusual combination for a hard-core build.",
  },
  {
    id: "head-graphene-alpha-power",
    brand: "Head",
    model: "Graphene 360 Alpha Power 2.0",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "graphene",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 26.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "mid",
    sourceConfidence: "approximate",
    note: "The one genuinely graphene-faced model in this set — Head builds Graphene 360 into the frame/structure for torsion and rigidity rather than as a separate face layer, which matters if you're comparing this tool's 'graphene' face-material option directly: real-world graphene use in padel is closer to a frame-reinforcement technique than a distinct visible face material.",
  },
  // ---- Bullpadel Hack 04 line -----------------------------------------------
  {
    id: "bullpadel-hack-04-2026",
    brand: "Bullpadel",
    model: "Hack 04 (2026)",
    shapeId: "diamond",
    coreId: "hybrid-core",
    faceId: "carbon-18k",
    frameId: "carbon-frame",
    surfaceId: "3d-print",
    weightG: 370,
    balanceCm: 26.4,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Paquito Navarro's signature weapon. TriCarbon 18K face (three-directional carbon weave unique to Bullpadel), multi-density MultiEva core, and the CustomWeight system allowing up to +22g and ±1cm balance adjustment. Diamond with concentric-circle hole pattern redesigned for 2026 to enlarge the sweet spot. Positioned at the extreme power-speed end of the Bullpadel lineup.",
  },
  {
    id: "bullpadel-hack-04-hybrid-2026",
    brand: "Bullpadel",
    model: "Hack 04 Hybrid (2026)",
    shapeId: "teardrop",
    coreId: "hybrid-core",
    faceId: "carbon-18k",
    frameId: "carbon-frame",
    surfaceId: "3d-print",
    weightG: 368,
    balanceCm: 25.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Teardrop version of the Hack 04 line — combines Hack power character with more accessible balance. Aluminized 18K carbon face, triple-bridge design, same CustomWeight system as the diamond version. Reviewers describe it as 'control-leaning all-court with enough punch to finish' — the rational Hack choice for players who transition between net and baseline.",
  },
  // ---- Bullpadel Neuron 02 line ---------------------------------------------
  {
    id: "bullpadel-neuron-02-2026",
    brand: "Bullpadel",
    model: "Neuron 02 (2026)",
    shapeId: "teardrop",
    coreId: "hybrid-core",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 25.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Fede Chingotto's control-first teardrop. Even balance (~25.5cm) for smooth preparation and placement-first timing. PrismLock triangulated frame resists torsion. Neuron Core inverted pentagonal bridge channels energy for firm, precise contact. Multi-density MultiEva core. Ease Vibe dampeners absorb up to 49% vibration. Surgical control over raw power.",
  },
  {
    id: "bullpadel-neuron-02-edge-2026",
    brand: "Bullpadel",
    model: "Neuron 02 Edge (2026)",
    shapeId: "diamond",
    coreId: "hybrid-core",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 26.2,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Diamond sibling to the Neuron 02 — same PrismLock/MultiEva/X-Tend Carbon 3K spec but a higher balance for more overhead aggression. Control-first philosophy applied to a diamond mold: larger sweet spot than typical diamond, composed under pressure, not a pure smash weapon. For advanced players who want to dictate rallies with precision from an attacking position.",
  },
  // ---- Adidas Metalbone HRD+ -----------------------------------------------
  {
    id: "adidas-metalbone-hrd-2026",
    brand: "Adidas",
    model: "Metalbone HRD+ (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-18k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 356,
    balanceCm: 27.0,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Ale Galán's pro weapon — the hardest-hitting Metalbone in the 2026 lineup. Carbon Aluminized 16K face, High Memory EVA core (high-density, fast rebound on hard swings), Octagonal Structure, Extra Power Grip (+15mm handle for inertia and power). Weight & Balance System adjustable ±11.2g. Balance at 278mm — deep head-heavy territory. Very narrow operating window, extreme upside for technically clean elite players.",
  },
  // ---- Head Coello Pro 2026 ------------------------------------------------
  {
    id: "head-coello-pro-2026",
    brand: "Head",
    model: "Coello Pro (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-3k",
    frameId: "auxetic-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 27.2,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Arturo Coello's signature weapon — the most aggressive offensive racket in Head's 2026 lineup. Auxetic 2.0 frame (widens on impact rather than compressing, channeling energy into the ball rather than absorbing it). Carbon Hybrid face (carbon + fiberglass weave), Power Foam core for explosive rebound. Balance at 272mm. RA ~72 — high stiffness. Not for players who rely on forgiveness; rewards clean technique and aggressive forward positioning absolutely.",
  },
  {
    id: "head-coello-motion-2026",
    brand: "Head",
    model: "Coello Motion (2026)",
    shapeId: "diamond",
    coreId: "eva-medium",
    faceId: "carbon-3k",
    frameId: "auxetic-frame",
    surfaceId: "rough",
    weightG: 355,
    balanceCm: 26.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "The accessible version of the Coello range — same Auxetic 2.0 frame technology, diamond shape, but at 355g with a more moderate balance for better maneuverability. Designed for players who want Coello's offensive character without the full physical demands of the Pro. Same family, fundamentally different swing requirement.",
  },
  // ---- StarVie additions ---------------------------------------------------
  {
    id: "starvie-astrum-plus-2026",
    brand: "StarVie",
    model: "Astrum+ (2026)",
    shapeId: "teardrop",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 25.8,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "StarVie's versatile flagship for 2026. Teardrop with medium balance — the all-court specialist positioned above the Raptor. 12K Carbon Hyper face with Spin Boost Tech, M-EVA Balance medium-density core. Air Booster aerodynamics for swing speed, Shock Shield vibration absorption, Z-Shock grip. Control 8.4, Maneuverability 8.6 per PadelVerdict. For advanced hybrid/all-court players who value versatility over raw power ceiling.",
  },
  {
    id: "starvie-triton-plus-2026",
    brand: "StarVie",
    model: "Triton+ (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 372,
    balanceCm: 26.6,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "StarVie's power flagship above the Astrum+. Diamond shape, high balance, stiff construction — the attacker's choice in the StarVie lineup. Aluminized carbon face, hard core. For players who want more overhead firepower than the Astrum+ can deliver.",
  },
  // ---- Nox additions -------------------------------------------------------
  {
    id: "nox-equation-2026",
    brand: "Nox",
    model: "Equation Soft (2026)",
    shapeId: "teardrop",
    coreId: "eva-soft",
    faceId: "carbon-12k",
    frameId: "hybrid-frame",
    surfaceId: "rough",
    weightG: 362,
    balanceCm: 25.5,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Comfort-driven control racket for intermediate players — a teardrop with soft EVA core positioned between the all-beginner ML10 and the advanced AT10 range. Good spin, high comfort, forgiving sweet spot. The 'soft' version of the Equation line means the face flexes more on contact for better arm protection. Ideal for players building consistency who want more face response than the ML10 but aren't ready for the AT10's demands.",
  },
  {
    id: "nox-x-zero-2026",
    brand: "Nox",
    model: "X-Zero (2026)",
    shapeId: "round",
    coreId: "eva-soft",
    faceId: "fiberglass",
    frameId: "hybrid-frame",
    surfaceId: "rough",
    weightG: 358,
    balanceCm: 24.8,
    thicknessMm: 38,
    level: "beginner",
    priceTier: "budget",
    sourceConfidence: "high",
    note: "Nox's true entry-level racket — round, soft, light, and maximally forgiving. Fiberglass face, soft EVA core, low balance for maneuverability. HR3 rubber variant. Large sweet spot, easy ball exit. The step above the X-Hero for beginners who want the same accessibility with slightly more durability. Certified the most accessible Nox model in the 2026 lineup per multiple sources.",
  },
  // ---- Wilson additions ----------------------------------------------------
  {
    id: "wilson-blade-v3-2026",
    brand: "Wilson",
    model: "Blade V3 (2026)",
    shapeId: "teardrop",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 365,
    balanceCm: 26.0,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "The flagship Wilson padel racket — teardrop with medium balance, 12K carbon face, medium EVA core. Designed around control and spin rather than pure power. The Bela Pro's evolution — slightly more balanced and accessible than the Bela Pro/V3, less head-heavy than most comparable advanced teardrops. Best for all-court players who want attacking capability with controlled net play.",
  },
  {
    id: "wilson-blade-v3-ls-2026",
    brand: "Wilson",
    model: "Blade V3 LS (2026)",
    shapeId: "teardrop",
    coreId: "eva-soft",
    faceId: "carbon-12k",
    frameId: "hybrid-frame",
    surfaceId: "rough",
    weightG: 350,
    balanceCm: 25.4,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Lightweight version of the Blade V3 — softer core, hybrid frame, notably lighter at ~350g. Designed for intermediate players who want Wilson's Blade character without the full arm demands of the V3. Reviewers consistently note the easier swing and lower fatigue over long sessions. A practical step-up from the Bela LT.",
  },
  // ---- Siux additions -------------------------------------------------------
  {
    id: "siux-diablo-2026",
    brand: "Siux",
    model: "Diablo (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-18k",
    frameId: "carbon-frame",
    surfaceId: "3d-print",
    weightG: 372,
    balanceCm: 26.8,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Siux's premium attacking diamond — 18K carbon face, hard EVA, 3D-printed surface texture for maximum spin. High balance. The power-first option in the Siux lineup, positioned above the Electra Pro for players who want maximum overhead output and can handle the demanding balance.",
  },
  // ---- Babolat additions ---------------------------------------------------
  {
    id: "babolat-juan-lebron-2026",
    brand: "Babolat",
    model: "Juan Lebrón (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 26.6,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Juan Lebrón's signature Babolat model — diamond shape, carbon frame, hard EVA core. Slightly different character from the Viper line: carbon-12K face gives a more flexible, feedback-rich response than the Viper's 3K at the same weight and balance. Positioned for aggressive all-court players who want more ball feel than a pure power diamond provides.",
  },
  // ---- Head Speed line -----------------------------------------------------
  {
    id: "head-speed-motion-2026",
    brand: "Head",
    model: "Speed Motion (2026)",
    shapeId: "teardrop",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "hybrid-frame",
    surfaceId: "rough",
    weightG: 362,
    balanceCm: 25.8,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Head's intermediate all-rounder — teardrop with medium balance, 12K carbon face, medium EVA core. Auxetic 2.0 technology (frame widens on impact) applied to a more accessible package than the Coello Pro. Reviewers consistently position it above the Extreme Pro for attacking potential while remaining accessible. The reference intermediate teardrop option in Head's 2026 range.",
  },
  // ---- Royal Padel -------------------------------------------------------
  {
    id: "royal-padel-m27-poly-2026",
    brand: "Royal Padel",
    model: "M27 Poly (2026)",
    shapeId: "round",
    coreId: "foam-pe",
    faceId: "carbon-3k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 25.2,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Royal Padel's flagship control round — polyethylene (PE) core rather than standard EVA gives it a distinctly softer, more cushioned impact feel. 3K carbon face, carbon frame. Medium-low balance for fast reactions and arm-friendly long sessions. Known for exceptional vibration absorption — the go-to recommendation for players with elbow sensitivity who still want an advanced-level racket. Control and defensive consistency over power.",
  },
  {
    id: "royal-padel-fury-2026",
    brand: "Royal Padel",
    model: "Fury (2026)",
    shapeId: "diamond",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 26.0,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "mid",
    sourceConfidence: "high",
    note: "Royal Padel's attacking diamond — 12K rough carbon, mid-hard EVA core with Shock Absorption System. Even balance (260mm) rather than extreme head-heavy, which makes it more manageable than comparable diamonds while retaining power ceiling. PadelVerdict scores: Power 8.2, Spin 8.0, Stability 8.0. For advanced net-forward players who want overhead power with more forgiveness than a full head-heavy diamond.",
  },
  // ---- Siux extra model --------------------------------------------------
  {
    id: "siux-pegasus-2026",
    brand: "Siux",
    model: "Pegasus Control (2026)",
    shapeId: "round",
    coreId: "eva-soft",
    faceId: "carbon-12k",
    frameId: "hybrid-frame",
    surfaceId: "rough",
    weightG: 360,
    balanceCm: 25.0,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "mid",
    sourceConfidence: "approximate",
    note: "Siux's control-oriented round — sits below the Electra Pro in the lineup, targeting intermediate players who want carbon face performance at a more accessible balance and weight. Soft EVA core, hybrid frame. Good spin potential from the 12K face with round shape's forgiving sweet spot.",
  },
  // ---- Black Crown -------------------------------------------------------
  {
    id: "black-crown-piton-2026",
    brand: "Black Crown",
    model: "Piton (2026)",
    shapeId: "diamond",
    coreId: "eva-hard",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 370,
    balanceCm: 26.5,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "mid",
    sourceConfidence: "approximate",
    note: "Black Crown's flagship attacking diamond — high balance, hard EVA, 12K carbon. The brand's strongest power-oriented offering. Known for solid build quality and good value at the premium-mid price point compared to pro-brand equivalents. For advanced players seeking diamond power without the premium brand markup.",
  },
  {
    id: "black-crown-hack-2026",
    brand: "Black Crown",
    model: "Hack Control (2026)",
    shapeId: "round",
    coreId: "eva-medium",
    faceId: "carbon-3k",
    frameId: "hybrid-frame",
    surfaceId: "rough",
    weightG: 362,
    balanceCm: 25.3,
    thicknessMm: 38,
    level: "intermediate",
    priceTier: "mid",
    sourceConfidence: "approximate",
    note: "Black Crown's control round for intermediate-advanced players. Medium EVA, 3K carbon face, hybrid frame. One of the more popular Black Crown options at club level — forgiving sweet spot, accessible balance, good feel for players developing consistency from the back court.",
  },
  // ---- Varlion -----------------------------------------------------------
  {
    id: "varlion-summum-carbon-2026",
    brand: "Varlion",
    model: "Summum Carbon (2026)",
    shapeId: "teardrop",
    coreId: "eva-medium",
    faceId: "carbon-18k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 368,
    balanceCm: 26.0,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Varlion's flagship teardrop — Spanish brand known for temperature-adapted layups and high-grade construction. 18K carbon face for responsive feel, medium EVA, carbon frame. Positioned as a precision all-court racket for advanced players who want pro-level feel and durability without mainstream brand pricing.",
  },
  {
    id: "varlion-bourne-cube-2026",
    brand: "Varlion",
    model: "Bourne Cube ElbowCare (2026)",
    shapeId: "diamond",
    coreId: "eva-medium",
    faceId: "carbon-12k",
    frameId: "hybrid-frame",
    surfaceId: "rough",
    weightG: 365,
    balanceCm: 26.3,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "approximate",
    note: "Varlion's premium attacking diamond with ElbowCare technology — vibration damping integrated into the frame to reduce arm impact despite the diamond's high balance. A practical answer to the common problem of wanting diamond power with arm protection. Hybrid frame absorbs vibration that a full carbon equivalent would transmit. Recommended by multiple sources for advanced players with shoulder or elbow sensitivity.",
  },
  // ---- Nox AT10 Pro Cup line ---------------------------------------------
  {
    id: "nox-at10-pro-cup-soft-2026",
    brand: "Nox",
    model: "AT10 Pro Cup Soft (2026)",
    shapeId: "teardrop",
    coreId: "eva-soft",
    faceId: "carbon-12k",
    frameId: "carbon-frame",
    surfaceId: "rough",
    weightG: 365,
    balanceCm: 25.8,
    thicknessMm: 38,
    level: "advanced",
    priceTier: "premium",
    sourceConfidence: "high",
    note: "Advanced-level soft-feeling teardrop in the AT10 range — same mold as the AT10 Genius line but with a softer EVA core for players who want the Tapia-range frame character with more comfort and less arm strain. Precision, spin and feel over raw power. For advanced players who spend long sessions and prioritize touch and consistency over maximum smash output.",
  },
];


// ---------------------------------------------------------------------------
// PRODUCT MATCHING — scores each market racquet against a target spec
// (either the Smart Finder's recommendation or the current Build tab
// configuration) using simple, transparent weighted-distance scoring.
// Categorical fields (shape, core, face, frame, surface) score as exact
// match / partial match / no match; numeric fields (weight, balance) score
// by normalized distance. No racquet receives special weighting — every
// entry, including this app's own brand if one is ever added, is scored
// identically by this function.
// ---------------------------------------------------------------------------

const CORE_HARDNESS_RANK = { "eva-soft": 1, "foam-pe": 1, "hybrid-core": 2, "eva-medium": 2, "eva-hard": 3, "two-piece-cassette-core": 2 };
const FACE_STIFFNESS_RANK = { fiberglass: 1, "basalt-face": 1, "carbon-12k": 2, "carbon-18k": 2, "carbon-3k": 3, "carbon-ud": 3, graphene: 3, "kevlar-reinforced": 3 };

function matchRacquets(targetSpec, options: { limit?: number; budgetTier?: string } = {}) {
  const { limit = 5, budgetTier } = options;

  // Pre-filter by budget tier if specified
  const candidates = budgetTier && budgetTier !== "any"
    ? MARKET_RACQUETS.filter(r => {
        if (budgetTier === "budget") return r.priceTier === "budget";
        if (budgetTier === "mid") return r.priceTier === "budget" || r.priceTier === "mid";
        if (budgetTier === "premium") return true; // premium players see everything
        return true;
      })
    : MARKET_RACQUETS;

  const scored = candidates.map((r) => {
    let score = 0;
    let maxScore = 0;
    const reasons = [];

    // Shape: exact match weighted heaviest.
    maxScore += 30;
    if (r.shapeId === targetSpec.shapeId) {
      score += 30;
      reasons.push(`${r.shapeId} shape matches your recommended shape exactly`);
    } else if (
      (r.shapeId === "teardrop" && targetSpec.shapeId !== undefined) ||
      (targetSpec.shapeId === "teardrop" && r.shapeId !== undefined)
    ) {
      score += 15;
      reasons.push(`${r.shapeId} shape is a reasonable middle ground versus the recommended ${targetSpec.shapeId}`);
    } else if (r.shapeId === "diamond-wide" && targetSpec.shapeId === "diamond") {
      score += 20; // wide-body diamond is a close match for diamond
      reasons.push(`wide-body diamond closely matches the recommended diamond shape`);
    }

    // Core hardness tier: rank-distance scoring.
    maxScore += 20;
    const targetCoreRank = CORE_HARDNESS_RANK[targetSpec.coreId] ?? 2;
    const racquetCoreRank = CORE_HARDNESS_RANK[r.coreId] ?? 2;
    const coreDist = Math.abs(targetCoreRank - racquetCoreRank);
    if (coreDist === 0) {
      score += 20;
      reasons.push("core hardness tier matches");
    } else if (coreDist === 1) {
      score += 10;
    }

    // Face stiffness tier: rank-distance scoring.
    maxScore += 15;
    const targetFaceRank = FACE_STIFFNESS_RANK[targetSpec.faceId] ?? 2;
    const racquetFaceRank = FACE_STIFFNESS_RANK[r.faceId] ?? 2;
    const faceDist = Math.abs(targetFaceRank - racquetFaceRank);
    if (faceDist === 0) {
      score += 15;
      reasons.push("face stiffness tier matches");
    } else if (faceDist === 1) {
      score += 7;
    }

    // Surface texture: exact match = 10, adjacent textured match = 6.
    // rough and 3d-print are both textured — giving 0 for rough vs
    // 3d-print was wrong. smooth vs rough is a real felt difference.
    maxScore += 10;
    if (r.surfaceId === targetSpec.surfaceId) {
      score += 10;
      reasons.push("surface texture matches");
    } else if (
      (r.surfaceId === "rough" && (targetSpec.surfaceId === "3d-print" || targetSpec.surfaceId === "xl-honeycomb")) ||
      (targetSpec.surfaceId === "rough" && (r.surfaceId === "3d-print" || r.surfaceId === "xl-honeycomb"))
    ) {
      score += 6; // both textured, just different texture format
    }

    // Weight: normalized distance within 350-380g range.
    maxScore += 15;
    if (targetSpec.weightG !== undefined) {
      const weightDist = Math.abs(r.weightG - targetSpec.weightG);
      const weightScore = Math.max(0, 15 - (weightDist / 30) * 15);
      score += weightScore;
      if (weightDist <= 5) reasons.push(`weight (${r.weightG}g) closely matches your target`);
    }

    // Balance: normalized distance within 24-27cm range.
    maxScore += 10;
    if (targetSpec.balanceCm !== undefined) {
      const balanceDist = Math.abs(r.balanceCm - targetSpec.balanceCm);
      const balanceScore = Math.max(0, 10 - (balanceDist / 3) * 10);
      score += balanceScore;
      if (balanceDist <= 0.3) reasons.push(`balance point (${r.balanceCm}cm) closely matches your target`);
    }

    const pct = Math.round((score / maxScore) * 100);
    return { racquet: r, matchPct: pct, reasons };
  });

  return scored.sort((a, b) => b.matchPct - a.matchPct).slice(0, limit);
}

function recommendSpec(answers) {
  const {
    level,
    // Section 1 — background
    racquetBackground, frequency,
    // Section 2 — body & physical history
    handSize, injuryHistory, availablePower,
    // Section 3 — play style & goals
    netInstinct, goal, spinInterest,
    // Section 4 — feel fork
    feelPreference,
    // Section 5 — constraints
    sessionLength, budgetTier,
    // Advanced-only (Section A-D)
    courtPosition, pointStyle, biggestWeapon,
    hasModifications, modPlacement, feelSensitivity, techFeel,
    armCare,
  } = answers;

  // --- Baseline from level ---
  let shapeId = "teardrop", coreId = "eva-medium", faceId = "carbon-12k",
    frameId = "hybrid-frame", surfaceId = "rough", gripId = "pu-grip",
    gripShapeId = "octagonal";
  let weightG = 365, balanceCm = 25.8, gripCircMm = 38;

  if (level === "beginner") {
    shapeId = "round"; coreId = "eva-soft"; faceId = "fiberglass";
    frameId = "fiberglass-frame"; gripId = "eva-grip"; weightG = 358; balanceCm = 25.2;
  } else if (level === "advanced") {
    coreId = "eva-hard"; faceId = "carbon-3k"; frameId = "carbon-frame"; weightG = 372;
  }

  // --- Derive style from goal + netInstinct (replaces the dead 'style' field) ---
  // These two questions together cover the same ground that 'style' was meant to.
  const derivedStyle =
    (goal === "power" || (goal === "versatility" && netInstinct === "winner")) ? "power" :
    (goal === "consistency" || (goal === "defense" && netInstinct === "block")) ? "control" :
    "allround";

  if (derivedStyle === "power") {
    shapeId = level === "beginner" ? "teardrop" : "diamond";
    coreId = level === "beginner" ? "eva-medium" : "eva-hard";
    faceId = level === "beginner" ? "carbon-12k" : "carbon-3k";
    balanceCm = Math.max(balanceCm, 26.6);
  } else if (derivedStyle === "control") {
    shapeId = "round";
    faceId = level === "advanced" ? "carbon-18k" : "fiberglass";
    coreId = "eva-soft";
    balanceCm = Math.min(balanceCm, 25.2);
  }
  // allround: keep level defaults (teardrop/12k/medium) — already set above

  // --- Arm care — proactive preference, not just injury-reactive ---
  // armCare captures players who proactively prioritize arm comfort even
  // without an active injury (e.g. Varlion ElbowCare or Royal Padel players).
  // This is distinct from injuryHistory which handles reactive/diagnosed cases.
  const needsArmCare = injuryHistory === "ongoing" || injuryHistory === "mild" || armCare === "priority";
  if (injuryHistory === "ongoing" || armCare === "priority") {
    coreId = level === "beginner" ? "eva-soft" : "eva-soft";
    frameId = frameId === "carbon-frame" ? "hybrid-frame" : frameId;
    gripId = "anti-shock-grip";
    weightG = Math.min(weightG, armCare === "priority" ? 365 : 358);
    balanceCm = Math.min(balanceCm, armCare === "priority" ? 25.6 : 25.2);
    if (shapeId === "diamond") shapeId = "teardrop";
  } else if (injuryHistory === "mild") {
    gripId = gripId === "pu-grip" ? "eva-grip" : gripId;
    weightG = Math.min(weightG, 365);
  }

  // --- Section 1: racquet-sport background ---
  if (racquetBackground === "tennis" && shapeId === "diamond") {
    shapeId = "teardrop";
  }
  if (racquetBackground === "squash" && shapeId === "round" && derivedStyle !== "control") {
    shapeId = "teardrop";
  }

  // --- Frequency ---
  if (frequency === "multiple-weekly") {
    weightG = Math.min(weightG, 368);
    if (gripId === "pu-grip") gripId = "eva-grip";
  }

  // --- Section 2: body & physical history ---
  if (handSize === "small") gripCircMm = 36;
  else if (handSize === "large") gripCircMm = 40;
  else gripCircMm = 38;

  if (availablePower === "limited") {
    balanceCm = Math.max(balanceCm, 26.0);
    if (shapeId === "round" && derivedStyle !== "control") shapeId = "teardrop";
  } else if (availablePower === "powerful") {
    balanceCm = Math.min(balanceCm, 25.8);
  }

  // --- Section 3: play style & goals ---
  if (netInstinct === "block") {
    shapeId = shapeId === "diamond" ? "teardrop" : shapeId;
  } else if (netInstinct === "winner") {
    balanceCm = Math.max(balanceCm, 26.3);
  }

  if (goal === "defense") {
    shapeId = shapeId === "diamond" ? "teardrop" : shapeId;
    balanceCm = Math.min(balanceCm, 25.4);
  } else if (goal === "versatility") {
    shapeId = "teardrop";
  }

  if (spinInterest === "high") {
    surfaceId = "3d-print";
  } else if (spinInterest === "some" && surfaceId === "smooth") {
    surfaceId = "rough";
  }

  // --- Section 4: feel fork ---
  if (feelPreference === "smooth") {
    surfaceId = surfaceId === "3d-print" ? "rough" : "smooth";
  } else if (feelPreference === "grippy") {
    surfaceId = surfaceId === "smooth" ? "rough" : surfaceId;
  }

  // --- Section 5: constraints ---
  if (sessionLength === "long") {
    gripId = gripId === "pu-grip" ? "eva-grip" : gripId;
    weightG = Math.min(weightG, 366);
  }

  // --- Budget tier — filter matches by priceTier in matchRacquets ---
  // budgetTier is used by matchRacquets, not here — stored in answers object.

  // --- Advanced-only sections ---
  if (level === "advanced") {
    if (courtPosition === "drive") {
      shapeId = shapeId === "diamond" ? "teardrop" : shapeId;
    } else if (courtPosition === "reves") {
      balanceCm = Math.max(balanceCm, 26.2);
    }

    if (pointStyle === "finisher") {
      balanceCm = Math.max(balanceCm, 26.5);
    } else if (pointStyle === "builder") {
      shapeId = shapeId === "diamond" ? "teardrop" : shapeId;
    }

    if (biggestWeapon === "smash") {
      shapeId = "diamond"; balanceCm = Math.max(balanceCm, 26.6);
    } else if (biggestWeapon === "bandeja") {
      shapeId = "teardrop";
    } else if (biggestWeapon === "lob") {
      shapeId = shapeId === "diamond" ? "teardrop" : shapeId;
      balanceCm = Math.min(balanceCm, 25.6);
    } else if (biggestWeapon === "volley") {
      shapeId = "round";
    } else if (biggestWeapon === "depth") {
      shapeId = "round"; balanceCm = Math.min(balanceCm, 25.4);
    }

    if (hasModifications === "added-weight") {
      if (modPlacement === "head") balanceCm = Math.max(balanceCm, 26.5);
      else if (modPlacement === "handle") {
        weightG = Math.max(weightG, 370);
        balanceCm = Math.min(balanceCm, 25.4);
      }
    }

    if (techFeel === "core") {
      coreId = "eva-soft";
      if (surfaceId === "3d-print") surfaceId = "rough";
    } else if (techFeel === "frame") {
      frameId = "carbon-frame";
    } else if (techFeel === "grip") {
      gripId = "anti-shock-grip";
    }
  }

  return { shapeId, coreId, faceId, frameId, surfaceId, gripId, gripShapeId, weightG, balanceCm, gripCircMm };
}

// ---------------------------------------------------------------------------
// FACTORY BRIEF ENGINE — a genuinely different recommendation engine from
// recommendSpec() above, built for a different user and a different kind
// of input. recommendSpec() answers "what racquet fits THIS PLAYER" from
// feel/preference/body questions. This answers "what racquet should WE
// BUILD" from a product brief: positioning, named competitive reference
// racquets (with which of their qualities to draw from), a single forced
// priority, and real-world constraints (material commitments, cost tier,
// durability expectation for that tier).
//
// Durability is deliberately NOT its own dedicated priority option — per
// the actual design conversation this was built from, a real factory
// doesn't pick "durability" as a competing goal alongside control/power/
// comfort; durability is a constraint that has to hold underneath
// whatever priority is chosen. So it's handled here as an ENGINEERING
// CHOICE layered on top of the priority's baseline spec, not a value
// that competes with control/power/comfort for the same dial. The real,
// sourced engineering pattern this follows: durability is best achieved
// at the FRAME and BRIDGE level (hybrid frame construction, closed/
// torsion-resistant bridge geometry) rather than by hardening the core
// or face — hardening those changes playability, which is exactly what
// should stay correct for the target level regardless of durability
// expectations.
// ---------------------------------------------------------------------------

interface FactoryReference {
  racquetId: string; // MARKET_RACQUETS id
  draws: string[]; // which qualities to draw from this reference: "sweetSpot" | "comfort" | "power" | "control" | "balanceFeel"
  avoid: string[]; // qualities to deliberately differentiate AWAY from — same quality keys as draws, but pushes the opposite direction instead of blending toward it
}

interface FactoryBriefInput {
  level: "beginner" | "intermediate" | "advanced";
  priceTier: "budget" | "mid" | "premium";
  targetRetailPrice?: number; // a real number when known — refines the priceTier-only logic rather than replacing it, since priceTier still drives the coarse material gating
  needGap: string; // free text, not used in spec logic — carried through to the rationale for context
  whatToFix?: string; // for existing-mold briefs: what specifically needs to change from the current shell's spec
  existingMoldRacquetId?: string; // for existing-mold briefs: the specific market racquet whose shell is being used
  explicitShape?: string; // when provided, this becomes a HARD CONSTRAINT — the engine must achieve priority goals WITHIN this shape, not by changing it. This is the key architectural shift: "control on a diamond" is a valid design brief, not a contradiction.
  explicitBridge?: string; // "open" or "closed" — when provided, locked as a hard constraint. Bridge architecture is a real independent design decision, not a durability output.
  explicitBeamOrientation?: string; // "vertical" | "horizontal" | "diagonal" — when provided, locked. Only meaningful if bridge is open.
  explicitSurface?: string; // "smooth" | "rough" | "3d-print" — when provided, locked. Surface texture affects spin ceiling and feel, should be a design choice not an assumption.
  references: FactoryReference[];
  priority: "control" | "power" | "comfort" | "balanced";
  materialCommitment?: string; // e.g. a coreId/faceId/frameId already locked in
  durabilityExpectation: "standard" | "extended"; // "extended" = the premium-tier "don't go cheap" case this was built for
  tooling: "new-mold" | "existing-mold"; // existing-mold locks shape + dimensions to what's already tooled; new-mold leaves shape open but the rationale flags the real cost/MOQ implication
  existingShapeId?: string; // required when tooling === "existing-mold" — the shape the current tooling produces
  targetVolume: "custom" | "retail"; // custom: spec locked to a specific recipient (pro player, team, academy) — retail: open inventory that needs to make margin at the price point
}

interface FactoryBriefAlternative {
  trackId: "material-first" | "structural-innovation" | "damping-chain";
  trackLabel: string;
  philosophy: string; // one-sentence design philosophy summary
  spec: FactoryBriefResult["spec"];
  rationale: string[];
  oem: number;
  retailRange: [number, number];
}

interface FactoryBriefResult {
  spec: {
    shapeId: string; coreId: string; faceId: string; frameId: string;
    surfaceId: string; gripId: string; gripShapeId: string; bridgeId: string;
    beamOrientation: string; weightG: number; balanceCm: number; gripCircMm: number;
  };
  rationale: string[]; // one line per major decision, referencing the actual inputs that drove it
  alternatives: FactoryBriefAlternative[]; // two additional genuinely-different design philosophies for the same brief
}

function computeFactoryBrief(input: FactoryBriefInput): FactoryBriefResult {
  const { level, priceTier, targetRetailPrice, needGap, references, priority, materialCommitment,
          durabilityExpectation, tooling, existingShapeId, existingMoldRacquetId, whatToFix,
          targetVolume, explicitShape, explicitBridge, explicitBeamOrientation, explicitSurface } = input;
  const rationale: string[] = [];

  // Parse needGap for shape keywords — "high sweet spot", "viper", "diamond",
  // "smash", "overhead" all signal diamond intent even when shape isn't locked
  const gapLower = (needGap ?? "").toLowerCase();
  const gapSignalsDiamond = gapLower.includes("diamond") || gapLower.includes("viper") || gapLower.includes("high sweet spot") || gapLower.includes("smash") || gapLower.includes("overhead") || gapLower.includes("metalbone");
  const gapSignalsRound = gapLower.includes("round") || gapLower.includes("beginner") || gapLower.includes("forgiving") || gapLower.includes("large sweet spot");
  const gapSignalsControl = gapLower.includes("control") || gapLower.includes("touch") || gapLower.includes("precision") || gapLower.includes("feel");


  // -------------------------------------------------------------------------
  // STEP 1 — LOCK ALL HARD CONSTRAINTS FIRST
  //
  // This is the architectural shift from the previous version. The old engine
  // set a level-based baseline and then made categorical decisions ("control →
  // round") regardless of what was explicitly requested. This version
  // identifies every variable that is LOCKED by an explicit input, and only
  // optimizes the unlocked variables — so "diamond + control" is a valid brief
  // where the engine finds the best achievable control within a diamond, not
  // an error that gets silently corrected to round.
  // -------------------------------------------------------------------------

  // Shape: explicit selection beats everything except existing-mold tooling
  let shapeId: string;
  let shapeLocked = false;
  let shapeLockedReason = "";

  if (tooling === "existing-mold" && existingShapeId) {
    shapeId = existingShapeId;
    shapeLocked = true;
    shapeLockedReason = "existing-mold tooling";
  } else if (explicitShape) {
    shapeId = explicitShape;
    shapeLocked = true;
    shapeLockedReason = "explicit brief selection";
  } else {
    // Level default — only used when neither tooling nor explicit selection locked it
    shapeId = level === "beginner" ? "round" : level === "advanced" ? "diamond" : "teardrop";
  }

  // Production reality flags (evaluated early since they affect material realism)
  if (tooling === "existing-mold" && existingShapeId) {
    const moldRacquet = existingMoldRacquetId ? MARKET_RACQUETS.find(r => r.id === existingMoldRacquetId) : null;
    const moldLabel = moldRacquet ? `${moldRacquet.brand} ${moldRacquet.model}` : existingShapeId;
    rationale.push(`Production: existing mold — shell is ${moldLabel}. Shape (${shapeId}), width, and thickness locked. Materials, core, bridge, and surface can all change within this shell.${moldRacquet ? ` Starting from: ${moldRacquet.coreId} core, ${moldRacquet.faceId} face, ${moldRacquet.frameId} frame.` : ""}${whatToFix ? ` Improvement intent: "${whatToFix}"` : ""}`);
  } else if (tooling === "new-mold") {
    rationale.push(`Production: new mold — shape is open, but flag this as a real tooling/MOQ cost the price tier and volume need to absorb.`);
  }

  if (explicitShape && tooling !== "existing-mold") {
    rationale.push(`Shape locked to ${shapeId} per explicit brief selection — the engine will achieve the ${priority} priority goals WITHIN this shape through material, balance, and construction choices, not by changing it.`);
  }

  if (targetVolume === "custom") {
    rationale.push(`Production: custom/bespoke run — spec is locked to a specific recipient (pro player, team, academy, signature edition). Higher per-unit cost is acceptable; recipient absorbs it. More flexibility on premium materials since you're not building open inventory that needs to move at a retail price point.`);
  } else if (targetVolume === "retail") {
    rationale.push(`Production: retail distribution — building open inventory that needs to make margin at the selected price point. Material choices below should be ones that can be replicated consistently at production quantities.`);
  }

  // targetRetailPrice is validated against finalized materials at the end of the engine (Step 7)

  // -------------------------------------------------------------------------
  // STEP 2 — SET LEVEL-APPROPRIATE MATERIAL STARTING POINTS
  // These are defaults only — priority logic below will adjust them, but only
  // within what's physically appropriate for the level. A beginner brief
  // asking for "power" doesn't get graphene; it gets the most power-oriented
  // configuration that still makes sense for a beginner player.
  // -------------------------------------------------------------------------

  let coreId = level === "beginner" ? "eva-soft" : level === "advanced" ? "eva-hard" : "eva-medium";
  let faceId = level === "beginner" ? "fiberglass" : level === "advanced" ? "carbon-3k" : "carbon-12k";
  let frameId = level === "beginner" ? "fiberglass-frame" : level === "advanced" ? "carbon-frame" : "hybrid-frame";
  let surfaceId = "rough";
  let gripId = "pu-grip";
  let gripShapeId = "octagonal";
  let bridgeId: string = "open";
  let beamOrientation = "vertical";

  // Bridge and beam orientation are independent design decisions, not
  // durability outputs. Lock them now if explicitly set so the
  // durability step below cannot override them.
  let bridgeLocked = false;
  let beamLocked = false;
  let surfaceLocked = false;
  if (explicitBridge) {
    bridgeId = explicitBridge;
    bridgeLocked = true;
    rationale.push(`Bridge locked to ${explicitBridge} per explicit brief selection — durability logic below will not override this.`);
  }
  if (explicitBeamOrientation && bridgeId === "open") {
    beamOrientation = explicitBeamOrientation;
    beamLocked = true;
    rationale.push(`Beam orientation locked to ${explicitBeamOrientation} per explicit brief selection.`);
  }
  if (explicitSurface) {
    surfaceId = explicitSurface;
    surfaceLocked = true;
    rationale.push(`Surface locked to ${explicitSurface} per explicit brief selection — priority logic below will not override this.`);
  }
  let weightG = level === "beginner" ? 356 : level === "advanced" ? 372 : 365;
  let balanceCm = level === "beginner" ? 25.0 : level === "advanced" ? 26.4 : 25.8;
  let gripCircMm = 38;

  rationale.push(`Level baseline: ${level} tier starting materials (${coreId} core, ${faceId} face, ${frameId} frame) — these are the unlocked-variable starting points that priority logic below will optimize, not fixed outcomes.`);

  // -------------------------------------------------------------------------
  // STEP 2.5 — INFER SHAPE FROM REFERENCES (before priority runs)
  //
  // When shape is NOT explicitly locked and the user has selected competitive
  // references, the shape of those references is a strong signal about what
  // they're actually designing toward — especially when "sweet spot" or
  // "balance feel" is tagged, since those qualities are fundamentally tied
  // to the reference racquet's geometry.
  //
  // Rule: if the majority of selected references share a shape, and at least
  // one of them has "sweetSpot" or "balanceFeel" in their draws (meaning the
  // user specifically wants those geometry-dependent qualities), infer that
  // shape before the priority step runs. This means "control priority + Viper
  // reference with sweetSpot draw" correctly produces a control-oriented
  // diamond, not a round, because the engine sees the intent first.
  // -------------------------------------------------------------------------
  if (!shapeLocked && references.length > 0) {
    const shapeCounts: Record<string, number> = {};
    const geometryDraws = ["sweetSpot", "balanceFeel"];
    let hasGeometryDraw = false;
    references.forEach(ref => {
      const racquet = MARKET_RACQUETS.find(r => r.id === ref.racquetId);
      if (!racquet) return;
      shapeCounts[racquet.shapeId] = (shapeCounts[racquet.shapeId] ?? 0) + 1;
      if (ref.draws.some(d => geometryDraws.includes(d))) hasGeometryDraw = true;
    });
    const dominantShape = Object.entries(shapeCounts).sort((a, b) => b[1] - a[1])[0];
    // Two independent signals that can confirm shape:
    // 1. Majority of references share a shape AND geometry-sensitive qualities were drawn
    // 2. The need-gap text explicitly names the shape or a racquet known for that shape
    const referenceSignal = dominantShape && hasGeometryDraw && dominantShape[1] >= Math.ceil(references.length / 2);
    const gapReinforcesReference = dominantShape && (
      (dominantShape[0] === "diamond" && gapSignalsDiamond) ||
      (dominantShape[0] === "round" && gapSignalsRound)
    );
    if (referenceSignal || (dominantShape && gapReinforcesReference)) {
      shapeId = dominantShape[0];
      shapeLocked = true;
      shapeLockedReason = "inferred from competitive references";
      const signals = [referenceSignal ? `${dominantShape[1]}/${references.length} references are ${shapeId}` : "", gapReinforcesReference ? `need-gap text also signals ${shapeId}` : ""].filter(Boolean).join(", ");
      rationale.push(`Shape inferred from references: ${signals}. Setting shape to ${shapeId} before priority optimization — the engine will achieve your ${priority} goals WITHIN this shape rather than picking shape independently. To override, use the explicit shape selector.`);
    }
  }

  // Fallback: gap text alone (no references) can also signal shape
  if (!shapeLocked && gapSignalsDiamond && !gapSignalsRound) {
    shapeId = "diamond";
    shapeLocked = true;
    shapeLockedReason = "inferred from need-gap text";
    rationale.push(`Shape inferred from brief description: need-gap text signals a diamond-character racquet. Setting shape to diamond — the engine will achieve your ${priority} goals within this shape. Use the explicit shape selector to override.`);
  }

  // -------------------------------------------------------------------------
  // STEP 3 — PHYSICS-FIRST PRIORITY OPTIMIZATION
  //
  // Every playability goal has multiple independent physical levers that work
  // on ANY shape. The full material data model is now used — hybrid-core,
  // graphene, basalt-frame, foam-pe, and 3d-print surface are all reachable
  // from the engine, not just the basic EVA/carbon/fiberglass defaults.
  // -------------------------------------------------------------------------

  if (priority === "control") {
    if (!shapeLocked) {
      shapeId = "round";
      rationale.push(`Priority: control. Shape defaulted to round — round's central mass distribution naturally centers the sweet spot without any further tuning.`);
    } else {
      const shapeNote = shapeId === "diamond"
        ? `Becomes a control-oriented diamond through the levers below — the Nox AT10 Genius approach: diamond frame, control materials. Balance brought well down; soft core and flexible face do the rest.`
        : shapeId === "teardrop"
        ? `Teardrop tuned fully toward control side through materials and balance.`
        : `Round already favors control; materials push it further.`;
      rationale.push(`Priority: control within locked ${shapeId}. ${shapeNote}`);
    }
    balanceCm = shapeId === "diamond" ? Math.max(24.5, balanceCm - 1.4) : Math.max(24.0, balanceCm - 0.6);
    coreId = level === "advanced" ? "hybrid-core" : "eva-soft";
    // Face: 18K for per-panel flex — not gated by level for control, since
    // an intermediate control player benefits as much as an advanced one
    faceId = level === "beginner" ? "fiberglass" : "carbon-18k";
    // Frame: basalt for advanced control; hybrid for others (better damping than fiberglass-only)
    frameId = level === "advanced" ? "basalt-frame" : "hybrid-frame";
    if (!surfaceLocked) surfaceId = "smooth";
    rationale.push(`Control levers: balance to ${balanceCm.toFixed(1)}cm${shapeId === "diamond" ? " (primary taming lever for diamond)" : ""}; core ${coreId}; face ${faceId} (18K flat-weave per-panel flex); frame ${frameId}${!surfaceLocked ? "; surface smooth" : ""}.`);

  } else if (priority === "power") {
    if (!shapeLocked) {
      shapeId = level === "beginner" ? "teardrop" : "diamond";
      rationale.push(`Priority: power. Shape set to ${shapeId} — ${level === "beginner" ? "teardrop at beginner level; diamond's small sweet spot costs more in consistency than it gains" : "diamond maximizes swing inertia for smash leverage"}.`);
    } else {
      rationale.push(`Priority: power within locked ${shapeId}. ${shapeId !== "diamond" ? `Maximum power config for ${shapeId}. Diamond would extract more but shape is locked.` : "Diamond already maximizes geometry; materials extract the rest."}`);
    }
    balanceCm = Math.min(27.0, balanceCm + 0.8);
    // Core: hard EVA for advanced/intermediate power; medium for beginners
    // (pure hard EVA on a beginner build trades too much comfort for a
    // player whose swing mechanics don't fully exploit it yet)
    coreId = level === "beginner" ? "eva-medium" : "eva-hard";
    // Face: graphene at premium regardless of level — a premium beginner
    // racquet with graphene face is a real product category, not impossible
    faceId = priceTier === "premium" ? "graphene"
           : level === "advanced" ? "carbon-3k"
           : "carbon-12k";
    // Frame: carbon for advanced power; hybrid for beginner/intermediate
    // (full carbon on a beginner power build transmits too much shock for
    // a player who makes frequent off-center contact)
    frameId = level === "advanced" ? "carbon-frame" : "hybrid-frame";
    if (!surfaceLocked) surfaceId = priceTier === "premium" ? "3d-print" : "rough";
    rationale.push(`Power levers: balance to ${balanceCm.toFixed(1)}cm; core ${coreId}; face ${faceId}${faceId === "graphene" ? " (graphene — premium face, now gated only by price tier not level)" : ""}; frame ${frameId}${!surfaceLocked ? `; surface ${surfaceId}` : ""}.`);

  } else if (priority === "comfort") {
    if (!shapeLocked) {
      rationale.push(`Priority: comfort. Shape kept at ${shapeId} — comfort lives in the damping chain, not the shape.`);
    } else {
      rationale.push(`Priority: comfort within locked ${shapeId}. Comfort is shape-independent — achievable within any frame geometry through the damping chain.`);
    }
    coreId = level === "beginner" ? "foam-pe" : "eva-soft";
    gripId = "anti-shock-grip";
    // Grip shape: round handle for comfort — reduces grip tension and
    // forearm fatigue. Previously this never changed. Now it does.
    gripShapeId = "grip-round";
    if (!surfaceLocked) surfaceId = "smooth";
    // Frame: honeycomb-reinforced is the right comfort frame — structural
    // damping independent of face stiffness. Previously comfort only went
    // to hybrid-frame (a step down from carbon, but not an innovation).
    // Honeycomb is the genuinely different, comfort-optimized choice.
    frameId = priceTier === "premium" ? "honeycomb-reinforced-frame" : frameId === "carbon-frame" ? "hybrid-frame" : frameId;
    rationale.push(`Comfort levers: core ${coreId}; anti-shock grip; round handle cross-section (reduces grip tension fatigue — standard in tennis, rare in padel); surface smooth; frame ${frameId}${frameId === "honeycomb-reinforced-frame" ? " (structural damping from honeycomb internal geometry — premium comfort engineering, not just material softness)" : " (vibration-absorbing over full carbon)"}.`);

  } else {
    if (!shapeLocked) {
      rationale.push(`Priority: balanced all-rounder. Shape at ${shapeId} (level default).`);
    } else {
      rationale.push(`Priority: balanced all-rounder within locked ${shapeId}.`);
    }
    coreId = "hybrid-core";
    // Face: balanced doesn't mean "freeze at level default" — 12K is
    // genuinely the right mid-point face, but at premium tier, 18K gives
    // slightly more per-panel nuance without sacrificing power ceiling
    faceId = priceTier === "premium" ? "carbon-18k" : "carbon-12k";
    if (shapeId === "diamond") balanceCm = Math.max(25.5, balanceCm - 0.5);
    rationale.push(`Balanced config: hybrid-core (soft throat / firmer tip); face ${faceId}; balance at ${balanceCm.toFixed(1)}cm.`);
  }

  // Weight adjustment for innovative frame types — hollow tubular and
  // honeycomb-reinforced frames weigh meaningfully less than solid foam-fill
  // frames at the same geometry. Previously weight was frozen at a level
  // lookup regardless of what frame the engine chose. Now it adjusts.
  if (frameId === "hollow-tubular-frame") {
    weightG = Math.max(330, weightG - 15);
    rationale.push(`Weight adjusted: hollow tubular frame is meaningfully lighter than solid foam-fill construction (same relationship as tennis — hollow tubes weigh less per unit stiffness). Adjusted to ${weightG}g.`);
  } else if (frameId === "honeycomb-reinforced-frame") {
    weightG = Math.max(340, weightG - 8);
    rationale.push(`Weight adjusted: honeycomb-reinforced frame saves ~8g over a solid carbon equivalent at the same structural rigidity. Adjusted to ${weightG}g.`);
  } else if (frameId === "auxetic-frame") {
    weightG = Math.max(345, weightG - 5);
    rationale.push(`Weight adjusted: auxetic fiber geometry allows slightly lighter construction than standard carbon woven at comparable stiffness. Adjusted to ${weightG}g.`);
  } else if (frameId === "two-piece-clamshell-frame") {
    weightG = Math.max(332, weightG - 13);
    rationale.push(`Weight adjusted: two-piece clamshell is a hollow tube construction — carbon walls carry structural load, foam is a captured insert rather than a full solid fill. Similar weight savings to a one-piece hollow tube (~13g lighter than solid foam-fill). Adjusted to ${weightG}g.`);
  }


  // -------------------------------------------------------------------------
  // STEP 4 — DURABILITY ENGINEERING (frame/bridge layer, doesn't touch
  // the priority-driven playability choices above)
  // -------------------------------------------------------------------------

  if (durabilityExpectation === "extended") {
    if (frameId === "fiberglass-frame") {
      frameId = "hybrid-frame";
      rationale.push(`Durability: frame upgraded from fiberglass to hybrid — real impact resistance gain at the actual failure point (wall/floor contact) without touching core or face, so priority-driven feel is untouched.`);
    } else if (frameId === "carbon-frame" && priceTier !== "budget" && !bridgeLocked) {
      // Only auto-set closed bridge when it wasn't explicitly chosen —
      // this was the bug: any advanced/non-budget/extended-durability
      // brief was guaranteed closed bridge regardless of design intent
      bridgeId = "closed";
      rationale.push(`Durability: bridge set to closed/torsion-resistant — frame-geometry reinforcement against off-center twisting. (No explicit bridge was selected, so durability logic applied this. Select a bridge explicitly in the brief to override.)`);
    } else if (bridgeLocked) {
      rationale.push(`Durability: extended, but bridge is locked to ${bridgeId} per explicit brief selection — no bridge override applied. Durability is covered by the frame material and any beam-orientation choice.`);
    }
    if (bridgeId === "open" && !beamLocked && (priority === "power" || priority === "balanced")) {
      beamOrientation = "diagonal";
      rationale.push(`Durability: open bridge retained, beam set to diagonal (X-brace) for torsional reinforcement.`);
    }
    // The single biggest durability lever available is eliminating the
    // foam-to-carbon co-cure bond that is the primary padel failure mode.
    // The two-piece clamshell frame does exactly this — the carbon shell
    // carries all structural load and the foam is a captured insert. This
    // is noted as guidance, not forced, since it's a significant
    // manufacturing decision the brief author should make deliberately.
    if (priceTier === "premium" && (frameId === "carbon-frame" || frameId === "hollow-tubular-frame")) {
      rationale.push(`Durability note: for maximum frame longevity, consider the two-piece clamshell construction — it eliminates the foam-to-carbon co-cure bond that is the primary failure point in conventional padel racquets. The carbon shell carries all structural load and lasts indefinitely; foam is a replaceable captured insert. This is a manufacturing-architecture decision (higher tooling cost, modular product-line benefits) — select it explicitly in the frame material if the durability and serviceability case fits your product strategy.`);
    }
  } else {
    rationale.push(`Durability: standard — no frame/bridge reinforcement beyond level baseline.`);
  }

  // -------------------------------------------------------------------------
  // STEP 5 — COMPETITIVE REFERENCES (draw/avoid per-quality)
  // -------------------------------------------------------------------------

  references.forEach((ref) => {
    const racquet = MARKET_RACQUETS.find((r) => r.id === ref.racquetId);
    if (!racquet) return;
    const refLabel = `${racquet.brand} ${racquet.model}`;
    ref.draws.forEach((quality) => {
      if (quality === "sweetSpot") {
        if (racquet.shapeId === "round" && shapeId !== "round") {
          rationale.push(`Reference: ${refLabel}'s sweet-spot character noted — shape is locked to ${shapeId}, but centered hole pattern and low balance already serve the same function within this geometry.`);
        } else {
          rationale.push(`Reference: ${refLabel}'s sweet-spot approach noted as a benchmark for hole pattern and balance tuning.`);
        }
      } else if (quality === "comfort") {
        if (gripId !== "anti-shock-grip") { gripId = "anti-shock-grip"; }
        rationale.push(`Reference: drew comfort approach from ${refLabel} — grip set to anti-shock.`);
      } else if (quality === "balanceFeel") {
        const refIsHighBalance = racquet.balanceCm >= 26.0;
        const refIsLowBalance = racquet.balanceCm <= 25.3;
        const conflicts = (refIsHighBalance && (priority === "comfort" || priority === "control")) || (refIsLowBalance && priority === "power");
        const blended = (balanceCm + racquet.balanceCm) / 2;
        if (conflicts) {
          rationale.push(`Reference: ${refLabel}'s balance (${racquet.balanceCm}cm) not blended — conflicts with ${priority} priority direction.`);
        } else {
          balanceCm = blended;
          rationale.push(`Reference: balance blended toward ${refLabel} (${racquet.balanceCm}cm) → ${balanceCm.toFixed(1)}cm.`);
        }
      } else if (quality === "power" || quality === "control") {
        rationale.push(`Reference: ${refLabel} noted as benchmark for ${quality} character — already targeted via priority above.`);
      }
    });
    ref.avoid.forEach((quality) => {
      if (quality === "comfort" && gripId === "anti-shock-grip") {
        gripId = "pu-grip";
        rationale.push(`Reference: differentiating from ${refLabel}'s comfort approach — grip pulled back to standard PU.`);
      } else if (quality === "balanceFeel") {
        const pushAway = balanceCm < racquet.balanceCm ? Math.max(24, balanceCm - 0.3) : Math.min(27, balanceCm + 0.3);
        balanceCm = pushAway;
        rationale.push(`Reference: balance nudged further from ${refLabel} (${racquet.balanceCm}cm) → ${balanceCm.toFixed(1)}cm.`);
      } else {
        rationale.push(`Reference: flagged ${quality} from ${refLabel} as something to differentiate away from.`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // STEP 6 — HARD MATERIAL CONSTRAINTS (always win, applied last)
  // -------------------------------------------------------------------------

  let commitmentSetExpensiveFace = false;
  if (materialCommitment) {
    if (CORE_MATERIALS.some((c) => c.id === materialCommitment)) {
      coreId = materialCommitment;
      rationale.push(`Constraint: core locked to ${materialCommitment} per material commitment — overrides priority-driven core above.`);
    } else if (FACE_MATERIALS.some((f) => f.id === materialCommitment)) {
      faceId = materialCommitment;
      commitmentSetExpensiveFace = materialCommitment === "graphene" || materialCommitment === "kevlar-reinforced";
      rationale.push(`Constraint: face locked to ${materialCommitment} per material commitment.`);
    } else if (FRAME_MATERIALS.some((f) => f.id === materialCommitment)) {
      frameId = materialCommitment;
      rationale.push(`Constraint: frame locked to ${materialCommitment} per material commitment — overrides durability-driven frame if they conflict.`);
    }
  }

  if (priceTier === "budget" && (faceId === "graphene" || faceId === "kevlar-reinforced")) {
    faceId = "carbon-12k";
    if (commitmentSetExpensiveFace) {
      rationale.push(`Constraint conflict: material commitment specified a premium face but budget tier was also selected — budget tier takes priority as the harder real-world constraint. Flag this back to whoever set the commitment.`);
    } else {
      rationale.push(`Constraint: budget tier — face brought back to carbon-12K from a premium-cost material.`);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 7 — REAL COST VALIDATION (runs after all materials are finalized)
  // Now that every material decision has been made, we can compute a real
  // OEM cost estimate and check it against the target retail price. This is
  // the step that was previously missing — targetRetailPrice was just a note.
  // -------------------------------------------------------------------------

  const finalOEMCost = estimateOEMCost({ faceId, coreId, frameId, surfaceId, gripId });
  const [retailLow, retailHigh] = oemToRetailRange(finalOEMCost);

  if (targetRetailPrice) {
    if (targetRetailPrice >= retailLow && targetRetailPrice <= retailHigh) {
      rationale.push(`Cost check ✓: estimated OEM cost ~$${finalOEMCost} for this material combination → realistic retail range $${retailLow}–$${retailHigh} at standard 3.5–5× brand multiplier. Your target of $${targetRetailPrice} sits comfortably inside this range.`);
    } else if (targetRetailPrice > retailHigh) {
      rationale.push(`Cost check: estimated OEM ~$${finalOEMCost} → realistic retail range $${retailLow}–$${retailHigh}. Your target of $${targetRetailPrice} is ABOVE this range — this spec has room to upgrade materials (e.g. graphene face, 3D-print surface, anti-shock grip) and still make the price point, or the margin is exceptional at your brand multiplier. Consider which.`);
    } else {
      rationale.push(`Cost tension ⚠: estimated OEM ~$${finalOEMCost} → realistic retail range $${retailLow}–$${retailHigh}. Your target of $${targetRetailPrice} is BELOW this range. At this spec, the math only closes if you're working at very high volume (lower OEM cost), accepting thin margins, or using a lower multiplier than typical branded padel (3.5–5×). Consider: downgrading face to ${faceId === "graphene" ? "carbon-3k" : faceId === "carbon-18k" ? "carbon-12k" : "fiberglass"} saves ~$${(FACE_OEM_COST_DELTA[faceId] ?? 0) - (FACE_OEM_COST_DELTA[faceId === "graphene" ? "carbon-3k" : faceId === "carbon-18k" ? "carbon-12k" : "fiberglass"] ?? 0)} OEM, bringing estimated retail floor to ~$${Math.round((finalOEMCost - Math.max(0, (FACE_OEM_COST_DELTA[faceId] ?? 0) - 10)) * 3.5)}.`);
    }
  } else {
    // No target price specified — surface the cost estimate anyway so
    // it's not a black box
    rationale.push(`Cost estimate: this material combination runs approximately $${finalOEMCost} OEM → realistic retail range $${retailLow}–$${retailHigh} at standard 3.5–5× brand multiplier. (Set a target retail price in the brief to get specific cost-fit feedback.)`);
  }

  return {
    spec: { shapeId, coreId, faceId, frameId, surfaceId, gripId, gripShapeId, bridgeId,
            beamOrientation, weightG: Math.round(weightG), balanceCm: Math.round(balanceCm * 10) / 10, gripCircMm },
    rationale,
    alternatives: [], // populated by computeFactoryBriefWithAlternatives
  };
}

// ---------------------------------------------------------------------------
// MULTI-SPEC WRAPPER — generates three genuinely different design approaches
// for the same brief, each representing a distinct engineering philosophy
// rather than a slight variation of the same approach.
// ---------------------------------------------------------------------------

function computeFactoryBriefWithAlternatives(input: FactoryBriefInput): FactoryBriefResult {
  const primary = computeFactoryBrief(input);

  type TrackOverride = {
    trackLabel: string;
    philosophy: string;
    overrides: Partial<FactoryBriefResult["spec"]>;
    extraRationale: string;
  };

  const TRACK_OVERRIDES: Record<string, Record<string, TrackOverride>> = {
    control: {
      "material-first": {
        trackLabel: "Material-first",
        philosophy: "Tune every material variable toward dwell time — hybrid-core's two-zone density, 18K face per-panel flex, basalt frame for vibration character distinct from carbon.",
        overrides: { coreId: "hybrid-core", faceId: "carbon-18k", frameId: "basalt-frame" },
        extraRationale: "Material-first track: every material independently maximized for dwell. Hybrid-core soft throat zone for touch, 18K flat-weave for per-panel flex, basalt frame for thermal stability.",
      },
      "structural-innovation": {
        trackLabel: "Structural Innovation",
        philosophy: "Control through structural precision — hollow tubular frame (tennis-derived load distribution, essentially absent from padel), minimal holes for more continuous and consistent face feedback.",
        overrides: { coreId: "eva-medium", faceId: "carbon-12k", frameId: "hollow-tubular-frame", bridgeId: "open", beamOrientation: "vertical" },
        extraRationale: "Structural Innovation track: hollow tubular frame standard in tennis for 40 years, essentially absent from padel. Distributes load around the perimeter rather than through a solid cross-section. Minimal holes (Head Extreme One principle) give a more continuous face. Control from structural precision, not material softness.",
      },
      "damping-chain": {
        trackLabel: "Damping Chain",
        philosophy: "Engineer every vibration interface in the shot path — foam-PE core, honeycomb-reinforced frame, dampener-integrated grip, closed bridge for total torsional consistency.",
        overrides: { coreId: "foam-pe", faceId: "carbon-18k", frameId: "honeycomb-reinforced-frame", bridgeId: "closed", gripId: "dampener-integrated-grip" },
        extraRationale: "Damping Chain track: every interface in the contact chain selected to absorb rather than transmit. Foam-PE core (most elastic), honeycomb-reinforced frame (structural damping from 1970s tennis patents), embedded dampener in handle, closed bridge for zero torsional variables on off-center hits.",
      },
    },
    power: {
      "material-first": {
        trackLabel: "Material-first",
        philosophy: "Maximum energy transfer through material stiffness — hard EVA core, stiffest carbon face available, full carbon frame, 3D-print surface for aggressive ball contact.",
        overrides: { coreId: "eva-hard", frameId: "carbon-frame", surfaceId: "3d-print" },
        extraRationale: "Material-first track: straightforward maximum-stiffness approach. Hard core for instant energy return, 3D-print surface for spin loading on smashes.",
      },
      "structural-innovation": {
        trackLabel: "Structural Innovation",
        philosophy: "Power through structural geometry — hollow tubular frame concentrates load at the perimeter (higher effective stiffness per gram than solid carbon), XL honeycomb surface for aggressive ball grip.",
        overrides: { coreId: "eva-hard", faceId: "carbon-3k", frameId: "hollow-tubular-frame", surfaceId: "xl-honeycomb" },
        extraRationale: "Structural Innovation track: hollow tubular frame (stiffest available geometry per gram — standard in tennis, rare in padel). XL honeycomb texture for ball contact at raised cell edges rather than continuous grit. Power from structural efficiency.",
      },
      "damping-chain": {
        trackLabel: "Auxetic Rebound",
        philosophy: "Power through frame geometry that returns energy — auxetic carbon frame widens on impact rather than compressing, returning more energy to the ball through frame behavior rather than just material hardness.",
        overrides: { coreId: "eva-hard", faceId: "carbon-3k", frameId: "auxetic-frame" },
        extraRationale: "Auxetic Rebound track: auxetic frame (negative Poisson's ratio — widens on impact) returns energy to the ball through frame geometry. Head's Auxetic 2.0 uses this principle. Paired with hard core for a two-lever power approach: material stiffness AND structural energy return.",
      },
    },
    comfort: {
      "material-first": {
        trackLabel: "Material-first",
        philosophy: "Soften every contact point independently — foam-PE core (more elastic than any EVA grade), anti-shock grip, hybrid frame, smooth surface.",
        overrides: { coreId: "foam-pe", gripId: "anti-shock-grip", frameId: "hybrid-frame", surfaceId: "smooth" },
        extraRationale: "Material-first track: each material component independently chosen for comfort contribution. Foam-PE is softer and more elastic than EVA, providing stronger vibration absorption at the source.",
      },
      "structural-innovation": {
        trackLabel: "Structural Innovation",
        philosophy: "Comfort through structural choices — round grip cross-section reduces grip tension and forearm fatigue, single open beam is lightest possible construction for swing fatigue reduction over long sessions.",
        overrides: { coreId: "eva-soft", gripId: "anti-shock-grip", gripShapeId: "grip-round", frameId: "honeycomb-reinforced-frame", bridgeId: "open", beamOrientation: "vertical" },
        extraRationale: "Structural Innovation track: comfort at the structural level. Round grip cross-section (common in squash, rare in padel) reduces the grip tension that causes forearm fatigue. Single-beam open bridge = lightest possible construction, reducing swing-cumulative fatigue over long sessions.",
      },
      "damping-chain": {
        trackLabel: "Damping Chain",
        philosophy: "Maximum vibration management from core to hand — dampener-integrated handle (analogous to Babolat Cortex in tennis), closed bridge, foam-PE core, honeycomb frame.",
        overrides: { coreId: "foam-pe", gripId: "dampener-integrated-grip", frameId: "honeycomb-reinforced-frame", bridgeId: "closed" },
        extraRationale: "Damping Chain track: the complete arm-protection build. Every interface engineered for absorption: foam-PE core, honeycomb frame, embedded handle dampener, closed bridge eliminating torsional feedback. The professional elbow-protection spec.",
      },
    },
    balanced: {
      "material-first": {
        trackLabel: "Material-first",
        philosophy: "Hybrid-core as the foundational choice — soft near the throat for defense and touch, firmer toward the hitting zone for attacking shots. The only core designed for within-session versatility.",
        overrides: { coreId: "hybrid-core", faceId: "carbon-12k" },
        extraRationale: "Material-first track: hybrid dual-density core as the primary philosophy. Soft at the throat (defensive shots, touch volleys), firmer toward the tip (overhead smashes, attacking shots). No other core in the data model is built for this kind of positional versatility.",
      },
      "structural-innovation": {
        trackLabel: "Structural Innovation",
        philosophy: "Wide-body diamond shape as the geometric approach to balance — retains power ceiling but broader frame increases twistweight and widens the effective sweet spot without requiring soft materials.",
        overrides: { shapeId: "diamond-wide", coreId: "hybrid-core", faceId: "carbon-12k" },
        extraRationale: "Structural Innovation track: wide-body diamond is a genuine market gap (your own brief document identified this). Broader than standard diamond = higher twistweight = more forgiving on off-center contact, while retaining the shape's power ceiling. Balance achieved through geometry, not material compromise.",
      },
      "damping-chain": {
        trackLabel: "Auxetic Balance",
        philosophy: "Auxetic frame distributes ball impact across the whole hitting zone rather than at a point — structurally balanced response rather than a material-averaged compromise.",
        overrides: { coreId: "hybrid-core", frameId: "auxetic-frame", faceId: "carbon-12k" },
        extraRationale: "Auxetic Balance track: auxetic frame widens on impact across the full hitting area, distributing ball energy more evenly than a standard frame. This is structural balance — the frame responds uniformly regardless of where contact occurs. Head uses Auxetic 2.0 but hasn't applied it to a balanced-priority brief.",
      },
    },
  };

  const tracks = TRACK_OVERRIDES[input.priority] ?? TRACK_OVERRIDES.balanced;
  const alternatives: FactoryBriefAlternative[] = [];
  console.log("[FactoryBrief] Primary done. Running", Object.keys(tracks).length, "alternative tracks for priority:", input.priority);

  (Object.entries(tracks) as [string, TrackOverride][]).forEach(([trackId, track]) => {
    console.log("[FactoryBrief] Running track:", trackId);
    const altBase = computeFactoryBrief(input);
    const altSpec = { ...altBase.spec, ...track.overrides };

    // Hard constraints always survive into alternatives
    if (input.explicitShape) altSpec.shapeId = input.explicitShape;
    if (input.tooling === "existing-mold" && input.existingShapeId) altSpec.shapeId = input.existingShapeId;
    if (input.explicitBridge) altSpec.bridgeId = input.explicitBridge;
    if (input.explicitSurface) altSpec.surfaceId = input.explicitSurface;

    const oem = estimateOEMCost(altSpec);
    const [lo, hi] = oemToRetailRange(oem);

    alternatives.push({
      trackId: trackId as any,
      trackLabel: track.trackLabel,
      philosophy: track.philosophy,
      spec: altSpec,
      rationale: [track.extraRationale],
      oem,
      retailRange: [lo, hi],
    });
  });

  return { ...primary, alternatives };
}



// ---------------------------------------------------------------------------
// DIMENSION EXPLANATIONS
// ---------------------------------------------------------------------------

function explainLength(mm) {
  if (mm >= 450) return "At the long end — maximum reach on serves and overheads. Costs some maneuverability in fast net exchanges.";
  if (mm >= 430) return "Mid-to-long range. Keeps most reach and leverage while trimming a little swing weight.";
  return "Shorter end. Easier to whip through fast exchanges and volleys, at the cost of some reach.";
}
function explainWidth(mm, shapeId) {
  if (mm >= 250) return "Near the 260mm legal max. Widest practical hitting area, enlarging the sweet spot.";
  if (mm >= 230) return "Mid-range width. Reasonable balance between sweet-spot size and compact feel.";
  return "Narrower head. Smaller hitting area — more compact and maneuverable.";
}
function explainThickness(mm) {
  if (mm >= 37) return "Near the 38mm legal max — maximizes face stiffness for direct power transfer.";
  if (mm >= 33) return "Slightly below the 38mm standard. Marginally softer, more comfortable feel.";
  return "Noticeably thinner — softer feel and easier handling, less face stiffness for power.";
}
function explainWeight(g) {
  if (g >= 374) return "Heavy — more mass behind the ball. Extra power and stability, but slower to redirect.";
  if (g >= 362) return "Mid-weight. The most common range — balance between power, stability, and maneuverability.";
  return "Light — faster reactions and less arm fatigue. Less raw mass behind smashes.";
}
function explainBalance(cm, shapeId) {
  if (cm >= 26.5) return "Head-heavy — more leverage on smashes. Harder to redirect quickly on defense.";
  if (cm >= 25.3) return "Neutral balance. A working compromise — enough leverage without sacrificing speed.";
  return "Head-light — faster to move and redirect, gentler on the arm. Less natural leverage on smashes.";
}
function explainGripCirc(mm) {
  if (mm >= 40) return "Wide grip — more stable on powerful shots, restricts wrist snap.";
  if (mm >= 37) return "Mid-range. Close to what most factory grips ship at before overgrip.";
  return "Narrow grip — frees wrist snap for spin and reflex volleys. Tighter squeeze required on power shots.";
}
function sweetSpotPosLabel(shapeId, balanceCm) {
  const sw = shapeId === "round" ? "low / centered" : shapeId === "diamond" ? "high, near the tip" : shapeId === "diamond-wide" ? "high, wider than standard diamond" : "mid-face";
  const bw = balanceCm >= 26.5 ? "shifted up by high balance" : balanceCm < 25.3 ? "pulled down by low balance" : "near shape baseline";
  return `${sw} — ${bw}`;
}

// ---------------------------------------------------------------------------
// SVG PATH HELPERS
// ---------------------------------------------------------------------------

function headOutlinePath(shape, cx, topY, halfWidthMax, headHeight) {
  const ww = halfWidthMax, t = topY, b = topY + headHeight;
  if (shape === "round") {
    const mid = t + headHeight * 0.5;
    return `M ${cx} ${t} C ${cx+ww*0.74} ${t}, ${cx+ww} ${t+headHeight*0.22}, ${cx+ww} ${mid} C ${cx+ww} ${b-headHeight*0.22}, ${cx+ww*0.74} ${b}, ${cx} ${b} C ${cx-ww*0.74} ${b}, ${cx-ww} ${b-headHeight*0.22}, ${cx-ww} ${mid} C ${cx-ww} ${t+headHeight*0.22}, ${cx-ww*0.74} ${t}, ${cx} ${t} Z`;
  }
  if (shape === "diamond") {
    const mid = t + headHeight * 0.32;
    return `M ${cx} ${t+6} C ${cx+ww*0.32} ${t-2}, ${cx+ww*0.78} ${t+headHeight*0.05}, ${cx+ww*0.94} ${mid-headHeight*0.05} C ${cx+ww*1.02} ${mid+headHeight*0.02}, ${cx+ww*0.86} ${mid+headHeight*0.14}, ${cx+ww*0.7} ${b-headHeight*0.12} C ${cx+ww*0.58} ${b-headHeight*0.02}, ${cx+ww*0.3} ${b+2}, ${cx} ${b+4} C ${cx-ww*0.3} ${b+2}, ${cx-ww*0.58} ${b-headHeight*0.02}, ${cx-ww*0.7} ${b-headHeight*0.12} C ${cx-ww*0.86} ${mid+headHeight*0.14}, ${cx-ww*1.02} ${mid+headHeight*0.02}, ${cx-ww*0.94} ${mid-headHeight*0.05} C ${cx-ww*0.78} ${t+headHeight*0.05}, ${cx-ww*0.32} ${t-2}, ${cx} ${t+6} Z`;
  }
  if (shape === "diamond-wide") {
    // Same peak position as standard diamond but wider through the shoulders — the defining geometric difference
    const mid = t + headHeight * 0.30;
    return `M ${cx} ${t+6} C ${cx+ww*0.38} ${t-2}, ${cx+ww*0.88} ${t+headHeight*0.05}, ${cx+ww*1.0} ${mid-headHeight*0.03} C ${cx+ww*1.06} ${mid+headHeight*0.04}, ${cx+ww*0.92} ${mid+headHeight*0.16}, ${cx+ww*0.72} ${b-headHeight*0.12} C ${cx+ww*0.58} ${b-headHeight*0.02}, ${cx+ww*0.3} ${b+2}, ${cx} ${b+4} C ${cx-ww*0.3} ${b+2}, ${cx-ww*0.58} ${b-headHeight*0.02}, ${cx-ww*0.72} ${b-headHeight*0.12} C ${cx-ww*0.92} ${mid+headHeight*0.16}, ${cx-ww*1.06} ${mid+headHeight*0.04}, ${cx-ww*1.0} ${mid-headHeight*0.03} C ${cx-ww*0.88} ${t+headHeight*0.05}, ${cx-ww*0.38} ${t-2}, ${cx} ${t+6} Z`;
  }
  const mid = t + headHeight * 0.42;
  return `M ${cx} ${t} C ${cx+ww*0.86} ${t+2}, ${cx+ww} ${mid-headHeight*0.18}, ${cx+ww*0.95} ${mid} C ${cx+ww*0.88} ${b-headHeight*0.2}, ${cx+ww*0.46} ${b-4}, ${cx} ${b} C ${cx-ww*0.46} ${b-4}, ${cx-ww*0.88} ${b-headHeight*0.2}, ${cx-ww*0.95} ${mid} C ${cx-ww} ${mid-headHeight*0.18}, ${cx-ww*0.86} ${t+2}, ${cx} ${t} Z`;
}

// Each face material gets a distinct visual profile rather than a shared
// hatch boolean, grounded in how these materials actually look:
//   - Fiberglass: smooth, light, matte — little to no visible weave
//   - Carbon (3K/12K/18K): visible woven crosshatch, weave DENSITY scales
//     with K-count (more filaments per tow = finer, tighter weave grid),
//     base tone gets slightly lighter/more uniform at higher K per the
//     "more flexible, more homogeneous" descriptions gathered earlier
//   - Graphene: very fine, almost weave-less near-black finish (graphene
//     is typically blended INTO a carbon layup as a thin reinforcement,
//     not woven on its own) — rendered as the darkest, smoothest surface
//   - Kevlar: distinctive golden-yellow woven crosshatch, visually
//     unmistakable from carbon's black/gray weave — even though padel
//     manufacturers usually hide kevlar as a structural layer, this
//     tool's "Kevlar-reinforced" option is modeled as visible for clarity
//
// gloss/darkTone are used only by the 3D illustration mode below: gloss
// (0-1) sets how sharp/bright the specular highlight reads — woven
// carbon and graphene have a real lacquered-composite shine, fiberglass
// is more of a satin matte, kevlar's resin-coated weave sits in between.
// darkTone is a deeper shade of the same material used as the gradient's
// shadow stop, so the curvature reads as a real molded surface.
const FACE_VISUAL = {
  fiberglass: { tint: "#F0ECDE", weaveColor: null, weaveSpacing: 0, coverage: 0, gloss: 0.35, darkTone: "#C9C2A8" },
  "carbon-3k": { tint: "#D8D6D2", weaveColor: "#2A2A2E", weaveSpacing: 22, coverage: 1, gloss: 0.85, darkTone: "#3A3A3E" },
  "carbon-12k": { tint: "#DEDCD8", weaveColor: "#3A3A3E", weaveSpacing: 14, coverage: 1, gloss: 0.8, darkTone: "#46464A" },
  "carbon-18k": { tint: "#E4E2DE", weaveColor: "#4A4A4E", weaveSpacing: 9, coverage: 1, gloss: 0.7, darkTone: "#54545A" },
  graphene: { tint: "#C4C2C6", weaveColor: "#16161A", weaveSpacing: 6, coverage: 1, gloss: 0.95, darkTone: "#0E0E12" },
  "kevlar-reinforced": { tint: "#F2E2A8", weaveColor: "#B8860B", weaveSpacing: 16, coverage: 1, gloss: 0.6, darkTone: "#9C7416" },
};

// Illustration-mode-specific tints, kept separate from the flat-diagram
// tints above. The flat diagram differentiates materials mainly through
// its literal weave-line overlay, so its tints can stay subtle; the
// illustration mode has no weave grid (intentionally smooth/one-piece,
// per an earlier revision) and relies on tint + gloss alone to read as
// different materials — the original tints were all near-identical
// pale grays once the weave pattern was removed, so nothing actually
// looked different between carbon grades or fiberglass. These give each
// material a genuinely distinguishable color identity while staying
// inside a believable "real composite material" palette (no material
// turns neon or unnatural — just more clearly itself).
const ILLUSTRATION_FACE_VISUAL = {
  fiberglass: { tint: "#F2EEDF", darkTone: "#C7BFA0" }, // warm cream, lowest gloss
  "carbon-3k": { tint: "#5A5A60", darkTone: "#1C1C20" }, // darkest, stiffest-reading carbon
  "carbon-12k": { tint: "#6E6E76", darkTone: "#26262C" }, // mid-gray carbon, the common all-rounder
  "carbon-18k": { tint: "#82828C", darkTone: "#34343C" }, // lightest of the carbons, flat-tape look
  graphene: { tint: "#3A3A42", darkTone: "#0C0C10" }, // near-black, glossiest
  "kevlar-reinforced": { tint: "#D9B84A", darkTone: "#8A6310" }, // distinct gold, unmistakable from any carbon
};

const PROFILE_CORE_TINT = { "eva-soft":"#E8E4D8","eva-medium":"#DFDAC9","eva-hard":"#D2CBB5","foam-pe":"#EDEAE0","hybrid-core":"#E3DCC8" };

// ---------------------------------------------------------------------------
// RACQUET SVG COMPONENTS
// ---------------------------------------------------------------------------

function RacquetProfile({ shape, faceId, coreObj, frameObj, thicknessMm, widthMm, lengthMm, holes, gripShapeId }) {
  const STROKE = "#4A4540";
  const tFrac = (thicknessMm - 28) / (38 - 28);
  const bodyThickness = 16 + tFrac * 20;
  const faceVisual = FACE_VISUAL[faceId] || FACE_VISUAL["carbon-12k"];
  const faceTint = faceVisual.tint;
  const coreTint = PROFILE_CORE_TINT[coreObj?.id] || "#E3DCC8";
  const frameTint = frameObj?.id?.includes("carbon") ? "#1F1F24" : "#2B2A26";

  // Hollow frame types — these get a cross-section showing the wall + void
  const isHollowTubular = frameObj?.id === "hollow-tubular-frame";
  const isHoneycombFrame = frameObj?.id === "honeycomb-reinforced-frame";
  const isClamshell = frameObj?.id === "two-piece-clamshell-frame";
  const showHollowSection = isHollowTubular || isHoneycombFrame || isClamshell;
  // Wall thickness in the cross-section visualization — carbon wall ~2mm real,
  // scaled up for legibility in the diagram
  const wallPx = (isHollowTubular || isClamshell) ? 5 : 4;

  const startX = 30, midY = 210;
  const headLen = 130 + ((widthMm - 200) / 60) * 20;
  const throatLen = 60;
  const handleLen = 70 + ((lengthMm - 400) / 55) * 30;
  const headEndX = startX + headLen, throatEndX = headEndX + throatLen, handleEndX = throatEndX + handleLen;
  const headThick = bodyThickness, throatThick = bodyThickness * 0.55, handleThick = bodyThickness * 0.62;
  const topAt = (x) => {
    if (x <= headEndX) { const t = (x - startX) / headLen; const round = Math.min(1, t / 0.12); return midY - (headThick / 2) * round; }
    if (x <= throatEndX) { const t = (x - headEndX) / throatLen; return midY - (headThick/2) + t*(headThick/2 - throatThick/2); }
    return midY - throatThick/2 + ((handleThick - throatThick)/2) * Math.min(1, (x-throatEndX)/10);
  };
  const botAt = (x) => midY*2 - topAt(x);
  const sampleXs: number[] = [];
  for (let x = startX; x <= handleEndX; x += 4) sampleXs.push(x);
  const topPts = sampleXs.map(x=>`${x},${topAt(x).toFixed(1)}`).join(" L ");
  const botPts = sampleXs.slice().reverse().map(x=>`${x},${botAt(x).toFixed(1)}`).join(" L ");
  const silhouette = `M ${topPts} L ${handleEndX},${midY-handleThick/2} L ${handleEndX},${midY+handleThick/2} L ${botPts} Z`;

  // Inner hollow path — inset by wallPx on all sides to show the void
  const innerTopPts = sampleXs.filter(x => x <= headEndX).map(x=>`${x},${(topAt(x)+wallPx).toFixed(1)}`).join(" L ");
  const innerBotPts = sampleXs.filter(x => x <= headEndX).slice().reverse().map(x=>`${x},${(botAt(x)-wallPx).toFixed(1)}`).join(" L ");
  const innerVoid = `M ${innerTopPts} L ${innerBotPts} Z`;

  const faceSkinPx = 2.5;
  // The profile's side-view can only show a handful of representative tick
  // marks regardless of true hole count (it's a cross-section, not a
  // top-down face view) — scale the real count down proportionally, same
  // visual density the old bucket table produced (7 ticks ≈ "standard").
  const realHoleCount = holes?.length ?? 55;
  const holeCount = Math.max(0, Math.min(12, Math.round(realHoleCount / 8)));
  const holeXs: number[] = [];
  for (let i = 0; i < holeCount; i++) { const t = holeCount > 1 ? i/(holeCount-1) : 0.5; holeXs.push(startX + headLen*0.12 + t*headLen*0.74); }
  const handleGripStartX = throatEndX;

  // Cross-section callout position — mid-head area
  const xsX = startX + headLen * 0.42;
  const xsTop = topAt(xsX), xsBot = botAt(xsX);
  const xsThick = xsBot - xsTop;

  return (
    <svg viewBox="0 0 420 320" width="100%" height="100%" style={{display:"block"}}>
      <defs>
        <linearGradient id="profileSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.25"/>
          <stop offset="45%" stopColor="#FFF" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0.06"/>
        </linearGradient>
        {/* Honeycomb pattern for honeycomb-reinforced frame interior */}
        <pattern id="honeycombPat" x="0" y="0" width="8" height="7" patternUnits="userSpaceOnUse">
          <path d="M4,0 L8,2 L8,5 L4,7 L0,5 L0,2 Z" fill="none" stroke="#8A8268" strokeWidth="0.5" opacity="0.5"/>
        </pattern>
      </defs>

      <ellipse cx={(startX+handleEndX)/2+6} cy={midY+headThick/2+16} rx={(handleEndX-startX)/2.1} ry={8} fill="#000" opacity="0.07"/>

      {/* Main silhouette */}
      <path d={silhouette} fill={showHollowSection ? frameTint : faceTint} stroke={STROKE} strokeWidth="2" strokeLinejoin="round"/>

      {/* For hollow/honeycomb/clamshell frames: show the internal void */}
      {showHollowSection && (
        <>
          {/* Internal void — shows as lighter/empty space inside the carbon walls */}
          <path d={innerVoid} fill={isHoneycombFrame ? "url(#honeycombPat)" : isClamshell ? coreTint : "#F0EBE0"} opacity={isHoneycombFrame ? 0.9 : isClamshell ? 0.6 : 0.85}/>
          {/* Core layer inside the void */}
          <path d={`M ${startX+headLen*0.06},${midY-headThick/2+wallPx+faceSkinPx} L ${headEndX-4},${midY-throatThick/2+wallPx+faceSkinPx} L ${headEndX-4},${midY+throatThick/2-wallPx-faceSkinPx} L ${startX+headLen*0.06},${midY+headThick/2-wallPx-faceSkinPx} Z`} fill={coreTint} opacity={isClamshell ? 0.75 : 0.5}/>
          {/* Clamshell seam line — the horizontal split plane where the two halves bond */}
          {isClamshell && (
            <>
              <line x1={startX+headLen*0.04} y1={midY} x2={headEndX} y2={midY} stroke="#1A5C2A" strokeWidth="1.2" strokeDasharray="5 2" opacity="0.75"/>
              <text x={headEndX-30} y={midY-3} fontFamily="'JetBrains Mono', monospace" fontSize="7.5" fill="#1A5C2A">bond seam</text>
            </>
          )}
          {/* Wall thickness labels */}
          <line x1={xsX} y1={xsTop-4} x2={xsX} y2={xsTop+wallPx+2} stroke="#1A5C2A" strokeWidth="1" strokeDasharray="2 1"/>
          <line x1={xsX} y1={xsBot+4} x2={xsX} y2={xsBot-wallPx-2} stroke="#1A5C2A" strokeWidth="1" strokeDasharray="2 1"/>
          <text x={xsX+5} y={xsTop+wallPx/2+4} fontFamily="'JetBrains Mono', monospace" fontSize="8.5" fill="#1A5C2A">carbon wall</text>
          <text x={xsX+5} y={xsTop+xsThick/2+4} fontFamily="'JetBrains Mono', monospace" fontSize="8.5" fill="#7A7268">{isHoneycombFrame ? "honeycomb core" : isClamshell ? "foam cassette" : "hollow void"}</text>
        </>
      )}

      {/* Standard filled construction */}
      {!showHollowSection && (
        <path d={`M ${startX+headLen*0.06},${midY-headThick/2+faceSkinPx} L ${throatEndX},${midY-throatThick/2+faceSkinPx} L ${throatEndX},${midY+throatThick/2-faceSkinPx} L ${startX+headLen*0.06},${midY+headThick/2-faceSkinPx} Z`} fill={coreTint} opacity="0.85"/>
      )}

      {/* Frame end cap */}
      <path d={`M ${startX},${midY-headThick*0.18} Q ${startX-6},${midY} ${startX},${midY+headThick*0.18}`} fill="none" stroke={frameTint} strokeWidth="3" strokeLinecap="round"/>

      {/* Holes in profile */}
      {holeXs.map((hx,i)=><line key={i} x1={hx} y1={topAt(hx)+1.5} x2={hx} y2={topAt(hx)+headThick*0.22} stroke={STROKE} strokeWidth="1.6" opacity="0.55"/>)}

      {/* Throat transition detail */}
      <path d={`M ${headEndX+throatLen*0.3},${midY-throatThick*0.3} L ${headEndX+throatLen*0.7},${midY-throatThick*0.15} L ${headEndX+throatLen*0.7},${midY+throatThick*0.15} L ${headEndX+throatLen*0.3},${midY+throatThick*0.3} Z`} fill="none" stroke={STROKE} strokeWidth="1.2" opacity="0.5"/>

      {/* Handle grip */}
      <g>
        {gripShapeId === "hexagonal"
          ? Array.from({length: Math.ceil((handleEndX-handleGripStartX)/14)}).map((_,i)=>{ const x=handleGripStartX+i*14; if(x>handleEndX-6)return null; return <line key={i} x1={x} y1={midY-handleThick/2+2} x2={x} y2={midY+handleThick/2-2} stroke={STROKE} strokeWidth="1" opacity="0.4"/>; })
          : Array.from({length: Math.ceil((handleEndX-handleGripStartX)/10)}).map((_,i)=>{ const x=handleGripStartX+i*10; if(x>handleEndX-4)return null; return <line key={i} x1={x} y1={midY-handleThick/2+2} x2={x+6} y2={midY+handleThick/2-2} stroke={STROKE} strokeWidth="0.9" opacity="0.45"/>; })}
        <path d={`M ${handleEndX-2},${midY-handleThick/2} Q ${handleEndX+6},${midY} ${handleEndX-2},${midY+handleThick/2}`} fill="none" stroke={STROKE} strokeWidth="2.4" strokeLinecap="round"/>
      </g>

      {/* Sheen + outline */}
      <path d={silhouette} fill="url(#profileSheen)"/>
      <path d={silhouette} fill="none" stroke={STROKE} strokeWidth="2" strokeLinejoin="round"/>

      {/* Frame construction badge */}
      {showHollowSection && (
        <g>
          <rect x={startX} y={midY+headThick/2+22} width={isHoneycombFrame ? 154 : isClamshell ? 168 : 128} height={16} rx={4} fill="#EAF3EC"/>
          <text x={startX+6} y={midY+headThick/2+33} fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#1A5C2A" fontWeight="700">
            {isHoneycombFrame ? "HONEYCOMB REINFORCED" : isClamshell ? "TWO-PIECE CLAMSHELL — MODULAR" : "HOLLOW TUBULAR — TENNIS-DERIVED"}
          </text>
        </g>
      )}

      {/* Dimension labels */}
      <g fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#6B6960">
        <line x1={startX+headLen*0.5} y1={midY-headThick/2-10} x2={startX+headLen*0.5} y2={midY+headThick/2+10} stroke="#4A4540" strokeWidth="1"/>
        <line x1={startX+headLen*0.5-6} y1={midY-headThick/2-10} x2={startX+headLen*0.5+6} y2={midY-headThick/2-10} stroke="#4A4540" strokeWidth="1"/>
        <line x1={startX+headLen*0.5-6} y1={midY+headThick/2+10} x2={startX+headLen*0.5+6} y2={midY+headThick/2+10} stroke="#4A4540" strokeWidth="1"/>
        <text x={startX+headLen*0.5+12} y={midY+4}>{thicknessMm}mm</text>
        <text x={startX+headLen/2} y={midY+headThick/2+36} textAnchor="middle" fontSize="10">head</text>
        <text x={headEndX+throatLen/2} y={midY+throatThick/2+36} textAnchor="middle" fontSize="10">throat</text>
        <text x={throatEndX+(handleEndX-throatEndX)/2} y={midY+handleThick/2+36} textAnchor="middle" fontSize="10">handle</text>
      </g>
    </svg>
  );
}

function RacquetDiagram({ shape, faceId, gripShapeId, holes, holeDiameterMm, lengthMm, widthMm, balanceCm, weightG, coreObj, faceObj, frameObj, bridgeId, beamCount, beamOrientation, mode }) {
  const STROKE = "#4A4540";
  const cx = 230, topY = 30, headHeight = 290;
  const halfWidth = Math.min(148, (widthMm / 260) * 148);
  const outline = headOutlinePath(shape, cx, topY, halfWidth, headHeight);
  const sweet = computeSweetSpotAndStability({ shape, balanceCm, widthMm, weightG, core: coreObj, face: faceObj, frame: frameObj, bridgeId, beamOrientation, holes, holeDiameterMm, topY, headHeight, halfWidth });
  const faceVisual = FACE_VISUAL[faceId] || FACE_VISUAL["carbon-12k"];
  const tint = faceVisual.tint;
  // Frame material gets a distinct rim stroke — fiberglass frames render
  // a lighter, slightly thinner outline (less visually "rigid"), basalt
  // gets a warm dark-brown tint reflecting its volcanic-rock origin,
  // carbon and hybrid get the standard bold black rim.
  const frameRimStyle =
    frameObj?.id === "fiberglass-frame"
      ? { color: "#4A4A48", width: "2" }
      : frameObj?.id === "basalt-frame"
      ? { color: "#3A2A1E", width: "2.5" }
      : { color: STROKE, width: "2.5" };
  const headBottomY = topY + headHeight, throatNeckY = headBottomY - 18;
  const bridgeTopY = headBottomY - 4, bridgeHeight = 86, bridgeBottomY = bridgeTopY + bridgeHeight;
  const handleWidth = 26, collarY = bridgeBottomY + 10;
  const handleTopY = collarY + 14;
  const handleHeight = Math.max(120, Math.min(200, (lengthMm - 380) * 1.1 + 130));
  const handleBottomY = handleTopY + handleHeight;
  // Direct mapping from real hole coordinates onto this diagram's pixel
  // space — replaces the old procedural row/col grid generation with
  // pattern-name bias (centered/edge/even). Each hole's normalized
  // {x,y} (-1..1 relative to face center) maps onto the actual face
  // outline geometry already computed above (cx, topY, headHeight,
  // halfWidth), so real placed holes render exactly where they were
  // clicked, respecting this shape's true proportions.
  const faceMidY = topY + headHeight * 0.5;
  const holeDots: {x:number,y:number}[] = (holes ?? []).map((h: HolePoint) => ({
    x: cx + h.x * (halfWidth - 26),
    y: faceMidY + h.y * (headHeight * 0.42),
  }));
  // Weave pattern: woven materials (carbon, kevlar, graphene) get a true
  // crosshatch — two perpendicular diagonal line sets — covering the
  // full face, with density driven by each material's weaveSpacing
  // (lower spacing = finer/denser weave, matching higher K-counts).
  // Fiberglass gets sparse random flecks instead, matching its smoother,
  // non-woven appearance with occasional visible fiber strands.
  const weaveLinesA: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const weaveLinesB: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const flecks: { x: number; y: number; r: number; rot: number }[] = [];
  if (faceVisual.coverage > 0) {
    const spacing = faceVisual.weaveSpacing;
    const top = topY - 10, bottom = topY + headHeight + 10;
    const left = cx - halfWidth - 10, right = cx + halfWidth + 10;
    for (let d = -((right - left) + (bottom - top)); d < (right - left) + (bottom - top); d += spacing) {
      weaveLinesA.push({ x1: left + d, y1: top, x2: left + d + (bottom - top), y2: bottom });
      weaveLinesB.push({ x1: right - d, y1: top, x2: right - d - (bottom - top), y2: bottom });
    }
  } else {
    // fiberglass: sparse, randomly-oriented short flecks rather than a
    // uniform weave, seeded deterministically so the pattern is stable
    // across re-renders for the same shape/width
    let seed = 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 70; i++) {
      flecks.push({
        x: cx - halfWidth + rand() * halfWidth * 2,
        y: topY + rand() * headHeight,
        r: 3 + rand() * 4,
        rot: rand() * 180,
      });
    }
  }
  const innerNeckHalf = handleWidth/2+3, outerThroatHalf = halfWidth*0.4, throatMidY = (bridgeTopY+bridgeBottomY)/2;
  const strutOffsets: number[] = [];
  if (bridgeId === "open") {
    if (beamCount === 1) strutOffsets.push(0);
    else if (beamCount === 2) { const g = innerNeckHalf*0.55; strutOffsets.push(-g, g); }
    else { const g = innerNeckHalf*0.65; strutOffsets.push(0,-g,g); }
    strutOffsets.sort((a,b)=>a-b);
  }
  const lerpHalf = (yFrac) => outerThroatHalf + (innerNeckHalf - outerThroatHalf) * yFrac;
  const boundaries = [-1, ...strutOffsets.map(s=>s/innerNeckHalf), 1];
  return (
    <svg viewBox="0 0 460 640" width="100%" height="100%" style={{display:"block"}}>
      <defs><clipPath id="headClip"><path d={outline}/></clipPath></defs>
      <path d={outline} fill={tint} stroke={frameRimStyle.color} strokeWidth={frameRimStyle.width} strokeLinejoin="round"/>
      {faceVisual.coverage > 0 ? (
        <g clipPath="url(#headClip)">
          {weaveLinesA.map((h, i) => <line key={"a" + i} x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} stroke={faceVisual.weaveColor} strokeWidth="1" opacity="0.5" />)}
          {weaveLinesB.map((h, i) => <line key={"b" + i} x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} stroke={faceVisual.weaveColor} strokeWidth="1" opacity="0.5" />)}
        </g>
      ) : (
        <g clipPath="url(#headClip)">
          {flecks.map((f, i) => (
            <line
              key={i}
              x1={f.x - f.r * Math.cos((f.rot * Math.PI) / 180)}
              y1={f.y - f.r * Math.sin((f.rot * Math.PI) / 180)}
              x2={f.x + f.r * Math.cos((f.rot * Math.PI) / 180)}
              y2={f.y + f.r * Math.sin((f.rot * Math.PI) / 180)}
              stroke="#B8B4A0"
              strokeWidth="0.8"
              opacity="0.4"
            />
          ))}
        </g>
      )}
      <path d={headOutlinePath(shape, cx, topY+7, halfWidth-9, headHeight-14)} fill="none" stroke={STROKE} strokeWidth="1" opacity="0.5"/>
      <g clipPath="url(#headClip)">{holeDots.map((h,i)=><circle key={i} cx={h.x} cy={h.y} r={6.5} fill="none" stroke={STROKE} strokeWidth="1.3"/>)}</g>
      {mode === "diagram" && (
        <g>
          <circle cx={cx} cy={sweet.y} r={sweet.r+16} fill="none" stroke="#1A5C2A" strokeWidth="1" strokeDasharray="2 4" opacity={0.15+(1-sweet.stability)*0.35}/>
          <circle cx={cx} cy={sweet.y} r={sweet.r} fill="#1A5C2A" opacity="0.12"/>
          <circle cx={cx} cy={sweet.y} r={sweet.r} fill="none" stroke="#1A5C2A" strokeWidth="1.5" strokeDasharray="4 3"/>
          <circle cx={cx} cy={sweet.y} r={3} fill="#1A5C2A"/>
        </g>
      )}
      <path d={`M ${cx-halfWidth*0.5} ${headBottomY-6} Q ${cx-outerThroatHalf-6} ${throatNeckY+16}, ${cx-outerThroatHalf} ${bridgeTopY} M ${cx+halfWidth*0.5} ${headBottomY-6} Q ${cx+outerThroatHalf+6} ${throatNeckY+16}, ${cx+outerThroatHalf} ${bridgeTopY}`} fill="none" stroke={frameRimStyle.color} strokeWidth="2.5" strokeLinecap="round"/>
      <path d={`M ${cx-outerThroatHalf} ${bridgeTopY} L ${cx+outerThroatHalf} ${bridgeTopY} L ${cx+innerNeckHalf} ${bridgeBottomY} L ${cx-innerNeckHalf} ${bridgeBottomY} Z`} fill={bridgeId==="closed"?tint:"none"} stroke={frameRimStyle.color} strokeWidth="2.5" strokeLinejoin="round"/>
      {bridgeId === "open" && beamOrientation === "vertical" && (
        <g>
          {boundaries.slice(0,-1).map((bL,i)=>{
            const bR=boundaries[i+1], inset=5, dir=(v)=>(v>=0?-1:1);
            const topL=lerpHalf(0)*bL, topR=lerpHalf(0)*bR, botL=lerpHalf(1)*bL, botR=lerpHalf(1)*bR;
            const midL=lerpHalf(0.5)*bL, midR=lerpHalf(0.5)*bR;
            const iTopL=topL+inset*dir(topL), iTopR=topR-inset*dir(topR), iBotL=botL+inset*dir(botL), iBotR=botR-inset*dir(botR);
            const iMidL=midL+inset*0.4*dir(midL), iMidR=midR-inset*0.4*dir(midR);
            return <path key={i} d={`M ${cx+iTopL} ${bridgeTopY+8} Q ${cx+iMidL} ${throatMidY}, ${cx+iBotL} ${bridgeBottomY-8} Q ${cx+(iBotL+iBotR)/2} ${bridgeBottomY+5}, ${cx+iBotR} ${bridgeBottomY-8} Q ${cx+iMidR} ${throatMidY}, ${cx+iTopR} ${bridgeTopY+8} Q ${cx+(iTopL+iTopR)/2} ${bridgeTopY-5}, ${cx+iTopL} ${bridgeTopY+8} Z`} fill="none" stroke={frameRimStyle.color} strokeWidth="1.6" strokeLinejoin="round"/>;
          })}
        </g>
      )}
      {bridgeId === "open" && beamOrientation === "horizontal" && (
        <g>
          <path d={`M ${cx-outerThroatHalf+6} ${bridgeTopY+8} Q ${cx} ${throatMidY}, ${cx-innerNeckHalf+5} ${bridgeBottomY-8} Q ${cx} ${bridgeBottomY+5}, ${cx+innerNeckHalf-5} ${bridgeBottomY-8} Q ${cx} ${throatMidY}, ${cx+outerThroatHalf-6} ${bridgeTopY+8} Q ${cx} ${bridgeTopY-5}, ${cx-outerThroatHalf+6} ${bridgeTopY+8} Z`} fill="none" stroke={frameRimStyle.color} strokeWidth="1.6" strokeLinejoin="round"/>
          {Array.from({length:Math.min(beamCount,2)}).map((_,i,arr)=>{ const t=arr.length===1?0.5:(i+1)/3; const y=bridgeTopY+t*bridgeHeight; const half=lerpHalf(t)-10; return <line key={i} x1={cx-half} y1={y} x2={cx+half} y2={y} stroke={frameRimStyle.color} strokeWidth="2.2" strokeLinecap="round"/>; })}
        </g>
      )}
      {bridgeId === "open" && beamOrientation === "diagonal" && (
        <g>
          <path d={`M ${cx-outerThroatHalf+6} ${bridgeTopY+8} Q ${cx} ${throatMidY}, ${cx-innerNeckHalf+5} ${bridgeBottomY-8} Q ${cx} ${bridgeBottomY+5}, ${cx+innerNeckHalf-5} ${bridgeBottomY-8} Q ${cx} ${throatMidY}, ${cx+outerThroatHalf-6} ${bridgeTopY+8} Q ${cx} ${bridgeTopY-5}, ${cx-outerThroatHalf+6} ${bridgeTopY+8} Z`} fill="none" stroke={frameRimStyle.color} strokeWidth="1.6" strokeLinejoin="round"/>
          {beamCount===1 ? (
            <g>
              <line x1={cx-outerThroatHalf+10} y1={bridgeTopY+12} x2={cx} y2={bridgeBottomY-10} stroke={frameRimStyle.color} strokeWidth="2.2" strokeLinecap="round"/>
              <line x1={cx+outerThroatHalf-10} y1={bridgeTopY+12} x2={cx} y2={bridgeBottomY-10} stroke={frameRimStyle.color} strokeWidth="2.2" strokeLinecap="round"/>
            </g>
          ) : (
            <g>
              <line x1={cx-outerThroatHalf+10} y1={bridgeTopY+12} x2={cx+innerNeckHalf-6} y2={bridgeBottomY-10} stroke={frameRimStyle.color} strokeWidth="2.2" strokeLinecap="round"/>
              <line x1={cx+outerThroatHalf-10} y1={bridgeTopY+12} x2={cx-innerNeckHalf+6} y2={bridgeBottomY-10} stroke={frameRimStyle.color} strokeWidth="2.2" strokeLinecap="round"/>
            </g>
          )}
        </g>
      )}
      <path d={`M ${cx-innerNeckHalf-2} ${bridgeBottomY} L ${cx-handleWidth/2-5} ${collarY} L ${cx+handleWidth/2+5} ${collarY} L ${cx+innerNeckHalf+2} ${bridgeBottomY}`} fill={tint} stroke={frameRimStyle.color} strokeWidth="2" strokeLinejoin="round"/>
      <line x1={cx-handleWidth/2-5} y1={collarY} x2={cx-handleWidth/2-5} y2={collarY+8} stroke={frameRimStyle.color} strokeWidth="2"/>
      <line x1={cx+handleWidth/2+5} y1={collarY} x2={cx+handleWidth/2+5} y2={collarY+8} stroke={frameRimStyle.color} strokeWidth="2"/>
      <g>
        <rect x={cx-handleWidth/2} y={handleTopY} width={handleWidth} height={handleHeight} fill="#FFFFFF" stroke={STROKE} strokeWidth="2.2" rx={4}/>
        {gripShapeId === "hexagonal" ? (
          <g>
            {/* solid molded grip sleeve underneath — a real hex-pattern
                grip (e.g. Hesacore) is one continuous piece with a
                pressed-in texture, not a wire cage with visible gaps */}
            <rect x={cx - handleWidth / 2} y={handleTopY} width={handleWidth} height={handleHeight} fill="#18181B" />
            <clipPath id="hexHandleClip">
              <rect x={cx - handleWidth / 2} y={handleTopY} width={handleWidth} height={handleHeight} />
            </clipPath>
            <g clipPath="url(#hexHandleClip)">
              {(() => {
                // Properly tessellating flat-top hex grid: adjacent cells
                // share edges with zero gap between them, matching a
                // pressed-honeycomb texture on a real molded grip.
                const hexR = handleWidth / 4.2;
                const hexW = hexR * 2;
                const hexH = hexR * Math.sqrt(3);
                const colStep = hexW * 0.75;
                const cells = [];
                let col = 0;
                for (let x = cx - handleWidth / 2 - hexW; x < cx + handleWidth / 2 + hexW; x += colStep) {
                  const yOffset = col % 2 === 0 ? 0 : hexH / 2;
                  for (let y = handleTopY - hexH; y < handleBottomY + hexH; y += hexH) {
                    cells.push({ x, y: y + yOffset });
                  }
                  col++;
                }
                const flatTopHex = (px, py, r) => {
                  const pts = [];
                  for (let i = 0; i < 6; i++) {
                    const ang = (Math.PI / 3) * i;
                    pts.push(`${px + r * Math.cos(ang)},${py + r * Math.sin(ang)}`);
                  }
                  return pts.join(" ");
                };
                return cells.map((c, i) => (
                  <polygon key={i} points={flatTopHex(c.x, c.y, hexR * 0.96)} fill="#18181B" stroke={STROKE} strokeWidth="0.6" opacity="0.6" />
                ));
              })()}
            </g>
          </g>
        ) : (
          <g>
            {Array.from({length:Math.ceil(handleHeight/18)}).map((_,i)=>{ const y0=handleTopY+i*18, y1=y0+18; if(y1>handleBottomY)return null; return <g key={i}><line x1={cx-handleWidth/2} y1={y0} x2={cx+handleWidth/2} y2={y1} stroke={STROKE} strokeWidth="1.1" opacity="0.8"/><line x1={cx-handleWidth/2} y1={y1} x2={cx+handleWidth/2} y2={y0} stroke={STROKE} strokeWidth="1.1" opacity="0.8"/></g>; })}
            <line x1={cx-handleWidth/6} y1={handleTopY} x2={cx-handleWidth/6} y2={handleBottomY} stroke={STROKE} strokeWidth="1" opacity="0.35"/>
            <line x1={cx+handleWidth/6} y1={handleTopY} x2={cx+handleWidth/6} y2={handleBottomY} stroke={STROKE} strokeWidth="1" opacity="0.35"/>
          </g>
        )}
        <rect x={cx-handleWidth/2} y={handleTopY} width={handleWidth} height={handleHeight} fill="none" stroke={STROKE} strokeWidth="2.2" rx={4}/>
        <rect x={cx-handleWidth/2-4} y={handleBottomY-4} width={handleWidth+8} height={12} rx={4} fill="#FFFFFF" stroke={STROKE} strokeWidth="2"/>
        <path d={`M ${cx-6} ${handleBottomY+8} Q ${cx-14} ${handleBottomY+26}, ${cx} ${handleBottomY+30} Q ${cx+14} ${handleBottomY+26}, ${cx+6} ${handleBottomY+8}`} fill="none" stroke={STROKE} strokeWidth="1.6"/>
      </g>
      {mode === "diagram" && (
        <g fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#6B6960">
          <line x1={cx-halfWidth} y1={topY-16} x2={cx+halfWidth} y2={topY-16} stroke="#4A4540" strokeWidth="1"/>
          <line x1={cx-halfWidth} y1={topY-22} x2={cx-halfWidth} y2={topY-10} stroke="#4A4540" strokeWidth="1"/>
          <line x1={cx+halfWidth} y1={topY-22} x2={cx+halfWidth} y2={topY-10} stroke="#4A4540" strokeWidth="1"/>
          <text x={cx} y={topY-24} textAnchor="middle">face width {widthMm}mm</text>
          <line x1={cx+halfWidth+18} y1={topY} x2={cx+halfWidth+18} y2={handleBottomY} stroke="#4A4540" strokeWidth="1"/>
          <text x={cx+halfWidth+26} y={(topY+handleBottomY)/2} transform={`rotate(90 ${cx+halfWidth+26} ${(topY+handleBottomY)/2})`} textAnchor="middle">total length {lengthMm}mm</text>
          <text x={cx} y={bridgeTopY+bridgeHeight/2+4} textAnchor="middle" fontSize="10" fill="#5A574C">{bridgeId==="closed"?"closed bridge":`${beamCount} ${beamOrientation} beam${beamCount>1?"s":""}`}</text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RACQUET ILLUSTRATION 3D — a product-photography-style render for the
// consumer-facing illustration mode, built on the same head/throat/handle
// geometry as RacquetDiagram (via the shared path helpers) so dimensions
// stay in sync with the spec view. Rebuilt to chase the specific visual
// cues a real studio photo has that flat gradients don't:
//   - A slight horizontal perspective skew on the head, so the silhouette
//     reads as a foreshortened 3D object rather than a flat front view.
//   - A dense checker-weave texture (small alternating light/dark cells)
//     for carbon/kevlar/graphene — real carbon fiber's woven look comes
//     from cell density, not a few crosshatch lines.
//   - A hard, thin rim-light tracing the lit side of the silhouette,
//     which is the single strongest "this is a real lit object" cue in
//     product photography, distinct from a soft gradient fill.
//   - A curved specular reflection band that follows the head's surface
//     curve (via a clipped diagonal stripe) instead of a static ellipse.
//   - A harder-edged, more directional cast shadow.
// (Superseded by the smooth one-piece-mold version below — texture grid
// removed, gradient-only shading retained.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RACQUET ILLUSTRATION 3D — a smooth, "one-piece mold" render for the
// consumer-facing illustration mode. Built on the same head/throat/handle
// geometry as RacquetDiagram (via the shared path helpers) so dimensions
// stay in sync with the spec view. Deliberately avoids any tiled/repeated
// geometry (no weave grid, no dot grid) on the face — real racquets with
// a painted or lacquered finish show a continuous molded surface, not a
// visible weave, and that's the look this version targets:
//   - The entire face is shaded with smooth, continuous gradients only —
//     no rects, no tiles, nothing that reads as "made of pieces."
//   - Material identity comes through via gradient tone and a gloss-
//     intensity-driven highlight, not a literal texture pattern.
//   - Head, throat, and handle are one continuous, unrotated silhouette
//     (the throat is sampled as a smooth taper from the head's actual
//     bottom width down to the handle width, with deliberate overlap at
//     each join). An earlier version rotated only the head to fake a
//     3/4 turn, which visually detached it from the throat and read as
//     "crooked" — the 3/4-turn feel now comes entirely from lighting
//     (the rim-light arc and off-center highlight), not from rotating
//     the geometry itself.
//   - A hard, thin rim-light traces the lit edge of the silhouette —
//     still the strongest "this is a lit 3D object" cue, kept from the
//     previous version since it reads as part of the molded edge, not a
//     separate decorative shape.
//   - A directional, blurred cast shadow grounds the object.
//   - Perforation holes remain as actual circular depressions (shadow +
//     well + highlight), since those are a real structural feature of
//     the racquet, not a surface texture choice.
// ---------------------------------------------------------------------------

function RacquetIllustration3D({
  shape,
  faceId,
  surfaceId,
  gripShapeId,
  holes,
  holeDiameterMm,
  lengthMm,
  widthMm,
  balanceCm,
  weightG,
  coreObj,
  faceObj,
  frameObj,
  bridgeId,
  beamCount,
  beamOrientation,
}) {
  const cx = 230, topY = 30, headHeight = 290;
  const halfWidth = Math.min(148, (widthMm / 260) * 148);

  // No independent rotation on the head — rotating only the head while
  // the throat/handle stayed fixed is what caused the "crooked face" and
  // "disconnected throat" problems. A real racquet photographed at an
  // angle turns as one rigid object; since the throat/handle need to
  // stay vertical for the rest of the UI's layout (dimension callouts,
  // consistent column alignment across all three view modes), the head
  // also stays unrotated here. The 3/4-turn feel now comes entirely
  // from lighting (the rim-light arc and off-center highlight below),
  // not from literally rotating the geometry.
  const outline = headOutlinePath(shape, cx, topY, halfWidth, headHeight);
  const innerOutline = headOutlinePath(shape, cx, topY + 6, halfWidth - 7, headHeight - 12);

  // Conservative approximation of the inner face's half-width at a given
  // vertical fraction (0=top tip, 1=bottom where the head meets the
  // throat), calibrated to sit safely INSIDE the true Bezier curve used
  // by headOutlinePath so holes placed against this bound can never
  // reach the rim — the earlier version used a flat margin subtraction
  // that didn't account for the head narrowing near the top/bottom tips,
  // which is exactly why holes were overlapping the edge there.
  const innerFaceHalfWidthFrac = (t: number) => {
    if (shape === "round") return Math.sin(t * Math.PI) * 0.92 + 0.06;
    if (shape === "diamond") return t < 0.32 ? (t / 0.32) * 0.94 : 0.94 - ((t - 0.32) / 0.68) * 0.5;
    if (shape === "diamond-wide") return t < 0.30 ? (t / 0.30) * 0.98 : 0.98 - ((t - 0.30) / 0.70) * 0.45;
    return t < 0.42 ? Math.sin((t / 0.42) * (Math.PI / 2)) * 0.93 : 0.93 - ((t - 0.42) / 0.58) * 0.45;
  };
  const sweet = computeSweetSpotAndStability({ shape, balanceCm, widthMm, weightG, core: coreObj, face: faceObj, frame: frameObj, bridgeId, beamOrientation, holes, holeDiameterMm, topY, headHeight, halfWidth });
  // Illustration mode uses its own, more strongly differentiated
  // tint/darkTone (see ILLUSTRATION_FACE_VISUAL) since this view has no
  // weave-line overlay to help distinguish materials the way the flat
  // spec diagram does — gloss and other fields still come from the
  // shared FACE_VISUAL table.
  const baseFaceVisual = FACE_VISUAL[faceId] || FACE_VISUAL["carbon-12k"];
  const illustTints = ILLUSTRATION_FACE_VISUAL[faceId] || ILLUSTRATION_FACE_VISUAL["carbon-12k"];
  const faceVisual = { ...baseFaceVisual, tint: illustTints.tint, darkTone: illustTints.darkTone };

  const headBottomY = topY + headHeight;
  const handleWidth = 26;
  const handleHeight = Math.max(120, Math.min(200, (lengthMm - 380) * 1.1 + 130));

  // The throat is now built the same way RacquetProfile builds its
  // silhouette: as a continuous tapering outline sampled point-by-point
  // from the head's actual bottom width down to the handle's width, so
  // there is no seam, gap, or separately-floating shape between head
  // and handle. throatHeight is the vertical span the taper covers.
  const throatHeight = 92;
  const throatTopY = headBottomY - 10; // slight overlap into the head so the join is invisible
  const throatBottomY = throatTopY + throatHeight;
  const handleTopY = throatBottomY - 6; // slight overlap into the throat for the same reason
  const handleBottomY = handleTopY + handleHeight;

  // Head half-width at its own bottom edge (where the throat taper
  // begins), sampled from the actual outline geometry rather than
  // assumed, so the join always matches the selected shape exactly.
  const headBottomHalfWidth = halfWidth * ((shape === "diamond" || shape === "diamond-wide") ? 0.5 : shape === "teardrop" ? 0.46 : 0.74);

  const throatHalfWidthAt = (y: number) => {
    const t = Math.max(0, Math.min(1, (y - throatTopY) / (throatBottomY - throatTopY)));
    // ease-out curve so the taper starts wide (matching the head) and
    // narrows smoothly into the handle width, with no abrupt corner
    const eased = 1 - Math.pow(1 - t, 2);
    return headBottomHalfWidth + (handleWidth / 2 - headBottomHalfWidth) * eased;
  };

  const innerNeckHalf = handleWidth / 2 + 3, outerThroatHalf = headBottomHalfWidth, throatMidY = (throatTopY + throatBottomY) / 2;
  const strutOffsets: number[] = [];
  if (bridgeId === "open") {
    if (beamCount === 1) strutOffsets.push(0);
    else if (beamCount === 2) { const g = innerNeckHalf * 0.55; strutOffsets.push(-g, g); }
    else { const g = innerNeckHalf * 0.65; strutOffsets.push(0, -g, g); }
    strutOffsets.sort((a, b) => a - b);
  }

  // Sample the full head + throat silhouette as one continuous path,
  // the same technique RacquetProfile uses, so the rendered outline has
  // zero seams between head and throat.
  const throatSamples: { x: number; y: number }[] = [];
  for (let y = throatTopY; y <= throatBottomY; y += 4) {
    throatSamples.push({ x: throatHalfWidthAt(y), y });
  }
  const throatOutlineRight = throatSamples.map((p) => `${cx + p.x},${p.y}`).join(" L ");
  const throatOutlineLeft = throatSamples.slice().reverse().map((p) => `${cx - p.x},${p.y}`).join(" L ");

  // Direct mapping from real hole coordinates onto this illustration's
  // pixel space — replaces the old procedural row/col grid + pattern-bias
  // generation. Each hole's normalized {x,y} maps onto the actual face
  // geometry, then gets clamped against the real shape-aware boundary at
  // that specific height (innerFaceHalfWidthFrac) so a hole clicked near
  // a teardrop's narrow tip or a diamond's taper still renders inside the
  // true outline rather than poking past the rim.
  const holeDots: { x: number; y: number }[] = [];
  const holeRadius = 6; // matches the rendered circle radius below
  const edgeMargin = 14; // minimum clearance kept between any hole's edge and the face rim
  (holes ?? []).forEach((h: HolePoint) => {
    const fy = topY + headHeight * 0.5 + h.y * (headHeight * 0.42);
    const rowT = Math.max(0, Math.min(1, (fy - topY) / headHeight));
    const realRowHalf = Math.max(8, halfWidth * innerFaceHalfWidthFrac(rowT) - edgeMargin);
    const placementHalf = Math.max(0, realRowHalf - holeRadius);
    const fx = cx + Math.max(-1, Math.min(1, h.x)) * placementHalf;
    holeDots.push({ x: fx, y: fy });
  });

  const frameDark = frameObj?.id === "fiberglass-frame" ? "#9A968A" : frameObj?.id === "basalt-frame" ? "#241A12" : "#0A0A0C";
  const frameLight = frameObj?.id === "fiberglass-frame" ? "#F5F2E8" : frameObj?.id === "basalt-frame" ? "#5A4030" : "#3A3A3E";
  const gripBase = gripShapeId === "hexagonal" ? "#E4DFCF" : "#F4F1E8";
  const approxPerimeter = 2 * (halfWidth + headHeight) * 1.05;

  return (
    <svg viewBox="0 0 460 660" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <clipPath id="illustHeadClip"><path d={outline} /></clipPath>
        <clipPath id="illustInnerClip"><path d={innerOutline} /></clipPath>

        <radialGradient id="faceGrad3d" cx="34%" cy="24%" r="95%">
          <stop offset="0%" stopColor={faceVisual.tint} />
          <stop offset="38%" stopColor={faceVisual.tint} />
          <stop offset="100%" stopColor={faceVisual.darkTone} />
        </radialGradient>

        <linearGradient id="rimGrad3d" x1="15%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor={frameLight} />
          <stop offset="45%" stopColor={frameDark} />
          <stop offset="100%" stopColor={frameDark} />
        </linearGradient>

        {/* Throat-specific gradient — deliberately brighter and more
            saturated than the frame rim gradient above. The previous
            version filled both the throat body AND the beam cutouts
            with near-identical near-black tones (#0A0A0C against a
            frameDark that's also #0A0A0C-ish for carbon), so the whole
            throat read as one undifferentiated blob. This gradient
            uses a visibly lighter gunmetal tone so the throat material
            itself is legible, and the open apertures (rendered as true
            cutouts via mask below, not a same-color shape drawn on top)
            show real contrast against it. */}
        <linearGradient id="throatGrad3d" x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={frameObj?.id === "fiberglass-frame" ? "#F0ECDE" : frameObj?.id === "basalt-frame" ? "#C49A6E" : "#A8A8B2"} />
          <stop offset="55%" stopColor={frameObj?.id === "fiberglass-frame" ? "#D4CEB8" : frameObj?.id === "basalt-frame" ? "#A07850" : "#86868E"} />
          <stop offset="100%" stopColor={frameObj?.id === "fiberglass-frame" ? "#B8B098" : frameObj?.id === "basalt-frame" ? "#825E3A" : "#68686E"} />
        </linearGradient>

        <linearGradient id="handleGrad3d" x1="8%" y1="0%" x2="92%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="22%" stopColor={gripBase} />
          <stop offset="60%" stopColor={gripBase} />
          <stop offset="100%" stopColor="#B9B19A" />
        </linearGradient>

        <radialGradient id="sweetSpotGlow3d" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1A5C2A" stopOpacity="0.65" />
          <stop offset="55%" stopColor="#1A5C2A" stopOpacity="0.35" />
          <stop offset="85%" stopColor="#1A5C2A" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#1A5C2A" stopOpacity="0" />
        </radialGradient>

        <filter id="shadowBlur3d" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* THROAT — built without any SVG <mask>, since masks have a real,
          documented history of inconsistent cross-browser support
          (notably Safari) and couldn't be verified rendering correctly
          in this environment. Instead, every beam configuration is
          built from explicit POSITIVE shapes only: solid outer rails
          plus the actual strut/crossbar pieces, with the open gaps
          being genuine empty space (nothing drawn there at all) rather
          than a cutout from a larger solid shape. This is the same
          technique already proven to work for the flat spec-view
          diagram's throat rendering. */}
      {bridgeId === "closed" ? (
        <path
          d={`M ${cx + headBottomHalfWidth},${throatTopY} L ${throatOutlineRight} L ${throatOutlineLeft} Z`}
          fill="url(#throatGrad3d)"
        />
      ) : (
        <g>
          {/* Outer side rails — present for every open-bridge
              orientation, since a real open throat always keeps a
              visible solid rim along its outer edges. */}
          <path
            d={`M ${cx - outerThroatHalf} ${throatTopY + 4} L ${cx - outerThroatHalf + 11} ${throatTopY + 4} L ${cx - innerNeckHalf + 4} ${throatBottomY - 2} L ${cx - innerNeckHalf} ${throatBottomY - 2} Z`}
            fill="url(#throatGrad3d)"
          />
          <path
            d={`M ${cx + outerThroatHalf} ${throatTopY + 4} L ${cx + outerThroatHalf - 11} ${throatTopY + 4} L ${cx + innerNeckHalf - 4} ${throatBottomY - 2} L ${cx + innerNeckHalf} ${throatBottomY - 2} Z`}
            fill="url(#throatGrad3d)"
          />

          {beamOrientation === "vertical" &&
            (() => {
              // Each strut is its own solid tapering quadrilateral,
              // running from the throat's top edge to the handle
              // collar — the gaps between them are simply the absence
              // of any shape, guaranteed visible regardless of mask
              // support.
              const positions = strutOffsets.length > 0 ? strutOffsets : [0];
              const strutTopPos = (offset: number) => (offset / innerNeckHalf) * outerThroatHalf;
              const strutHalfW = 7;
              return positions.map((offset, i) => {
                const topCenter = strutTopPos(offset);
                return (
                  <path
                    key={i}
                    d={`M ${cx + topCenter - strutHalfW} ${throatTopY + 4}
                        L ${cx + topCenter + strutHalfW} ${throatTopY + 4}
                        L ${cx + offset + strutHalfW * 0.6} ${throatBottomY - 2}
                        L ${cx + offset - strutHalfW * 0.6} ${throatBottomY - 2} Z`}
                    fill="url(#throatGrad3d)"
                  />
                );
              });
            })()}

          {beamOrientation === "horizontal" &&
            (() => {
              // One or two solid rounded crossbars spanning between the
              // side rails — real positive shapes with real empty space
              // above/below/between them.
              const rungCount = Math.min(beamCount, 2);
              const rungHeight = 12;
              const rungYs =
                rungCount === 1
                  ? [throatTopY + (throatBottomY - throatTopY) * 0.5]
                  : [throatTopY + (throatBottomY - throatTopY) * 0.32, throatTopY + (throatBottomY - throatTopY) * 0.68];
              return rungYs.map((y, i) => {
                const half = throatHalfWidthAt(y) - 11;
                return (
                  <rect
                    key={i}
                    x={cx - half}
                    y={y - rungHeight / 2}
                    width={half * 2}
                    height={rungHeight}
                    rx={rungHeight * 0.3}
                    fill="url(#throatGrad3d)"
                  />
                );
              });
            })()}

          {beamOrientation === "diagonal" &&
            (() => {
              // 1 beam: a solid V — two diagonal struts meeting at a
              // shared apex near the bottom center, each a real strip
              // of positive material. 2 beams: the same V, PLUS a
              // second crossing pair of strips forming the other
              // diagonal of the X — genuinely more material drawn, not
              // a re-angled version of the same two pieces, so 1-beam
              // and 2-beam read as clearly different structures.
              const strutHalfW = 7;
              const apexY = throatBottomY - 6;
              const topL = -outerThroatHalf + 11, topR = outerThroatHalf - 11;
              const diagonalStrut = (fromX: number, toX: number, toY: number) => {
                const dx = toX - fromX, dy = toY - (throatTopY + 4);
                const len = Math.hypot(dx, dy) || 1;
                const nx = (-dy / len) * strutHalfW, ny = (dx / len) * strutHalfW;
                return `M ${cx + fromX + nx} ${throatTopY + 4 + ny} L ${cx + fromX - nx} ${throatTopY + 4 - ny} L ${cx + toX - nx} ${toY - ny} L ${cx + toX + nx} ${toY + ny} Z`;
              };
              const struts = [
                <path key="v-left" d={diagonalStrut(topL, 0, apexY)} fill="url(#throatGrad3d)" />,
                <path key="v-right" d={diagonalStrut(topR, 0, apexY)} fill="url(#throatGrad3d)" />,
              ];
              if (beamCount >= 2) {
                struts.push(
                  <path key="x-left" d={diagonalStrut(topL, innerNeckHalf, throatBottomY - 8)} fill="url(#throatGrad3d)" />,
                  <path key="x-right" d={diagonalStrut(topR, -innerNeckHalf, throatBottomY - 8)} fill="url(#throatGrad3d)" />
                );
              }
              return struts;
            })()}
        </g>
      )}

      {/* HEAD — drawn on top of the throat's upper overlap, so the join
          is fully hidden; no rotation, so it stays perfectly aligned
          with the throat beneath it */}
      <path d={outline} fill="url(#rimGrad3d)" />
      <path d={innerOutline} fill="url(#faceGrad3d)" />

      {/* Surface texture — kept deliberately subtle (low opacity, small
          scale) since the face already carries the weave-free smooth
          finish, holes, and lighting; the goal is a felt difference on
          close inspection, not a busy/competing pattern. Smooth adds
          nothing (the material finish alone IS the smooth look).
          Rough gets a fine, randomly-scattered stipple — matching its
          real sandpaper-like grain. 3D-print gets a sparse, REGULAR
          grid of small raised dot-clusters — visually distinct from
          rough's randomness, matching real 3D-printed grip patterns'
          deliberate geometric repetition rather than random grain. */}
      {surfaceId === "rough" && (
        <g clipPath="url(#illustInnerClip)" opacity="0.22">
          {(() => {
            let seed = 11;
            const rand = () => {
              seed = (seed * 9301 + 49297) % 233280;
              return seed / 233280;
            };
            const dots = [];
            for (let i = 0; i < 90; i++) {
              dots.push({
                x: cx - halfWidth + rand() * halfWidth * 2,
                y: topY + rand() * headHeight,
                r: 0.6 + rand() * 0.7,
              });
            }
            return dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#000000" />);
          })()}
        </g>
      )}
      {surfaceId === "3d-print" && (
        <g clipPath="url(#illustInnerClip)" opacity="0.28">
          {(() => {
            const spacing = 24;
            const dots = [];
            let row = 0;
            for (let y = topY - spacing; y < topY + headHeight + spacing; y += spacing) {
              const xOffset = row % 2 === 0 ? 0 : spacing / 2;
              for (let x = cx - halfWidth - spacing; x < cx + halfWidth + spacing; x += spacing) {
                dots.push({ x: x + xOffset, y });
              }
              row++;
            }
            return dots.map((d, i) => (
              <g key={i}>
                <circle cx={d.x} cy={d.y + 0.4} r={1.8} fill="#000000" opacity="0.5" />
                <circle cx={d.x} cy={d.y} r={1.8} fill="#FFFFFF" opacity="0.6" />
              </g>
            ));
          })()}
        </g>
      )}

      <path
        d={outline}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        opacity="0.85"
        strokeDasharray={`${approxPerimeter * 0.22} ${approxPerimeter * 0.78}`}
        strokeDashoffset={approxPerimeter * 0.86}
      />

      <g clipPath="url(#illustInnerClip)">
        <ellipse
          cx={cx - halfWidth * 0.3}
          cy={topY + headHeight * 0.24}
          rx={halfWidth * 0.62}
          ry={headHeight * 0.38}
          fill="#FFFFFF"
          opacity={0.22 * faceVisual.gloss}
          transform={`rotate(-20 ${cx - halfWidth * 0.3} ${topY + headHeight * 0.24})`}
        />
        <ellipse
          cx={cx - halfWidth * 0.22}
          cy={topY + headHeight * 0.16}
          rx={halfWidth * 0.28}
          ry={headHeight * 0.16}
          fill="#FFFFFF"
          opacity={0.4 * faceVisual.gloss}
          transform={`rotate(-20 ${cx - halfWidth * 0.22} ${topY + headHeight * 0.16})`}
        />
      </g>

      <g clipPath="url(#illustInnerClip)">
        {holeDots.map((h, i) => (
          <g key={i}>
            <circle cx={h.x} cy={h.y + 0.8} r={6.8} fill="#000000" opacity="0.3" />
            <circle cx={h.x} cy={h.y} r={6} fill={faceVisual.darkTone} opacity="0.9" />
            <path d={`M ${h.x - 4.2} ${h.y - 3.4} A 5.2 5.2 0 0 1 ${h.x + 4.2} ${h.y - 3.4}`} fill="none" stroke="#FFFFFF" strokeWidth="1.1" opacity="0.5" strokeLinecap="round" />
          </g>
        ))}
      </g>

      <g clipPath="url(#illustInnerClip)">
        <circle cx={cx} cy={sweet.y} r={sweet.r * 1.3} fill="url(#sweetSpotGlow3d)" />
        {/* a defined boundary at the actual computed radius — the soft
            glow alone makes it hard to judge size precisely from one
            config to the next; this ring gives a concrete edge so
            changes in shape/stability/holes are visually legible, not
            just a vague brightness shift */}
        <circle cx={cx} cy={sweet.y} r={sweet.r} fill="none" stroke="#1A5C2A" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.85" />
      </g>

      <path d={headOutlinePath(shape, cx, topY + 3, halfWidth - 3, headHeight - 6)} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.2" />

      {/* HANDLE — fused to the throat's bottom the same way (slight
          overlap into throatBottomY above), continuous gradient fill */}
      <g>
        <rect x={cx - handleWidth / 2} y={handleTopY} width={handleWidth} height={handleHeight} fill="url(#handleGrad3d)" rx={6} />
        {gripShapeId === "hexagonal" ? (
          <g>
            <clipPath id="illustHexHandleClip">
              <rect x={cx - handleWidth / 2} y={handleTopY} width={handleWidth} height={handleHeight} rx={6} />
            </clipPath>
            <g clipPath="url(#illustHexHandleClip)" opacity="0.4">
              {(() => {
                const hexR = handleWidth / 4.2, hexW = hexR * 2, hexH = hexR * Math.sqrt(3), colStep = hexW * 0.75;
                const cells: { x: number; y: number }[] = [];
                let col = 0;
                for (let x = cx - handleWidth / 2 - hexW; x < cx + handleWidth / 2 + hexW; x += colStep) {
                  const yOffset = col % 2 === 0 ? 0 : hexH / 2;
                  for (let y = handleTopY - hexH; y < handleBottomY + hexH; y += hexH) cells.push({ x, y: y + yOffset });
                  col++;
                }
                const flatTopHex = (px, py, r) => {
                  const pts = [];
                  for (let i = 0; i < 6; i++) { const ang = (Math.PI / 3) * i; pts.push(`${px + r * Math.cos(ang)},${py + r * Math.sin(ang)}`); }
                  return pts.join(" ");
                };
                return cells.map((c, i) => <polygon key={i} points={flatTopHex(c.x, c.y, hexR * 0.96)} fill="none" stroke="#8A8268" strokeWidth="0.6" />);
              })()}
            </g>
          </g>
        ) : (
          <g opacity="0.32">
            {Array.from({ length: Math.ceil(handleHeight / 18) }).map((_, i) => {
              const y0 = handleTopY + i * 18, y1 = y0 + 18;
              if (y1 > handleBottomY) return null;
              return (
                <g key={i}>
                  <line x1={cx - handleWidth / 2} y1={y0} x2={cx + handleWidth / 2} y2={y1} stroke="#8A8268" strokeWidth="1.1" />
                  <line x1={cx - handleWidth / 2} y1={y1} x2={cx + handleWidth / 2} y2={y0} stroke="#8A8268" strokeWidth="1.1" />
                </g>
              );
            })}
          </g>
        )}
        <rect x={cx - handleWidth / 2} y={handleTopY} width={handleWidth} height={handleHeight} fill="none" stroke="#00000022" strokeWidth="1" rx={6} />
        <rect x={cx - handleWidth / 2 - 4} y={handleBottomY - 4} width={handleWidth + 8} height={14} rx={6} fill="url(#rimGrad3d)" />
        <path d={`M ${cx - 6} ${handleBottomY + 10} Q ${cx - 14} ${handleBottomY + 28}, ${cx} ${handleBottomY + 32} Q ${cx + 14} ${handleBottomY + 28}, ${cx + 6} ${handleBottomY + 10}`} fill="none" stroke="#E8E2D6" strokeWidth="2" opacity="0.6" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// UI PRIMITIVES
// ---------------------------------------------------------------------------

function SelectField({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "10px 12px", borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#DDD7C8", color: "#18181B",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14, cursor: "pointer", appearance: "auto",
        WebkitAppearance: "auto",
      }}
    >
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

function SliderField({ label, value, onChange, min, max, step = 1, suffix, explanation }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "#4A4540", fontFamily: "Inter, sans-serif" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#1A5C2A", fontWeight: 600 }}>{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#1A5C2A", height: 4, cursor: "pointer" }}
      />
      {explanation && <p style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, marginTop: 6, fontFamily: "Inter, sans-serif" }}>{explanation}</p>}
    </div>
  );
}

function ToggleGroup({ options, value, onChange, disabled }: { options: {id:any,label:string}[], value:any, onChange:(v:any)=>void, disabled?: (id:any)=>boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => {
        const isDisabled = disabled?.(o.id) ?? false;
        const isActive = value === o.id;
        return (
          <button
            key={o.id}
            disabled={isDisabled}
            onClick={() => onChange(o.id)}
            style={{
              flex: "1 1 auto", padding: "10px 10px", borderRadius: 8,
              border: `1px solid ${isActive ? "#1A5C2A" : "rgba(0,0,0,0.07)"}`,
              background: isActive ? "rgba(26,92,42,0.15)" : "rgba(0,0,0,0.035)",
              color: isDisabled ? "#B0A898" : isActive ? "#1A5C2A" : "#4A4540",
              fontSize: 12.5, fontWeight: 600, cursor: isDisabled ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif", transition: "all 0.15s ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RatingDots({ val, max = 5, color = "#1A5C2A" }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({length: max}).map((_,i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%",
          background: i < Math.round(val) ? color : "rgba(0,0,0,0.07)",
          transition: "background 0.2s ease",
        }}/>
      ))}
    </div>
  );
}

function ScoreBar({ label, val, max = 5 }) {
  const pct = (val / max) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: "#4A4540", fontFamily: "Inter, sans-serif" }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#1A5C2A", fontWeight: 600 }}>{val.toFixed(1)}</span>
      </div>
      <div style={{ height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #1A5C2A, #2D7A3A)", transition: "width 0.4s ease" }}/>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label, isOpen, onToggle, badge = null }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 0", background: "none", border: "none", cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: isOpen ? "#1A5C2A" : "#7A7268", transition: "color 0.2s" }}>{icon}</span>
        <span style={{
          fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: isOpen ? "#18181B" : "#4A4540", transition: "color 0.2s",
        }}>{label}</span>
        {badge && <span style={{ background: "rgba(26,92,42,0.15)", color: "#1A5C2A", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", padding: "2px 7px", borderRadius: 4 }}>{badge}</span>}
      </div>
      <ChevronDown size={16} color={isOpen ? "#1A5C2A" : "#B0A898"} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}/>
    </button>
  );
}

function AccordionSection({ id, icon, label, isOpen, onToggle, badge = null, children }) {
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
      <SectionHeader icon={icon} label={label} isOpen={isOpen} onToggle={onToggle} badge={badge}/>
      {isOpen && (
        <div style={{ paddingBottom: 20 }}>{children}</div>
      )}
    </div>
  );
}

function MiniRatingGrid({ items }: { items: {label:string, val:number}[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginTop: 12 }}>
      {items.map(({label, val}) => (
        <div key={label}>
          <div style={{ fontSize: 11, color: "#7A7268", marginBottom: 4, fontFamily: "Inter, sans-serif" }}>{label}</div>
          <RatingDots val={val}/>
        </div>
      ))}
    </div>
  );
}

function MaterialNote({ text }) {
  return <p style={{ fontSize: 13, color: "#7A7268", lineHeight: 1.6, marginTop: 10, fontFamily: "Inter, sans-serif" }}>{text}</p>;
}

function ManufacturingNote({ text }) {
  if (!text) return null;
  return (
    <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(26,92,42,0.05)", borderRadius: 6, borderLeft: "2px solid #1A5C2A" }}>
      <div style={{ fontSize: 9.5, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1A5C2A", marginBottom: 3 }}>Manufacturing</div>
      <p style={{ fontSize: 12, color: "#4A4540", lineHeight: 1.55, margin: 0, fontFamily: "Inter, sans-serif" }}>{text}</p>
    </div>
  );
}

function BestForTag({ text }) {
  if (!text) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "6px 10px", background: "rgba(0,212,240,0.08)", borderRadius: 6, border: "1px solid rgba(0,212,240,0.15)" }}>
      <CheckCircle2 size={12} color="#166534"/>
      <span style={{ fontSize: 12, color: "#166534", fontFamily: "Inter, sans-serif" }}>{text}</span>
    </div>
  );
}

function FTOWarning() {
  return (
    <div style={{ display:"flex", gap:8, padding:"10px 12px", background:"#FEF3C7", border:"1px solid #D97706", borderRadius:8, marginTop:12 }}>
      <AlertTriangle size={14} color="#D97706" style={{flexShrink:0, marginTop:1}}/>
      <p style={{ fontSize:12, color:"#92400E", lineHeight:1.5, fontFamily:"Inter, sans-serif", margin:0 }}>
        This spec touches features flagged in IP landscape research (perforation pattern, graphene/kevlar composite, or hybrid core). Confirm freedom-to-operate with patent counsel before production.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONSUMER QUESTIONNAIRE
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SMART FINDER — QUESTION DATA
// Organized into short, clearly-labeled sections rather than one flat
// list (chunking reduces the decision fatigue documented in choice-
// architecture research). Sections D (advanced-only) only render when
// the player has selected "Advanced" in Section 1, so beginners never
// see questions irrelevant to them.
// ---------------------------------------------------------------------------

const FINDER_SECTION_1 = [
  {
    id: "racquetBackground",
    label: "Racquet-sport background",
    question: "Have you played other racquet sports before padel?",
    options: [
      { id: "none", label: "None" },
      { id: "tennis", label: "Tennis" },
      { id: "squash", label: "Squash" },
      { id: "badminton", label: "Badminton / table tennis" },
      { id: "multiple", label: "Multiple" },
    ],
  },
  {
    id: "level",
    label: "Your level",
    question: "How would you describe your padel level?",
    options: [
      { id: "beginner", label: "Beginner" },
      { id: "intermediate", label: "Intermediate" },
      { id: "advanced", label: "Advanced" },
    ],
  },
  {
    id: "frequency",
    label: "Frequency",
    question: "How often are you playing right now?",
    options: [
      { id: "starting", label: "Just started" },
      { id: "monthly", label: "A few times a month" },
      { id: "weekly", label: "Weekly" },
      { id: "multiple-weekly", label: "Multiple times a week" },
    ],
  },
];

const FINDER_SECTION_2 = [
  {
    id: "handSize",
    label: "Hand reference",
    question: "Pick the description closest to your hand.",
    options: [
      { id: "small", label: "Small / narrow hand" },
      { id: "medium", label: "Medium" },
      { id: "large", label: "Large hand" },
    ],
  },
  {
    id: "injuryHistory",
    label: "Injury history",
    question: "Any current or recurring elbow, wrist, or shoulder discomfort?",
    options: [
      { id: "none", label: "No" },
      { id: "mild", label: "Mild, occasional" },
      { id: "ongoing", label: "Yes, ongoing or diagnosed" },
    ],
  },
  {
    id: "armCare",
    label: "Arm comfort priority",
    question: "Even without an injury, how important is arm-friendly construction to you?",
    options: [
      { id: "not-priority", label: "Not a priority — I want the best performing spec for my game" },
      { id: "nice-to-have", label: "Nice to have, but performance comes first" },
      { id: "priority", label: "Important — I proactively want a comfortable build to protect my arm" },
    ],
  },
  {
    id: "availablePower",
    label: "Available power",
    question: "When you swing freely, your shots tend to be...",
    options: [
      { id: "powerful", label: "Naturally powerful — I hold back for control" },
      { id: "even", label: "Pretty even" },
      { id: "limited", label: "I have to work to generate pace" },
    ],
  },
];

const FINDER_SECTION_3 = [
  {
    id: "netInstinct",
    label: "Forced scenario",
    question: "A ball comes fast and slightly off-center at the net. Your instinct is to...",
    options: [
      { id: "block", label: "Block it back safely" },
      { id: "redirect", label: "Redirect it with pace" },
      { id: "winner", label: "Take a big swing for the winner" },
    ],
  },
  {
    id: "goal",
    label: "Goals",
    question: "What are you mainly trying to improve right now?",
    options: [
      { id: "consistency", label: "Consistency / fewer errors" },
      { id: "power", label: "Power on smashes / overheads" },
      { id: "defense", label: "Defense at the net" },
      { id: "versatility", label: "Overall versatility" },
    ],
  },
  {
    id: "spinInterest",
    label: "Spin interest",
    question: "Do you actively try to add spin (slice, topspin), or mostly hit flat?",
    options: [
      { id: "flat", label: "Mostly flat" },
      { id: "some", label: "Sometimes" },
      { id: "high", label: "Yes, spin is a big part of my game" },
    ],
  },
];

const FINDER_FEEL_FORK = {
  id: "feelPreference",
  label: "The feel fork",
  question:
    "Two racquets, same weight and shape. One has a smoother face that holds the ball a touch longer before release — many players describe it as feeling \"controlled\" or \"glued.\" The other has a grippier, textured face that releases the ball faster with more bite and spin, but feels less forgiving if your timing is slightly off. Which sounds more like you?",
  options: [
    { id: "smooth", label: "Smoother / held" },
    { id: "grippy", label: "Grippier / faster release" },
    { id: "unsure", label: "Not sure — explain more" },
  ],
};

const FINDER_SECTION_5 = [
  {
    id: "sessionLength",
    label: "Session length",
    question: "How long are your typical sessions?",
    options: [
      { id: "short", label: "Under an hour" },
      { id: "medium", label: "1-2 hours" },
      { id: "long", label: "2+ hours or multiple matches" },
    ],
  },
  {
    id: "budgetTier",
    label: "Budget",
    question: "What's your approximate budget for a racket?",
    options: [
      { id: "budget", label: "Under $120 — value matters most" },
      { id: "mid", label: "$120-$250 — good mid-range" },
      { id: "premium", label: "$250+ — I want the best spec for my game" },
    ],
  },
];

// --- Advanced-only sections (gated behind level === "advanced") ---

const FINDER_SECTION_A = [
  {
    id: "courtPosition",
    label: "Court position",
    question: "Which side do you usually play?",
    options: [
      { id: "drive", label: "Right / drive (back-court, point-building)" },
      { id: "reves", label: "Left / reves (net-finishing, overheads)" },
      { id: "both", label: "Both, depending on partner" },
    ],
  },
  {
    id: "pointStyle",
    label: "Point construction",
    question: "In a rally, you're usually the one who...",
    options: [
      { id: "builder", label: "Builds the point patiently from the back" },
      { id: "finisher", label: "Looks to finish quickly once given an opening" },
      { id: "adaptive", label: "Reads and reacts — I adapt to whatever the point gives me" },
    ],
  },
  {
    id: "biggestWeapon",
    label: "Biggest weapon",
    question: "If you had to pick one shot that wins you the most points right now...",
    options: [
      { id: "smash", label: "Smash / overhead" },
      { id: "bandeja", label: "Bandeja or vibora" },
      { id: "lob", label: "Lob" },
      { id: "volley", label: "Net volleys" },
      { id: "depth", label: "Consistent baseline depth" },
    ],
  },
];

const FINDER_SECTION_B = [
  {
    id: "hasModifications",
    label: "Current setup",
    question: "Do you currently play with any racket modifications (added weight, lead/tungsten tape, custom grip)?",
    options: [
      { id: "stock", label: "No, stock racket" },
      { id: "added-weight", label: "Yes, I've added weight" },
      { id: "other-mod", label: "Yes, changed grip or balance another way" },
    ],
  },
  {
    id: "feelSensitivity",
    label: "Sensitivity to change",
    question: "Have you ever switched rackets mid-season and immediately felt the difference in balance or stiffness?",
    options: [
      { id: "instant", label: "Yes, instantly" },
      { id: "delayed", label: "Yes, but it took a session or two" },
      { id: "no", label: "No, I don't notice much difference" },
    ],
  },
];

// modPlacement is a conditional follow-up, only shown if hasModifications === "added-weight"
const FINDER_MOD_PLACEMENT = {
  id: "modPlacement",
  label: "Weight placement",
  question: "Where did you add weight?",
  options: [
    { id: "head", label: "Head (more power, more swing weight)" },
    { id: "handle", label: "Handle / throat (more stability, less swing weight)" },
  ],
};

const FINDER_SECTION_D = {
  id: "techFeel",
  label: "Brand technology",
  question:
    "Some brands build their \"comfort\" technology into the core (foam/internal dampening — e.g. Babolat's Vibrabsorb), others build it into the frame/bridge (e.g. basalt reinforcement, triangulated bridges), and others into the grip. If you've felt a difference between these, which gave you the most noticeable comfort improvement?",
  options: [
    { id: "core", label: "Core-based dampening" },
    { id: "frame", label: "Frame or bridge reinforcement" },
    { id: "grip", label: "Grip-based" },
    { id: "uncompared", label: "Haven't compared" },
    { id: "unsure", label: "Not sure what these mean" },
  ],
};

// Conditional, answer-specific follow-up text for the brand-technology
// question — only the explanation matching what they actually picked is
// shown. Named examples span multiple brands per mechanism so no single
// brand reads as the one being promoted.
const TECH_FEEL_FOLLOWUPS = {
  core: "That's a comfort system built into the core and handle — elastomers absorb vibration right at the source, before it travels far through the frame. Several brands take this approach (Babolat's Vibrabsorb, StarVie and others using Noene-type viscoelastic inserts factory-built into the handle). It tends to pair with a smoother, softer-feeling face, which tracks with what you felt: great for comfort, but some players feel like the ball releases too fast to really \"hold\" and shape a shot. If that tradeoff has bothered you, it's worth comparing rougher or more textured faces from brands using the same core philosophy — same dampening approach, more bite.",
  frame: "That's a stiffness-based fix rather than an absorption-based one — reinforcement at the bridge or throat (basalt fiber blends, like those used in Bullpadel's Vertex Core and other brands' basalt-reinforced bridges, or triangulated/diagonal bridge geometry) resists the frame flexing or twisting on contact, instead of soaking up vibration after the fact. That's why it feels more solid and direct, especially on off-center hits, rather than cushioned. If you want more of that feeling, look specifically at bridge construction and frame material across brands — that's the lever, more than the core.",
  grip: "That's a viscoelastic or anti-shock grip insert doing the work — it catches vibration at the very last step, right before it reaches your hand, rather than stopping it earlier in the frame or core. This is the category brands like Noene (used as a factory-integrated layer by StarVie and others, and sold separately as an aftermarket undergrip) and Bullpadel's Hesacore specialize in. The racket itself can still feel lively through the swing, but your hand and forearm specifically feel shielded. If your discomfort is really centered in the gripping hand rather than general arm fatigue, this is the most surgical fix, and it's worth comparing grip material specifically, even if the core and frame differ.",
  unsure: "Quick breakdown, since it's useful before comparing specific models: Core-based dampening (e.g. Babolat's Vibrabsorb, or Noene-type inserts built into the handle by StarVie and others) absorbs vibration at the source, inside the core and handle — usually paired with a smoother face, which trades some ball-bite for comfort. Frame or bridge reinforcement (e.g. basalt fiber blends like Bullpadel's Vertex Core, or triangulated bridges) resists the frame flexing or twisting in the first place, so it feels more solid and direct rather than cushioned. Grip-based damping (Noene's anti-shock undergrip, Bullpadel's Hesacore) catches vibration at the last step, right before it reaches your hand, so the racket can still feel lively but your hand stays shielded. If one of these sounds like something you've felt before, that's a good thread to pull on next time you're comparing models.",
  // "uncompared" intentionally has no entry — no follow-up is shown.
};

function FindRacquetPanel({ onApply, mode }) {
  // Single answers map, keyed by question id, instead of one useState
  // per question — this is what makes the section list data-driven.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState(false);

  const setAnswer = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
    setApplied(false);
  };

  const isAdvanced = answers.level === "advanced";

  // Core questions required before the button activates — kept to the
  // questions every player sees, so beginners aren't blocked on
  // advanced-only fields that never render for them.
  const requiredIds = ["racquetBackground", "level", "frequency", "handSize", "injuryHistory", "armCare", "availablePower", "netInstinct", "goal", "spinInterest", "feelPreference", "sessionLength", "budgetTier"];
  const canApply = requiredIds.every(id => answers[id]);

  const handleApply = () => {
    if (!canApply) return;
    onApply(answers);
    setApplied(true);
  };

  const QRow = ({ q }: { q: { id: string; label: string; question: string; options: { id: string; label: string }[] } }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>{q.label}</div>
      <p style={{ fontSize: 13, color: "#4A4540", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 8px" }}>{q.question}</p>
      <ToggleGroup options={q.options} value={answers[q.id] ?? null} onChange={v => setAnswer(q.id, v)} />
    </div>
  );

  const SectionDivider = ({ label }: { label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 14px" }}>
      <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1A5C2A", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
    </div>
  );

  // Follow-up text shown beneath the feel-fork question only when the
  // player picks "unsure" — gives them a felt-physics anchor before
  // moving on, without slowing down players who already have a preference.
  const feelUnsureFollowup =
    "If you're not sure: a smoother face holds the ball a beat longer before release, which gives you more time to feel and direct the shot — but some players feel like the ball \"slides\" rather than bites. A grippier, textured face releases faster with more spin potential, but punishes mistimed contact more. There's no wrong answer here — it's worth testing both if you can.";

  return (
    <div>
      {mode === "player" && (
        <div style={{ padding:"14px 16px", background:"linear-gradient(135deg, #EAF3EC, rgba(0,212,240,0.06))", borderRadius:10, border:"1px solid rgba(26,92,42,0.25)", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <Sparkles size={14} color="#1A5C2A"/>
            <span style={{ fontSize:13, fontWeight:700, color:"#1A5C2A", fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:"0.06em", textTransform:"uppercase" }}>Smart Finder</span>
          </div>
          <p style={{ fontSize:12.5, color:"#4A4540", lineHeight:1.5, fontFamily:"Inter, sans-serif", margin:0 }}>
            A deeper set of questions across a few short sections — covering background, body, goals, and feel — so the recommendation actually fits you, not just a category. Advanced players get a few extra questions for finer tuning.
          </p>
        </div>
      )}

      <SectionDivider label="Background" />
      {FINDER_SECTION_1.map(q => <QRow key={q.id} q={q} />)}

      <SectionDivider label="Body & physical history" />
      {FINDER_SECTION_2.map(q => <QRow key={q.id} q={q} />)}

      <SectionDivider label="Play style & goals" />
      {FINDER_SECTION_3.map(q => <QRow key={q.id} q={q} />)}

      <SectionDivider label="The feel fork" />
      <QRow q={FINDER_FEEL_FORK} />
      {answers.feelPreference === "unsure" && (
        <p style={{ fontSize: 12.5, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", marginTop: -8, marginBottom: 16 }}>
          {feelUnsureFollowup}
        </p>
      )}

      <SectionDivider label="Practical constraints" />
      {FINDER_SECTION_5.map(q => <QRow key={q.id} q={q} />)}

      {isAdvanced && (
        <>
          <SectionDivider label="Role & tactical fit (advanced)" />
          {FINDER_SECTION_A.map(q => <QRow key={q.id} q={q} />)}

          <SectionDivider label="Fine-tuning (advanced)" />
          {FINDER_SECTION_B.map(q => <QRow key={q.id} q={q} />)}
          {answers.hasModifications === "added-weight" && (
            <QRow q={FINDER_MOD_PLACEMENT} />
          )}

          <SectionDivider label="Brand technology (advanced)" />
          <QRow q={FINDER_SECTION_D} />
          {answers.techFeel && TECH_FEEL_FOLLOWUPS[answers.techFeel] && (
            <p style={{ fontSize: 12.5, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", marginTop: -8, marginBottom: 16 }}>
              {TECH_FEEL_FOLLOWUPS[answers.techFeel]}
            </p>
          )}
        </>
      )}

      <button
        onClick={handleApply}
        disabled={!canApply}
        style={{
          width:"100%", padding:"14px 16px", borderRadius:10, border:"none",
          background: canApply ? "linear-gradient(135deg, #1A5C2A, #2D7A3A)" : "rgba(0,0,0,0.045)",
          color: canApply ? "#FFFFFF" : "#B0A898",
          fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:15,
          letterSpacing:"0.08em", textTransform:"uppercase", cursor: canApply ? "pointer" : "not-allowed",
          marginTop:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          WebkitTapHighlightColor:"transparent",
        }}
      >
        {applied ? <><CheckCircle2 size={16}/> Spec Applied</> : <>Build My Racquet <ArrowRight size={16}/></>}
      </button>

      {!canApply && (
        <p style={{ textAlign:"center", fontSize:11.5, color:"#7A7268", marginTop:8, fontFamily:"Inter, sans-serif" }}>
          Answer the questions above (advanced sections are optional) to unlock your recommendation.
        </p>
      )}

      {applied && (
        <p style={{ textAlign:"center", fontSize:12.5, color:"#7A7268", marginTop:10, fontFamily:"Inter, sans-serif" }}>
          Spec applied — scroll to Build to fine-tune any option.
        </p>
      )}
    </div>
  );
}

function FactoryBriefPanel({ onApply }) {
  const [level, setLevel] = useState<string | null>(null);
  const [priceTier, setPriceTier] = useState<string | null>(null);
  const [targetRetailPrice, setTargetRetailPrice] = useState("");
  const [needGap, setNeedGap] = useState("");
  const [explicitShape, setExplicitShape] = useState<string | null>(null);
  const [explicitBridge, setExplicitBridge] = useState<string | null>(null);
  const [explicitBeamOrientation, setExplicitBeamOrientation] = useState<string | null>(null);
  const [explicitSurface, setExplicitSurface] = useState<string | null>(null);
  const [references, setReferences] = useState<{ racquetId: string; draws: string[]; avoid: string[] }[]>([]);
  const [priority, setPriority] = useState<string | null>(null);
  const [materialCommitment, setMaterialCommitment] = useState("");
  const [durabilityExpectation, setDurabilityExpectation] = useState<string | null>(null);
  const [tooling, setTooling] = useState<string | null>(null);
  const [existingShapeId, setExistingShapeId] = useState<string | null>(null);
  const [existingMoldRacquetId, setExistingMoldRacquetId] = useState<string | null>(null);
  const [whatToFix, setWhatToFix] = useState("");
  const [targetVolume, setTargetVolume] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [lastResult, setLastResult] = useState<{ spec: any; rationale: string[]; alternatives: FactoryBriefAlternative[] } | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>("material-first");

  const LEVEL_OPTIONS = [
    { id: "beginner", label: "Beginner" },
    { id: "intermediate", label: "Intermediate" },
    { id: "advanced", label: "Advanced" },
  ];
  const PRICE_TIER_OPTIONS = [
    { id: "budget", label: "Budget" },
    { id: "mid", label: "Mid" },
    { id: "premium", label: "Premium" },
  ];
  const PRIORITY_OPTIONS = [
    { id: "control", label: "Control-first" },
    { id: "power", label: "Power-first" },
    { id: "comfort", label: "Comfort-first" },
    { id: "balanced", label: "Balanced all-rounder" },
  ];
  const DURABILITY_OPTIONS = [
    { id: "standard", label: "Standard for this tier" },
    { id: "extended", label: "Extended — build it to last" },
  ];
  const QUALITY_OPTIONS = [
    { id: "sweetSpot", label: "Sweet spot" },
    { id: "comfort", label: "Comfort" },
    { id: "power", label: "Power" },
    { id: "control", label: "Control" },
    { id: "balanceFeel", label: "Balance feel" },
  ];
  const TOOLING_OPTIONS = [
    { id: "new-mold", label: "New mold" },
    { id: "existing-mold", label: "Existing mold" },
  ];
  const VOLUME_OPTIONS = [
    { id: "custom", label: "Custom / Bespoke" },
    { id: "retail", label: "Retail Distribution" },
  ];

  const toggleReference = (racquetId: string) => {
    setReferences((prev) => {
      const exists = prev.find((r) => r.racquetId === racquetId);
      if (exists) return prev.filter((r) => r.racquetId !== racquetId);
      if (prev.length >= 3) return prev; // cap at 3 references, keeps the blend logic meaningful rather than averaging across too many sources
      return [...prev, { racquetId, draws: [], avoid: [] }];
    });
    setApplied(false);
  };

  const toggleDraw = (racquetId: string, quality: string) => {
    setReferences((prev) =>
      prev.map((r) => {
        if (r.racquetId !== racquetId) return r;
        const has = r.draws.includes(quality);
        // mutually exclusive with avoid — a quality can't be both drawn
        // from and deliberately avoided on the same reference
        return { ...r, draws: has ? r.draws.filter((d) => d !== quality) : [...r.draws, quality], avoid: r.avoid.filter((d) => d !== quality) };
      })
    );
    setApplied(false);
  };

  const toggleAvoid = (racquetId: string, quality: string) => {
    setReferences((prev) =>
      prev.map((r) => {
        if (r.racquetId !== racquetId) return r;
        const has = r.avoid.includes(quality);
        return { ...r, avoid: has ? r.avoid.filter((d) => d !== quality) : [...r.avoid, quality], draws: r.draws.filter((d) => d !== quality) };
      })
    );
    setApplied(false);
  };

  const canApply = !!(level && priceTier && priority && durabilityExpectation && tooling && targetVolume && (tooling !== "existing-mold" || (existingMoldRacquetId && existingShapeId)));

  const handleApply = () => {
    if (!canApply) return;
    try {
      console.log("[FactoryBrief] Starting engine...");
      const result = computeFactoryBriefWithAlternatives({
        level: level as any,
        priceTier: priceTier as any,
        targetRetailPrice: targetRetailPrice ? Number(targetRetailPrice) : undefined,
        needGap,
        whatToFix: whatToFix || undefined,
        existingMoldRacquetId: existingMoldRacquetId || undefined,
        explicitShape: explicitShape || undefined,
        explicitBridge: explicitBridge || undefined,
        explicitBeamOrientation: explicitBeamOrientation || undefined,
        explicitSurface: explicitSurface || undefined,
        references,
        priority: priority as any,
        materialCommitment: materialCommitment || undefined,
        durabilityExpectation: durabilityExpectation as any,
        tooling: tooling as any,
        existingShapeId: existingShapeId || undefined,
        targetVolume: targetVolume as any,
      });
      setLastResult(result);
      // Auto-select first alternative and apply it to the Build tab
      if (result.alternatives.length > 0) {
        const firstAlt = result.alternatives[0];
        setSelectedTrack(firstAlt.trackId);
        onApply(firstAlt.spec);
      } else {
        onApply(result.spec);
      }
      setApplied(true);
    } catch (err) {
      console.error("Factory Brief engine error:", err);
      setLastResult({ spec: {} as any, rationale: [`Engine error: ${err instanceof Error ? err.message : String(err)}`], alternatives: [] });
      setApplied(true); // must set true so the error message actually renders
    }
  };

  const SectionDivider = ({ label, step }: { label: string; step: number }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 14px" }}>
      <span style={{
        width: 20, height: 20, borderRadius: "50%", background: "rgba(26,92,42,0.15)", border: "1px solid rgba(26,92,42,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, color: "#1A5C2A",
        fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
      }}>{step}</span>
      <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1A5C2A", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
    </div>
  );

  return (
    <div>
      <div style={{ padding: "14px 16px", background: "linear-gradient(135deg, #EAF3EC, rgba(0,212,240,0.06))", borderRadius: 10, border: "1px solid rgba(26,92,42,0.25)", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Wrench size={14} color="#1A5C2A" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1A5C2A", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>Factory Brief</span>
        </div>
        <p style={{ fontSize: 12.5, color: "#4A4540", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: 0 }}>
          A product brief, not a player quiz — start from positioning, name the competitive set you're benchmarking against, pick one forced priority, then lock in real-world constraints. Durability is handled as a constraint underneath whatever priority you pick, not a competing goal.
        </p>
      </div>

      <SectionDivider label="Production Reality" step={1} />
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>Tooling</div>
        <ToggleGroup options={TOOLING_OPTIONS} value={tooling} onChange={(v) => {
          setTooling(v);
          if (v !== "existing-mold") { setExistingShapeId(null); setExistingMoldRacquetId(null); setWhatToFix(""); }
          if (v === "existing-mold") { setExplicitShape(null); } // shape will come from mold selection instead
          setApplied(false);
        }} />
        {tooling === "existing-mold" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 10px" }}>
              Pick the racquet whose shell you're working within. Shape, width, and thickness lock automatically from this selection — the brief then focuses on what you're changing inside that shell.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MARKET_RACQUETS.map((r) => {
                const isSelected = existingMoldRacquetId === r.id;
                return (
                  <button key={r.id} onClick={() => {
                    setExistingMoldRacquetId(r.id);
                    setExistingShapeId(r.shapeId);
                    setApplied(false);
                  }} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                    WebkitTapHighlightColor: "transparent",
                    border: `1px solid ${isSelected ? "rgba(26,92,42,0.45)" : "rgba(0,0,0,0.05)"}`,
                    background: isSelected ? "rgba(174,251,0,0.07)" : "rgba(0,0,0,0.015)",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: isSelected ? "#1A5C2A" : "#18181B", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>{r.brand} {r.model}</div>
                      <div style={{ fontSize: 11, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                        {r.shapeId} · {r.weightG}g · {r.balanceCm}cm · {r.thicknessMm}mm
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 size={15} color="#1A5C2A" />}
                  </button>
                );
              })}
            </div>
            {existingMoldRacquetId && (() => {
              const mold = MARKET_RACQUETS.find(r => r.id === existingMoldRacquetId)!;
              return (
                <div style={{ marginTop: 14, padding: "12px", background: "#F2F8F3", border: "1px solid rgba(26,92,42,0.25)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#1A5C2A", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Shell locked from this mold</div>
                  <div style={{ fontSize: 12, color: "#4A4540", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
                    Shape: <strong style={{color:"#18181B"}}>{mold.shapeId}</strong> · Weight: <strong style={{color:"#18181B"}}>{mold.weightG}g</strong> · Balance: <strong style={{color:"#18181B"}}>{mold.balanceCm}cm</strong> · Thickness: <strong style={{color:"#18181B"}}>{mold.thicknessMm}mm</strong><br/>
                    Current spec: {mold.coreId} core · {mold.faceId} face · {mold.frameId} frame
                  </div>
                </div>
              );
            })()}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 4 }}>What are you trying to fix or improve from this shell? <span style={{ color: "#7A7268", textTransform: "none", fontWeight: 400 }}>(optional)</span></div>
              <textarea value={whatToFix} onChange={(e) => { setWhatToFix(e.target.value); setApplied(false); }}
                placeholder="e.g. too much vibration for the club player segment, needs a softer feel without losing the diamond's power ceiling"
                style={{ width: "100%", minHeight: 60, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "#DDD7C8", color: "#18181B", fontFamily: "Inter, sans-serif", fontSize: 13, resize: "vertical" }} />
            </div>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 4 }}>Target volume</div>
        <p style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 8px" }}>Custom: spec locked to a specific recipient — pro player, team, academy, signature edition. Retail: open inventory that needs to make margin at the price point.</p>
        <ToggleGroup options={VOLUME_OPTIONS} value={targetVolume} onChange={(v) => { setTargetVolume(v); setApplied(false); }} />
      </div>

      <SectionDivider label="Positioning" step={2} />
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>Target level</div>
        <ToggleGroup options={LEVEL_OPTIONS} value={level} onChange={(v) => { setLevel(v); setApplied(false); }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>Price tier</div>
        <ToggleGroup options={PRICE_TIER_OPTIONS} value={priceTier} onChange={(v) => { setPriceTier(v); setApplied(false); }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>Target retail price <span style={{ color: "#7A7268", textTransform: "none", fontWeight: 400 }}>(optional — a real number when known, refines but doesn't replace the price tier above)</span></div>
        <input
          type="number"
          value={targetRetailPrice}
          onChange={(e) => { setTargetRetailPrice(e.target.value); setApplied(false); }}
          placeholder="e.g. 120"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.08)", background: "#DDD7C8", color: "#18181B",
            fontFamily: "Inter, sans-serif", fontSize: 13,
          }}
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>What gap or need is this racquet filling? <span style={{ color: "#7A7268", textTransform: "none", fontWeight: 400 }}>(optional, carried into the rationale for context)</span></div>
        <textarea
          value={needGap}
          onChange={(e) => setNeedGap(e.target.value)}
          placeholder="e.g. a genuinely durable entry racquet that doesn't feel cheap"
          style={{
            width: "100%", minHeight: 60, padding: "10px 12px", borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.08)", background: "#DDD7C8", color: "#18181B",
            fontFamily: "Inter, sans-serif", fontSize: 13, resize: "vertical",
          }}
        />
      </div>

      {tooling !== "existing-mold" && (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 4 }}>Lock a specific shape? <span style={{ color: "#7A7268", textTransform: "none", fontWeight: 400 }}>(optional — if selected, the engine achieves your priority goals WITHIN this shape through materials and balance, not by overriding it)</span></div>
        <p style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 8px" }}>
          Leave blank to let the engine choose. Select a shape to lock it — e.g. "control priority + diamond shape" produces a control-oriented diamond (tamed through balance, core softness, and face flex), not a round racquet.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ id: null, label: "Engine decides" }, ...SHAPES.map((s) => ({ id: s.id, label: s.label }))].map((opt) => (
            <button
              key={opt.id ?? "auto"}
              onClick={() => { setExplicitShape(opt.id); setApplied(false); }}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                fontFamily: "Inter, sans-serif", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                border: `1px solid ${explicitShape === opt.id ? "rgba(26,92,42,0.6)" : "rgba(0,0,0,0.07)"}`,
                background: explicitShape === opt.id ? "#EAF3EC" : "rgba(0,0,0,0.035)",
                color: explicitShape === opt.id ? "#1A5C2A" : "#4A4540",
              }}
            >{opt.label}</button>
          ))}
        </div>
      </div>
      )}
      {tooling === "existing-mold" && existingMoldRacquetId && (
        <div style={{ marginBottom: 18, padding: "10px 12px", background: "rgba(0,0,0,0.025)", border: "1px solid rgba(0,0,0,0.045)", borderRadius: 8 }}>
          <div style={{ fontSize: 11.5, color: "#7A7268", fontFamily: "Inter, sans-serif" }}>Shape locked from mold selection above — the "lock a shape" option only applies to new-mold briefs.</div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 4 }}>Lock a bridge type? <span style={{ color: "#7A7268", textTransform: "none", fontWeight: 400 }}>(optional — if not selected, extended durability may auto-set this)</span></div>
        <p style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 8px" }}>
          Leave blank to let the engine decide. Select explicitly to prevent durability logic from overriding your design intent.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ id: null, label: "Engine decides" }, ...BRIDGE_TYPES.map((b) => ({ id: b.id, label: b.label }))].map((opt) => (
            <button key={opt.id ?? "auto"} onClick={() => { setExplicitBridge(opt.id); if (opt.id === "closed") setExplicitBeamOrientation(null); setApplied(false); }}
              style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                border: `1px solid ${explicitBridge === opt.id ? "rgba(26,92,42,0.6)" : "rgba(0,0,0,0.07)"}`,
                background: explicitBridge === opt.id ? "#EAF3EC" : "rgba(0,0,0,0.035)",
                color: explicitBridge === opt.id ? "#1A5C2A" : "#4A4540",
              }}>{opt.label}</button>
          ))}
        </div>
        {(explicitBridge === "open" || explicitBridge === null) && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Beam orientation {explicitBridge === null ? "(if engine picks open)" : ""}:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ id: null, label: "Engine decides" }, ...BEAM_ORIENTATIONS.map((b) => ({ id: b.id, label: b.label }))].map((opt) => (
                <button key={opt.id ?? "auto"} onClick={() => { setExplicitBeamOrientation(opt.id); setApplied(false); }}
                  style={{ padding: "6px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                    border: `1px solid ${explicitBeamOrientation === opt.id ? "rgba(26,92,42,0.5)" : "rgba(0,0,0,0.06)"}`,
                    background: explicitBeamOrientation === opt.id ? "#EAF3EC" : "rgba(0,0,0,0.025)",
                    color: explicitBeamOrientation === opt.id ? "#1A5C2A" : "#7A7268",
                  }}>{opt.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 4 }}>Lock a surface texture? <span style={{ color: "#7A7268", textTransform: "none", fontWeight: 400 }}>(optional — engine will pick based on priority if left blank)</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ id: null, label: "Engine decides" }, ...SURFACE_TEXTURES.map((s) => ({ id: s.id, label: s.label }))].map((opt) => (
            <button key={opt.id ?? "auto"} onClick={() => { setExplicitSurface(opt.id); setApplied(false); }}
              style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                border: `1px solid ${explicitSurface === opt.id ? "rgba(26,92,42,0.6)" : "rgba(0,0,0,0.07)"}`,
                background: explicitSurface === opt.id ? "#EAF3EC" : "rgba(0,0,0,0.035)",
                color: explicitSurface === opt.id ? "#1A5C2A" : "#4A4540",
              }}>{opt.label}</button>
          ))}
        </div>
      </div>

      <SectionDivider label="Competitive Reference" step={3} />
      <p style={{ fontSize: 12.5, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 10px" }}>
        Pick up to 3 racquets from the market database, then tag which qualities you want to take from them — not a clone, specific features.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MARKET_RACQUETS.map((r) => {
          const ref = references.find((x) => x.racquetId === r.id);
          const isSelected = !!ref;
          return (
            <div key={r.id} style={{ border: `1px solid ${isSelected ? "rgba(26,92,42,0.4)" : "rgba(0,0,0,0.05)"}`, borderRadius: 8, background: isSelected ? "#F2F8F3" : "rgba(0,0,0,0.015)", padding: "10px 12px" }}>
              <button
                onClick={() => toggleReference(r.id)}
                disabled={!isSelected && references.length >= 3}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "none", border: "none", cursor: !isSelected && references.length >= 3 ? "not-allowed" : "pointer",
                  padding: 0, WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{ fontSize: 13, color: isSelected ? "#1A5C2A" : "#4A4540", fontWeight: 600, fontFamily: "Inter, sans-serif", textAlign: "left" }}>{r.brand} {r.model}</span>
                {isSelected ? <CheckCircle2 size={15} color="#1A5C2A" /> : <span style={{ width: 15, height: 15, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)" }} />}
              </button>
              {isSelected && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.045)" }}>
                  <div style={{ fontSize: 10, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Take:</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {QUALITY_OPTIONS.map((q) => {
                      const active = ref!.draws.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          onClick={() => toggleDraw(r.id, q.id)}
                          style={{
                            padding: "5px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif",
                            border: `1px solid ${active ? "#1A5C2A" : "rgba(0,0,0,0.07)"}`,
                            background: active ? "rgba(26,92,42,0.15)" : "rgba(0,0,0,0.035)",
                            color: active ? "#1A5C2A" : "#4A4540", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                          }}
                        >{q.label}</button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 10, marginBottom: 6 }}>Leave:</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {QUALITY_OPTIONS.map((q) => {
                      const active = ref!.avoid.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          onClick={() => toggleAvoid(r.id, q.id)}
                          style={{
                            padding: "5px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif",
                            border: `1px solid ${active ? "#991B1B" : "rgba(0,0,0,0.07)"}`,
                            background: active ? "rgba(255,80,80,0.12)" : "rgba(0,0,0,0.035)",
                            color: active ? "#991B1B" : "#4A4540", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                          }}
                        >{q.label}</button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SectionDivider label="Priority" step={4} />
      <p style={{ fontSize: 12.5, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 10px" }}>
        One forced choice — you can't optimize for everything, and a real product line picks a clear point of view.
      </p>
      <ToggleGroup options={PRIORITY_OPTIONS} value={priority} onChange={(v) => { setPriority(v); setApplied(false); }} />

      <SectionDivider label="Constraints" step={5} />
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>Durability expectation for this tier</div>
        <ToggleGroup options={DURABILITY_OPTIONS} value={durabilityExpectation} onChange={(v) => { setDurabilityExpectation(v); setApplied(false); }} />
        {durabilityExpectation === "extended" && (
          <p style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", marginTop: 8 }}>
            Engineered at the frame/bridge level (hybrid frame construction, torsion-resistant bridge geometry) — the core and face stay exactly as soft or forgiving as the target level needs, so durability doesn't quietly undo the playability work above.
          </p>
        )}
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>Material already committed? <span style={{ color: "#7A7268", textTransform: "none", fontWeight: 400 }}>(optional — overrides everything above if it conflicts)</span></div>
        <SelectField
          value={materialCommitment}
          onChange={setMaterialCommitment}
          options={[{ id: "", label: "No commitment — let the brief decide" }, ...CORE_MATERIALS.map((c) => ({ id: c.id, label: `Core: ${c.label}` })), ...FACE_MATERIALS.map((f) => ({ id: f.id, label: `Face: ${f.label}` })), ...FRAME_MATERIALS.map((f) => ({ id: f.id, label: `Frame: ${f.label}` }))]}
        />
      </div>

      <button onClick={handleApply} disabled={!canApply} style={{
        width: "100%", padding: "14px 16px", borderRadius: 10, border: "none",
        background: canApply ? "linear-gradient(135deg, #1A5C2A, #2D7A3A)" : "rgba(0,0,0,0.045)",
        color: canApply ? "#FFFFFF" : "#B0A898",
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15,
        letterSpacing: "0.08em", textTransform: "uppercase", cursor: canApply ? "pointer" : "not-allowed",
        marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, WebkitTapHighlightColor: "transparent",
      }}>
        {applied ? <><CheckCircle2 size={16} /> Spec Applied</> : <>Generate Spec <ArrowRight size={16} /></>}
      </button>
      {!canApply && (() => {
        const missing: string[] = [];
        if (!tooling) missing.push("Tooling (step 1 — New mold or Existing mold)");
        if (tooling === "existing-mold" && !existingMoldRacquetId) missing.push("Which mold / reference racquet (step 1)");
        if (!targetVolume) missing.push("Target volume (step 1)");
        if (!level) missing.push("Target level (step 2)");
        if (!priceTier) missing.push("Price tier (step 2)");
        if (!priority) missing.push("Priority (step 4)");
        if (!durabilityExpectation) missing.push("Durability expectation (step 5)");
        return (
          <div style={{ marginTop: 10, padding: "10px 12px", background: "#FEE2E2", border: "1px solid #F87171", borderRadius: 8 }}>
            <p style={{ fontSize: 11.5, color: "#92400E", fontFamily: "Inter, sans-serif", margin: "0 0 6px", fontWeight: 600 }}>Still needed before generating:</p>
            {missing.map((m, i) => <p key={i} style={{ fontSize: 11.5, color: "#7F1D1D", fontFamily: "Inter, sans-serif", margin: "2px 0" }}>· {m}</p>)}
          </div>
        );
      })()}

      {applied && lastResult && (
        <div style={{ marginTop: 16 }}>
          {/* Error state */}
          {lastResult.alternatives.length === 0 && lastResult.rationale.length > 0 && (
            <div style={{ padding: "12px 14px", background: "rgba(255,80,50,0.08)", border: "1px solid rgba(255,80,50,0.25)", borderRadius: 10, marginBottom: 12 }}>
              <p style={{ fontSize: 12.5, color: "#991B1B", fontFamily: "Inter, sans-serif", margin: 0, fontWeight: 600 }}>Engine error</p>
              {lastResult.rationale.map((line, i) => (
                <p key={i} style={{ fontSize: 12, color: "#991B1B", fontFamily: "Inter, sans-serif", margin: "4px 0 0" }}>{line}</p>
              ))}
            </div>
          )}

          {/* Track switcher */}
          {lastResult.alternatives.length > 0 && <>
          <p style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1A5C2A", marginBottom: 8 }}>3 Design Approaches — Same Brief</p>
          <p style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 12px" }}>Each is a different engineering philosophy for the same goal. Select one to apply it to the Build tab.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lastResult.alternatives.map((alt) => {
              const isSelected = selectedTrack === alt.trackId;
              return (
                <div key={alt.trackId} style={{ border: `1px solid ${isSelected ? "rgba(26,92,42,0.5)" : "rgba(0,0,0,0.06)"}`, borderRadius: 10, background: isSelected ? "#F2F8F3" : "rgba(0,0,0,0.015)", overflow: "hidden" }}>
                  <button onClick={() => {
                    setSelectedTrack(alt.trackId);
                    onApply(alt.spec);
                  }} style={{ width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#1A5C2A" : "#18181B", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>{alt.trackLabel}</span>
                      <span style={{ fontSize: 11, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace" }}>~${alt.oem} OEM · ${alt.retailRange[0]}–${alt.retailRange[1]}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#4A4540", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "6px 0 0" }}>{alt.philosophy}</p>
                  </button>
                  {isSelected && (
                    <div style={{ padding: "0 14px 14px" }}>
                      <div style={{ borderTop: "1px solid rgba(0,0,0,0.045)", paddingTop: 10, marginTop: 2 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                          {[
                            ["Shape", alt.spec.shapeId],
                            ["Core", alt.spec.coreId],
                            ["Face", alt.spec.faceId],
                            ["Frame", alt.spec.frameId],
                            ["Surface", alt.spec.surfaceId],
                            ["Bridge", alt.spec.bridgeId],
                          ].map(([k, v]) => (
                            <div key={k} style={{ background: "rgba(0,0,0,0.035)", borderRadius: 6, padding: "5px 8px" }}>
                              <div style={{ fontSize: 9, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
                              <div style={{ fontSize: 12, color: "#18181B", fontFamily: "Inter, sans-serif", marginTop: 2 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {alt.rationale.slice(0, 2).map((line, i) => (
                          <p key={i} style={{ fontSize: 12, color: "#7A7268", lineHeight: 1.5, fontFamily: "Inter, sans-serif", margin: "0 0 6px", paddingLeft: 10, borderLeft: "2px solid rgba(26,92,42,0.35)" }}>{line}</p>
                        ))}
                        <p style={{ fontSize: 11.5, color: "#1A5C2A", fontFamily: "Inter, sans-serif", marginTop: 8, opacity: 0.8 }}>↑ Applied to Build tab — scroll up to fine-tune.</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PLAYABILITY RADAR
// ---------------------------------------------------------------------------

function PlayabilityRadar({ scores }) {
  const data = [
    { subject: "Power", value: scores.power, fullMark: 5 },
    { subject: "Control", value: scores.control, fullMark: 5 },
    { subject: "Comfort", value: scores.comfort, fullMark: 5 },
    { subject: "Sweet Spot", value: scores.sweetSpot, fullMark: 5 },
    { subject: "Stability", value: scores.stability, fullMark: 5 },
    { subject: "Spin", value: scores.spin, fullMark: 5 },
    { subject: "Durability", value: scores.durability, fullMark: 5 },
  ];
  return (
    <div style={{ width:"100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{top:10, right:30, bottom:10, left:30}}>
          <PolarGrid gridType="polygon" stroke="rgba(0,0,0,0.06)"/>
          <PolarAngleAxis dataKey="subject" tick={{ fill:"#7A7268", fontSize:10, fontFamily:"'JetBrains Mono', monospace" }}/>
          <PolarRadiusAxis domain={[0,5]} tick={false} axisLine={false}/>
          <Radar name="Build" dataKey="value" stroke="#1A5C2A" fill="#1A5C2A" fillOpacity={0.15} strokeWidth={2}/>
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN APP
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HOLE PLACEMENT CANVAS — replaces the old five-bucket hole count/pattern
// dropdowns with direct click-to-place editing. Every click adds or removes
// a real hole coordinate; every change recomputes real physics (open area %,
// face stiffness, center/edge density) via the same functions the scoring
// engine uses, so what's shown here is never an approximation layered on
// top of the real calculation — it IS the real calculation.
// ---------------------------------------------------------------------------
function HolePlacementCanvas({ shape, holes, onHolesChange, holeDiameterMm, onDiameterChange }: {
  shape: string; holes: HolePoint[]; onHolesChange: (h: HolePoint[]) => void;
  holeDiameterMm: number; onDiameterChange: (d: number) => void;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [clickMode, setClickMode] = useState<"add" | "remove">("add");
  const VB = 280; // svg viewBox size

  const faceGeom = () => {
    const cx = VB * 0.5, cy = VB * 0.44;
    const a = VB * 0.36, b = shape === "round" ? VB * 0.4 : shape === "diamond" ? VB * 0.4 : VB * 0.37;
    return { cx, cy, a, b };
  };

  const inFace = (nx: number, ny: number) => {
    if (shape === "round") return nx * nx + ny * ny < 0.9;
    if (shape === "diamond" || shape === "diamond-wide") return Math.abs(nx) + Math.abs(ny * 1.05) < 0.92;
    const halfW = ny < 0 ? 0.92 - ny * 0.22 : 0.92 - ny * 0.48;
    return (nx * nx) / (halfW * halfW) + ny * ny < 0.94;
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VB;
    const py = ((e.clientY - rect.top) / rect.height) * VB;
    const { cx, cy, a, b } = faceGeom();
    const nx = (px - cx) / a, ny = (py - cy) / b;

    const clickRadiusNorm = (holeDiameterMm / 255) * 1.8; // approximate hit-test radius in normalized units
    const hitIdx = holes.findIndex(h => Math.hypot(h.x - nx, h.y - ny) < clickRadiusNorm);
    if (hitIdx >= 0) {
      onHolesChange(holes.filter((_, i) => i !== hitIdx));
    } else if (clickMode === "add" && inFace(nx, ny)) {
      onHolesChange([...holes, { x: nx, y: ny }]);
    }
  };

  const applyPreset = (preset: string) => {
    if (preset === "clear") { onHolesChange([]); return; }
    if (preset === "head1") { onHolesChange([{ x: 0, y: -0.1 }]); return; }
    if (preset === "center4") {
      onHolesChange([{ x: -0.12, y: -0.2 }, { x: 0.12, y: -0.2 }, { x: -0.12, y: 0.05 }, { x: 0.12, y: 0.05 }]);
      return;
    }
    if (preset === "center14") {
      const pts: HolePoint[] = [];
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const rad = 0.22 * (0.4 + 0.6 * ((i % 3) / 2));
        pts.push({ x: rad * Math.cos(ang), y: -0.12 + rad * Math.sin(ang) * 0.85 });
      }
      onHolesChange(pts.filter(p => inFace(p.x, p.y)));
      return;
    }
    if (preset === "ring") {
      const pts: HolePoint[] = [{ x: 0, y: -0.1 }];
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        pts.push({ x: 0.5 * Math.cos(ang), y: -0.1 + 0.45 * Math.sin(ang) });
      }
      onHolesChange(pts.filter(p => inFace(p.x, p.y)));
      return;
    }
    if (preset === "standard") {
      onHolesChange(generateLegacyHoleGrid("standard", "even", shape));
      return;
    }
    if (preset === "dense") {
      onHolesChange(generateLegacyHoleGrid("high", "even", shape));
      return;
    }
  };

  const { cx, cy, a, b } = faceGeom();
  const holeRPx = Math.max(3, (holeDiameterMm / 255) * a * 2.1);

  // Real physics, computed the exact same way the scoring engine computes
  // it — this display is never approximated separately from the actual
  // calculation used downstream.
  const faceWidthMm = 255, faceHeightMm = 290;
  const openPct = computeHoleOpenAreaPct(holes, holeDiameterMm, faceWidthMm, faceHeightMm);
  const { centerFrac, edgeFrac, meanDist } = computeHoleCenterEdgeSplit(holes);
  const stiffness = Math.round(100 - openPct * 1.1 - (centerFrac * openPct) * 0.6);
  const powerVal = piecewiseLerp(openPct, HOLE_POWER_CURVE);
  const spinVal = Math.max(0, Math.min(100, openPct * 3.2));
  const pocketVal = Math.max(0, Math.min(100, openPct * 2.2 + centerFrac * 25));
  const topCount = holes.filter(h => h.y < 0).length;
  const botCount = holes.length - topCount;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setClickMode("add")} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: `1.5px solid ${clickMode === "add" ? "#1A5C2A" : "#D4CCB8"}`, background: clickMode === "add" ? "#EAF3EC" : "#fff", color: clickMode === "add" ? "#1A5C2A" : "#4A4540", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Add hole</button>
        <button onClick={() => setClickMode("remove")} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: `1.5px solid ${clickMode === "remove" ? "#1A5C2A" : "#D4CCB8"}`, background: clickMode === "remove" ? "#EAF3EC" : "#fff", color: clickMode === "remove" ? "#1A5C2A" : "#4A4540", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Remove hole</button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        onClick={handleSvgClick}
        style={{ width: "100%", background: "#fff", border: "1.5px solid #D4CCB8", borderRadius: 10, cursor: "crosshair", display: "block" }}
      >
        {shape === "round" ? (
          <ellipse cx={cx} cy={cy} rx={a} ry={b} fill="#E8E2D6" stroke="#C0B8A4" strokeWidth="2.5"/>
        ) : shape === "diamond" || shape === "diamond-wide" ? (
          <polygon points={`${cx},${cy-b} ${cx+a},${cy} ${cx},${cy+b} ${cx-a},${cy}`} fill="#E8E2D6" stroke="#C0B8A4" strokeWidth="2.5"/>
        ) : (
          <path d={`M ${cx},${cy-b} C ${cx+a*0.88},${cy-b*0.4} ${cx+a},${cy+b*0.15} ${cx+a*0.5},${cy+b*0.75} C ${cx+a*0.25},${cy+b} ${cx},${cy+b} ${cx},${cy+b} C ${cx},${cy+b} ${cx-a*0.25},${cy+b} ${cx-a*0.5},${cy+b*0.75} C ${cx-a},${cy+b*0.15} ${cx-a*0.88},${cy-b*0.4} ${cx},${cy-b} Z`} fill="#E8E2D6" stroke="#C0B8A4" strokeWidth="2.5"/>
        )}
        {holes.length > 0 && (
          <circle cx={cx} cy={cy + b * 0.02} r={Math.max(18, Math.min(a * 0.6, 30 + (pocketVal / 100) * 30))} fill="none" stroke="rgba(26,92,42,0.4)" strokeWidth="1.5" strokeDasharray="4 3"/>
        )}
        {holes.map((h, i) => {
          const dist = Math.sqrt(h.x * h.x + h.y * h.y);
          const px = cx + h.x * a, py = cy + h.y * b;
          return <circle key={i} cx={px} cy={py} r={holeRPx} fill="#fff" stroke={dist < 0.4 ? "#1A5C2A" : "#B0A68E"} strokeWidth={dist < 0.4 ? 1.4 : 0.8}/>;
        })}
      </svg>
      <p style={{ fontSize: 11, color: "#7A7268", textAlign: "center", margin: "6px 0 0", fontFamily: "Inter, sans-serif" }}>
        {clickMode === "add" ? "Click the face to add a hole. Click an existing hole to remove it." : "Click any hole to remove it."}
      </p>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "#4A4540", fontFamily: "Inter, sans-serif" }}>Hole diameter</span>
          <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#1A5C2A", fontWeight: 700 }}>{holeDiameterMm}mm</span>
        </div>
        <input type="range" min={9} max={13} step={0.5} value={holeDiameterMm} onChange={e => onDiameterChange(parseFloat(e.target.value))} style={{ width: "100%" }}/>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#7A7268" }}>9mm (FIP min)</span>
          <span style={{ fontSize: 10, color: "#7A7268" }}>13mm (FIP max)</span>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7A7268", marginBottom: 6 }}>Quick fill patterns</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["clear", "Clear all"], ["head1", "1 hole"], ["center4", "4 center"], ["center14", "14 center"], ["ring", "Ring"], ["standard", "Standard grid"], ["dense", "Dense grid"]].map(([id, label]) => (
            <button key={id} onClick={() => applyPreset(id)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #D4CCB8", background: "#fff", color: "#4A4540", fontSize: 11, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 14 }}>
        <div style={{ background: "#F5F2EB", border: "1px solid #D4CCB8", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#18181B" }}>{holes.length}</div>
          <div style={{ fontSize: 9, color: "#7A7268", textTransform: "uppercase", letterSpacing: "0.04em" }}>Holes</div>
        </div>
        <div style={{ background: "#F5F2EB", border: "1px solid #D4CCB8", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: openPct > 30 ? "#991B1B" : "#18181B" }}>{openPct.toFixed(1)}%</div>
          <div style={{ fontSize: 9, color: "#7A7268", textTransform: "uppercase", letterSpacing: "0.04em" }}>Open area</div>
        </div>
        <div style={{ background: "#F5F2EB", border: "1px solid #D4CCB8", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#18181B" }}>{Math.max(0, stiffness)}</div>
          <div style={{ fontSize: 9, color: "#7A7268", textTransform: "uppercase", letterSpacing: "0.04em" }}>Stiffness</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
        <div style={{ background: "#F5F2EB", border: "1px solid #D4CCB8", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#18181B" }}>{Math.round(powerVal * 20)}</div>
          <div style={{ fontSize: 9, color: "#7A7268", textTransform: "uppercase", letterSpacing: "0.04em" }}>Power</div>
        </div>
        <div style={{ background: "#F5F2EB", border: "1px solid #D4CCB8", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#18181B" }}>{Math.round(spinVal)}</div>
          <div style={{ fontSize: 9, color: "#7A7268", textTransform: "uppercase", letterSpacing: "0.04em" }}>Spin</div>
        </div>
        <div style={{ background: "#F5F2EB", border: "1px solid #D4CCB8", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#18181B" }}>{Math.round(pocketVal)}</div>
          <div style={{ fontSize: 9, color: "#7A7268", textTransform: "uppercase", letterSpacing: "0.04em" }}>Pocket depth</div>
        </div>
      </div>

      {holes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#4A4540", lineHeight: 1.6, fontFamily: "Inter, sans-serif" }}>
          {holes.length} holes at {holeDiameterMm}mm, {(centerFrac * holes.length).toFixed(0)} concentrated at center, {(edgeFrac * holes.length).toFixed(0)} near the edge, {topCount}/{botCount} top/bottom split.
          {centerFrac > 0.5 && " Center-heavy placement — sweet spot flexes more while edges stay stiffer, resisting off-center twist."}
          {edgeFrac > 0.5 && " Edge-heavy placement — sweet spot stays direct while perimeter mass is reduced."}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<"player"|"manufacturer">("player");
  const [activeTab, setActiveTab] = useState<"find"|"build"|"view"|"scores">("find");
  const [diagramMode, setDiagramMode] = useState<"diagram"|"illustration"|"profile">("diagram");

  // Build state
  const [shapeId, setShapeId] = useState("teardrop");
  const [playerBudgetTier, setPlayerBudgetTier] = useState<string | null>(null);
  const [coreId, setCoreId] = useState("eva-medium");
  const [faceId, setFaceId] = useState("carbon-12k");
  const [frameId, setFrameId] = useState("hybrid-frame");
  const [surfaceId, setSurfaceId] = useState("rough");
  const [gripId, setGripId] = useState("pu-grip");
  const [gripShapeId, setGripShapeId] = useState("octagonal");
  const [bridgeId, setBridgeId] = useState("open");
  const [beamCount, setBeamCount] = useState(2);
  const [beamOrientation, setBeamOrientation] = useState("vertical");
  const [holes, setHoles] = useState<HolePoint[]>(() => generateLegacyHoleGrid("standard", "even", "teardrop"));
  const [holeDiameterMm, setHoleDiameterMm] = useState(9);
  const [lengthMm, setLengthMm] = useState(450);
  const [widthMm, setWidthMm] = useState(255);
  const [thicknessMm, setThicknessMm] = useState(38);
  const [weightG, setWeightG] = useState(365);
  const [balanceCm, setBalanceCm] = useState(25.8);
  const [gripCircMm, setGripCircMm] = useState(38);

  // Save & Share state
  const [shareStatus, setShareStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");

  // Accordion state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["shape"]));
  const toggle = (id: string) => setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // On first load, check for a ?b=<code> share link and restore that
  // build's full spec if present. Runs once on mount only.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("b");
    if (!code) return;
    setLoadStatus("loading");
    loadBuild(code).then((result) => {
      if (!result.ok) {
        setLoadStatus("error");
        return;
      }
      const s = result.spec;
      if (typeof s.shapeId === "string") setShapeId(s.shapeId);
      if (typeof s.coreId === "string") setCoreId(s.coreId);
      if (typeof s.faceId === "string") setFaceId(s.faceId);
      if (typeof s.frameId === "string") setFrameId(s.frameId);
      if (typeof s.surfaceId === "string") setSurfaceId(s.surfaceId);
      if (typeof s.gripId === "string") setGripId(s.gripId);
      if (typeof s.gripShapeId === "string") setGripShapeId(s.gripShapeId);
      if (typeof s.bridgeId === "string") setBridgeId(s.bridgeId);
      if (typeof s.beamCount === "number") setBeamCount(s.beamCount);
      if (typeof s.beamOrientation === "string") setBeamOrientation(s.beamOrientation);
      // Backward compatible with shares saved before the hole-placement
      // engine: if the saved state has the old string buckets, convert
      // them to real coordinates on load. New saves carry `holes` directly.
      if (Array.isArray(s.holes)) setHoles(s.holes);
      else if (typeof s.holeCountId === "string") setHoles(generateLegacyHoleGrid(s.holeCountId, typeof s.holePatternId === "string" ? s.holePatternId : "even", typeof s.shapeId === "string" ? s.shapeId : "teardrop"));
      if (typeof s.holeDiameterMm === "number") setHoleDiameterMm(s.holeDiameterMm);
      if (typeof s.lengthMm === "number") setLengthMm(s.lengthMm);
      if (typeof s.widthMm === "number") setWidthMm(s.widthMm);
      if (typeof s.thicknessMm === "number") setThicknessMm(s.thicknessMm);
      if (typeof s.weightG === "number") setWeightG(s.weightG);
      if (typeof s.balanceCm === "number") setBalanceCm(s.balanceCm);
      if (typeof s.gripCircMm === "number") setGripCircMm(s.gripCircMm);
      setLoadStatus("idle");
      setActiveTab("view");
      analytics.buildLoaded(code);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveBuild = useCallback(async () => {
    setShareStatus("saving");
    setShareError(null);
    const spec = {
      shapeId, coreId, faceId, frameId, surfaceId, gripId, gripShapeId,
      bridgeId, beamCount, beamOrientation, holes, holeDiameterMm,
      lengthMm, widthMm, thicknessMm, weightG, balanceCm, gripCircMm,
    };
    const result = await saveBuild(spec);
    if (!result.ok) {
      setShareStatus("error");
      setShareError(result.error);
      analytics.buildSaveFailed(result.error);
      return;
    }
    setShareCode(result.code);
    setShareStatus("saved");
    analytics.buildSaved(result.code);
    // Reflect the share code in the URL without a page reload, so a
    // refresh or copy-paste of the address bar also carries the link.
    const url = new URL(window.location.href);
    url.searchParams.set("b", result.code);
    window.history.replaceState({}, "", url.toString());
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      // clipboard API can fail (permissions, non-HTTPS context, etc.) —
      // the URL bar still has the link even if copy silently fails
    }
    // Reset back to idle after a few seconds so the button is reusable
    // for a fresh save if the person keeps editing.
    setTimeout(() => setShareStatus("idle"), 4000);
  }, [shapeId, coreId, faceId, frameId, surfaceId, gripId, gripShapeId, bridgeId, beamCount, beamOrientation, holes, holeDiameterMm, lengthMm, widthMm, thicknessMm, weightG, balanceCm, gripCircMm]);

  const shape = SHAPES.find(s => s.id === shapeId)!;
  const core = CORE_MATERIALS.find(c => c.id === coreId)!;
  const face = FACE_MATERIALS.find(f => f.id === faceId)!;
  const frame = FRAME_MATERIALS.find(f => f.id === frameId)!;
  const surface = SURFACE_TEXTURES.find(s => s.id === surfaceId)!;
  const grip = GRIP_MATERIALS.find(g => g.id === gripId)!;
  const bridge = BRIDGE_TYPES.find(b => b.id === bridgeId)!;

  const scores = useMemo(() => computeScores({ shape, core, face, frame, surface, grip, bridgeId, beamOrientation, holes, holeDiameterMm, weightG, balanceCm, widthMm, thicknessMm }), [shape, core, face, frame, surface, grip, bridgeId, beamOrientation, holes, holeDiameterMm, weightG, balanceCm, widthMm, thicknessMm]);
  const geometryPhysics = useMemo(() => computeGeometryPhysics({ lengthMm, widthMm, weightG, balanceCm, shape: shapeId }), [lengthMm, widthMm, weightG, balanceCm, shapeId]);
  const materialPhysics = useMemo(() => computeRelativeMaterialPhysics({ coreId, frameId, faceId, gripId, thicknessMm, bridgeId, beamOrientation }), [coreId, frameId, faceId, gripId, thicknessMm, bridgeId, beamOrientation]);
  const matchedRacquets = useMemo(
    () => matchRacquets({ shapeId, coreId, faceId, surfaceId, weightG, balanceCm }, { limit: 4, budgetTier: playerBudgetTier ?? undefined }),
    [shapeId, coreId, faceId, surfaceId, weightG, balanceCm, playerBudgetTier]
  );
  const stabilityPct = useMemo(() => Math.round(computeStability({ core, face, frame, bridgeId, beamOrientation, widthMm, weightG }) * 100), [core, face, frame, bridgeId, beamOrientation, widthMm, weightG]);
  const fto_flagged = ["graphene","kevlar-reinforced"].includes(faceId) || holes.length > 0 || coreId === "hybrid-core";

  // Track when matched racquets actually become visible (Scores tab, or
  // desktop layout where Scores content is always reachable), not on
  // every background spec recalculation.
  useEffect(() => {
    if (activeTab === "scores" && matchedRacquets.length > 0) {
      analytics.marketMatchesViewed(matchedRacquets[0].matchPct, matchedRacquets[0].racquet.model);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, matchedRacquets]);

  const handleApplyRec = (answers) => {
    const rec = recommendSpec(answers);
    setShapeId(rec.shapeId); setCoreId(rec.coreId); setFaceId(rec.faceId);
    setFrameId(rec.frameId); setSurfaceId(rec.surfaceId); setGripId(rec.gripId);
    setGripShapeId(rec.gripShapeId);
    setWeightG(Math.round(rec.weightG));
    setBalanceCm(Math.round(rec.balanceCm * 10) / 10);
    setGripCircMm(Math.round(rec.gripCircMm));
    if (answers.budgetTier) setPlayerBudgetTier(answers.budgetTier);
    setActiveTab("view");
    analytics.finderCompleted(answers?.level ?? "unknown");
  };

  // Factory Brief panel computes its own spec via computeFactoryBrief and
  // passes the result directly, unlike handleApplyRec above which expects
  // raw Smart Finder answers and runs them through recommendSpec itself —
  // these are genuinely different engines for different inputs, so this
  // stays a separate handler rather than overloading handleApplyRec.
  const handleApplyFactorySpec = (spec) => {
    setShapeId(spec.shapeId); setCoreId(spec.coreId); setFaceId(spec.faceId);
    setFrameId(spec.frameId); setSurfaceId(spec.surfaceId); setGripId(spec.gripId);
    setGripShapeId(spec.gripShapeId);
    if (spec.bridgeId) setBridgeId(spec.bridgeId);
    if (spec.beamOrientation) setBeamOrientation(spec.beamOrientation);
    setWeightG(Math.round(spec.weightG));
    setBalanceCm(Math.round(spec.balanceCm * 10) / 10);
    setGripCircMm(Math.round(spec.gripCircMm));
    setActiveTab("view");
  };

  // Shared diagram props
  const diagramProps = {
    shape: shapeId, faceId, surfaceId, gripShapeId, holes, holeDiameterMm,
    lengthMm, widthMm, balanceCm, weightG, coreObj: core, faceObj: face, frameObj: frame,
    bridgeId, beamCount, beamOrientation,
  };

  const LIME = "#1A5C2A";

  // Score top metric for header badge
  const topScore = Math.max(scores.power, scores.control, scores.comfort, scores.sweetSpot, scores.stability, scores.spin, scores.durability);

  const tabDefs = [
    { id: "find", label: mode === "manufacturer" ? "Brief" : "Find", icon: mode === "manufacturer" ? <Wrench size={18}/> : <Sparkles size={18}/> },
    { id: "build", label: "Build", icon: <Settings2 size={18}/> },
    { id: "view", label: "View", icon: <Eye size={18}/> },
    { id: "scores", label: "Scores", icon: <BarChart3 size={18}/> },
  ];

  // ---- BUILD CONTENT ----
  const buildContent = (
    <div style={{ padding: "0 16px" }}>
      {/* Find panel inlined at top of build in player mode */}
      {mode === "player" && (
        <div style={{ marginBottom: 4 }}>
          <AccordionSection id="finder" icon={<Sparkles size={15}/>} label="Smart Finder" isOpen={openSections.has("finder")} onToggle={() => toggle("finder")}>
            <FindRacquetPanel onApply={handleApplyRec} mode={mode}/>
          </AccordionSection>
        </div>
      )}

      {/* Factory Brief panel inlined at top of build in factory mode —
          a genuinely different tool for a genuinely different input,
          not the Smart Finder reused with different labels. */}
      {mode === "manufacturer" && (
        <div style={{ marginBottom: 4 }}>
          <AccordionSection id="factoryBrief" icon={<Wrench size={15}/>} label="Factory Brief" isOpen={openSections.has("factoryBrief")} onToggle={() => toggle("factoryBrief")}>
            <FactoryBriefPanel onApply={handleApplyFactorySpec}/>
          </AccordionSection>
        </div>
      )}

      {/* Head Shape */}
      <AccordionSection id="shape" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 22 2 22"/></svg>} label="Head Shape" isOpen={openSections.has("shape")} onToggle={() => toggle("shape")}>
        <SelectField value={shapeId} onChange={setShapeId} options={SHAPES}/>
        <MaterialNote text={shape.note}/>
        <BestForTag text={shape.bestFor}/>
        <MiniRatingGrid items={[{label:"Power", val:shape.power},{label:"Control", val:shape.control},{label:"Forgiveness", val:shape.forgiveness}]}/>
        <p style={{ fontSize:11.5, color:"#7A7268", marginTop:10, fontFamily:"Inter, sans-serif" }}>Balance: {shape.balanceRange} · Sweet spot: {shape.sweetSpot}</p>
      </AccordionSection>

      {/* Face Material */}
      <AccordionSection id="face" icon={<Layers size={15}/>} label="Face Material" isOpen={openSections.has("face")} onToggle={() => toggle("face")} badge={face.cost ? face.cost : undefined}>
        <SelectField value={faceId} onChange={setFaceId} options={FACE_MATERIALS}/>
        <MaterialNote text={face.note}/>
        {mode === "manufacturer" && <ManufacturingNote text={(face as any).manufacturingNote}/>}
        {face.bestFor && <BestForTag text={face.bestFor}/>}
        <MiniRatingGrid items={[{label:"Power", val:face.power},{label:"Control", val:face.control},{label:"Comfort", val:face.comfort},{label:"Durability", val:face.durability}]}/>
        {faceId === "carbon-3k" && (
          <div style={{ marginTop:10, padding:"8px 10px", background:"#FEF3C7", border:"1px solid #D97706", borderRadius:8 }}>
            <p style={{ fontSize:12, color:"#92400E", margin:0, fontFamily:"Inter, sans-serif" }}>Source disagreement flagged — verify stiffness behavior against your supplier's data sheet.</p>
          </div>
        )}
      </AccordionSection>

      {/* Core Material */}
      <AccordionSection id="core" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>} label="Core Material" isOpen={openSections.has("core")} onToggle={() => toggle("core")}>
        <SelectField value={coreId} onChange={setCoreId} options={CORE_MATERIALS}/>
        <div style={{ fontSize:11.5, color:"#7A7268", marginTop:6, fontFamily:"'JetBrains Mono', monospace" }}>density: {core.density}</div>
        <MaterialNote text={core.note}/>
        {mode === "manufacturer" && <ManufacturingNote text={(core as any).manufacturingNote}/>}
        <BestForTag text={core.bestFor}/>
        <MiniRatingGrid items={[{label:"Power", val:core.power},{label:"Comfort", val:core.comfort},{label:"Sweet Spot", val:core.sweetSpot},{label:"Durability", val:core.durability}]}/>
      </AccordionSection>

      {/* Dimensions */}
      <AccordionSection id="dims" icon={<Ruler size={15}/>} label="Dimensions" isOpen={openSections.has("dims")} onToggle={() => toggle("dims")}>
        <SliderField label="Total Length" value={lengthMm} onChange={setLengthMm} min={400} max={455} suffix=" mm" explanation={explainLength(lengthMm)}/>
        <SliderField label="Face Width" value={widthMm} onChange={setWidthMm} min={200} max={260} suffix=" mm" explanation={explainWidth(widthMm, shapeId)}/>
        <SliderField label="Thickness" value={thicknessMm} onChange={setThicknessMm} min={28} max={38} suffix=" mm" explanation={explainThickness(thicknessMm)}/>
        <SliderField label="Weight" value={weightG} onChange={setWeightG} min={350} max={380} suffix=" g" explanation={explainWeight(weightG)}/>
        <SliderField label="Balance Point" value={balanceCm} onChange={setBalanceCm} min={24} max={27} step={0.1} suffix=" cm" explanation={explainBalance(balanceCm, shapeId)}/>
        <SliderField label="Grip Circumference" value={gripCircMm} onChange={setGripCircMm} min={35} max={42} suffix=" mm" explanation={explainGripCirc(gripCircMm)}/>
        {mode === "manufacturer" && (
          <p style={{ fontSize:11, color:"#7A7268", lineHeight:1.5, fontFamily:"Inter, sans-serif", marginTop:4 }}>
            Length max 455mm, head width max 260mm, thickness max 38mm per FIP January 2026 rules. 2.5% manufacturing tolerance on thickness only.
          </p>
        )}
      </AccordionSection>

      {/* Frame */}
      <AccordionSection id="frame" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>} label="Frame Material" isOpen={openSections.has("frame")} onToggle={() => toggle("frame")}>
        <SelectField value={frameId} onChange={setFrameId} options={FRAME_MATERIALS}/>
        <MaterialNote text={frame.note}/>
        {mode === "manufacturer" && <ManufacturingNote text={(frame as any).manufacturingNote}/>}
      </AccordionSection>

      {/* Surface Texture */}
      <AccordionSection id="surface" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6l9-4 9 4v12l-9 4-9-4z"/></svg>} label="Surface Texture" isOpen={openSections.has("surface")} onToggle={() => toggle("surface")}>
        <SelectField value={surfaceId} onChange={setSurfaceId} options={SURFACE_TEXTURES}/>
        <MaterialNote text={surface.note}/>
        {mode === "manufacturer" && <ManufacturingNote text={(surface as any).manufacturingNote}/>}
        <MiniRatingGrid items={[{label:"Spin", val:surface.spin}]}/>
      </AccordionSection>

      {/* Bridge */}
      <AccordionSection id="bridge" icon={<GitFork size={15}/>} label="Bridge & Throat" isOpen={openSections.has("bridge")} onToggle={() => toggle("bridge")}>
        <SelectField value={bridgeId} onChange={setBridgeId} options={BRIDGE_TYPES}/>
        <MaterialNote text={bridge.note}/>
        {bridgeId === "open" && (
          <>
            <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid rgba(0,0,0,0.045)" }}>
              <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7A7268", marginBottom:8 }}>Stability Beams</p>
              <ToggleGroup
                options={BEAM_COUNT_OPTIONS.map(b=>({id:b.id, label:b.label}))}
                value={beamCount}
                onChange={setBeamCount}
                disabled={id => id === 3 && beamOrientation !== "vertical"}
              />
              <p style={{ fontSize:12, color:"#7A7268", lineHeight:1.5, marginTop:8, fontFamily:"Inter, sans-serif" }}>{BEAM_COUNT_OPTIONS.find(b=>b.id===beamCount)?.note}</p>
            </div>
            <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(0,0,0,0.045)" }}>
              <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7A7268", marginBottom:8 }}>Beam Orientation</p>
              <ToggleGroup
                options={BEAM_ORIENTATIONS.map(o=>({id:o.id, label:o.label}))}
                value={beamOrientation}
                onChange={v => { setBeamOrientation(v); if (v !== "vertical" && beamCount === 3) setBeamCount(2); }}
              />
              <p style={{ fontSize:12, color:"#7A7268", lineHeight:1.5, marginTop:8, fontFamily:"Inter, sans-serif" }}>{BEAM_ORIENTATIONS.find(o=>o.id===beamOrientation)?.note}</p>
            </div>
          </>
        )}
      </AccordionSection>

      {/* Grip */}
      <AccordionSection id="grip" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>} label="Grip" isOpen={openSections.has("grip")} onToggle={() => toggle("grip")}>
        <SelectField value={gripId} onChange={setGripId} options={GRIP_MATERIALS}/>
        <MaterialNote text={grip.note}/>
        {mode === "manufacturer" && <ManufacturingNote text={(grip as any).manufacturingNote}/>}
        <MiniRatingGrid items={[{label:"Tack", val:grip.tack},{label:"Vibration Damp", val:grip.vibrationDamp}]}/>
        <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(0,0,0,0.045)" }}>
          <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7A7268", marginBottom:8 }}>Handle Cross-Section</p>
          <ToggleGroup options={GRIP_SHAPES.map(g=>({id:g.id, label:g.label}))} value={gripShapeId} onChange={setGripShapeId}/>
          <p style={{ fontSize:12, color:"#7A7268", lineHeight:1.5, marginTop:8, fontFamily:"Inter, sans-serif" }}>{GRIP_SHAPES.find(g=>g.id===gripShapeId)?.note}</p>
        </div>
      </AccordionSection>

      {/* Holes */}
      <AccordionSection id="holes" icon={<Grid3x3 size={15}/>} label="Face Perforation" isOpen={openSections.has("holes")} onToggle={() => toggle("holes")}>
        <HolePlacementCanvas shape={shapeId} holes={holes} onHolesChange={setHoles} holeDiameterMm={holeDiameterMm} onDiameterChange={setHoleDiameterMm}/>
        {mode === "manufacturer" && (
          <p style={{ fontSize:11, color:"#7A7268", lineHeight:1.5, marginTop:12, fontFamily:"Inter, sans-serif" }}>
            FIP rules: holes in the central striking area must measure 9–13mm diameter. 4cm peripheral band allows different shapes up to 20mm. No minimum or maximum count specified.
          </p>
        )}
      </AccordionSection>

      {mode === "manufacturer" && fto_flagged && (
        <div style={{ marginTop:4 }}><FTOWarning/></div>
      )}
    </div>
  );

  // ---- VIEW CONTENT ----
  const viewContent = (
    <div>
      {/* View mode toggle */}
      <div style={{ display:"flex", gap:6, padding:"12px 16px" }}>
        {[{id:"diagram",label:"Spec View"},{id:"illustration",label:"Illustration"},{id:"profile",label:"Profile"}].map(m => (
          <button key={m.id} onClick={() => { setDiagramMode(m.id as any); analytics.diagramModeChanged(m.id); }} style={{
            flex:1, padding:"9px 6px", borderRadius:8,
            border: `1px solid ${diagramMode===m.id ? "rgba(26,92,42,0.4)" : "rgba(0,0,0,0.045)"}`,
            background: diagramMode===m.id ? "rgba(26,92,42,0.15)" : "rgba(0,0,0,0.035)",
            color: diagramMode===m.id ? "#1A5C2A" : "#7A7268",
            fontSize: 12, fontWeight:700, cursor:"pointer",
            fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:"0.06em", textTransform:"uppercase",
            WebkitTapHighlightColor:"transparent",
          }}>{m.label}</button>
        ))}
      </div>

      {/* Diagram */}
      <div style={{ margin:"0 16px", borderRadius:12, overflow:"hidden", border:"1.5px solid #D4CCB8", background: diagramMode === "illustration" ? "radial-gradient(ellipse at 38% 28%, #E8E2D4, #C8C0B0)" : "#F5F2EB" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"16px 8px" }}>
          <div style={{ width: diagramMode === "profile" ? "100%" : 220 }}>
            {diagramMode === "profile" ? (
              <RacquetProfile shape={shapeId} faceId={faceId} coreObj={core} frameObj={frame} thicknessMm={thicknessMm} widthMm={widthMm} lengthMm={lengthMm} holes={holes} gripShapeId={gripShapeId}/>
            ) : diagramMode === "illustration" ? (
              <RacquetIllustration3D {...diagramProps} />
            ) : (
              <RacquetDiagram {...diagramProps} mode={diagramMode}/>
            )}
          </div>
        </div>

        {/* Info strip */}
        <div style={{ background:"#EDEADE", padding:"10px 14px", borderTop:"1px solid #D8D4C8" }}>
          {diagramMode !== "profile" && (
            <p style={{ fontSize:12, color:"#5A574C", lineHeight:1.5, margin:0, fontFamily:"Inter, sans-serif" }}>
              <strong style={{color:"#26241E"}}>Sweet spot:</strong> {sweetSpotPosLabel(shapeId, balanceCm)} ·{" "}
              <strong style={{color:"#26241E"}}>Stability:</strong> {stabilityPct}% — {stabilityPct >= 65 ? "tight, resists off-center twist" : stabilityPct >= 45 ? "moderate wobble zone" : "looser, twists more off-center"}
            </p>
          )}
          {diagramMode === "profile" && (
            <p style={{ fontSize:12, color:"#5A574C", lineHeight:1.5, margin:0, fontFamily:"Inter, sans-serif" }}>
              Side-on profile — head thickness <strong style={{color:"#26241E"}}>{thicknessMm}mm</strong> ({Math.round(((thicknessMm-28)/10)*100)}% toward the 38mm FIP max). Depth exaggerated for legibility.
            </p>
          )}
        </div>
      </div>

      {/* Quick score strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, margin:"16px", }}>
        {[["Power",scores.power],["Control",scores.control],["Comfort",scores.comfort],["Spin",scores.spin]].map(([label,val]) => (
          <div key={label as string} style={{ background:"rgba(0,0,0,0.035)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:8, padding:"10px 8px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, color:LIME }}>{(val as number).toFixed(1)}</div>
            <div style={{ fontSize:10, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", marginTop:2, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
          </div>
        ))}
      </div>

      {mode === "manufacturer" && fto_flagged && <div style={{margin:"0 16px"}}><FTOWarning/></div>}
    </div>
  );

  // ---- SCORES CONTENT ----
  const scoresContent = (
    <div style={{ padding:"0 16px" }}>

      {/* Existing mold baseline comparison — when factory brief found an exact match */}
      {mode === "manufacturer" && (() => {
        // Find the closest market racquet to show as baseline
        const topMatch = matchedRacquets[0];
        if (!topMatch || topMatch.matchPct < 85) return null;
        const r = topMatch.racquet;
        const baselineCore = CORE_MATERIALS.find(m => m.id === r.coreId);
        const baselineFace = FACE_MATERIALS.find(m => m.id === r.faceId);
        const baselineFrame = FRAME_MATERIALS.find(m => m.id === r.frameId);
        const baselineSurface = SURFACE_TEXTURES.find(m => m.id === r.surfaceId);
        if (!baselineCore || !baselineFace || !baselineFrame || !baselineSurface) return null;
        const baselineScores = computeScores({ shape: r.shapeId, core: baselineCore, face: baselineFace, frame: baselineFrame, surface: baselineSurface, grip: GRIP_MATERIALS[0], bridgeId: "open", beamOrientation: "vertical", holes: generateLegacyHoleGrid("standard", "even", r.shapeId), holeDiameterMm: 9, weightG: r.weightG, balanceCm: r.balanceCm, widthMm: 255, thicknessMm: r.thicknessMm ?? 38 });
        const categories: { key: keyof typeof scores; label: string }[] = [
          { key: "power", label: "Power" },
          { key: "control", label: "Control" },
          { key: "comfort", label: "Comfort" },
          { key: "sweetSpot", label: "Sweet Spot" },
          { key: "stability", label: "Stability" },
          { key: "spin", label: "Spin" },
          { key: "durability", label: "Durability" },
        ];
        return (
          <div style={{ padding:"16px", background:"rgba(0,0,0,0.025)", border:"1px solid rgba(26,92,42,0.2)", borderRadius:12, marginBottom:16 }}>
            <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#1A5C2A", marginBottom:4 }}>Build vs Baseline — {r.brand} {r.model}</p>
            <p style={{ fontSize:11.5, color:"#7A7268", margin:"0 0 12px", fontFamily:"Inter, sans-serif", lineHeight:1.5 }}>
              {topMatch.matchPct}% spec match in the database. Showing delta between your current build and this reference.
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, marginBottom:8 }}>
              <div style={{ fontSize:9, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase" }}></div>
              <div style={{ fontSize:9, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase", textAlign:"center" }}>Baseline</div>
              <div style={{ fontSize:9, color:"#1A5C2A", fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase", textAlign:"center" }}>Your build</div>
            </div>
            {categories.map(({ key, label }) => {
              const base = baselineScores[key] ?? 0;
              const curr = scores[key] ?? 0;
              const delta = curr - base;
              return (
                <div key={key} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:11, color:"#4A4540", fontFamily:"Inter, sans-serif" }}>{label}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ flex:1, height:3, background:"#D4CCB8", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${(base/5)*100}%`, height:"100%", background:"#C0B8A4" }}/>
                    </div>
                    <span style={{ fontSize:10, fontFamily:"'JetBrains Mono', monospace", color:"#7A7268", minWidth:24, textAlign:"right" }}>{base.toFixed(1)}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ flex:1, height:3, background:"#D4CCB8", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${(curr/5)*100}%`, height:"100%", background:"#1A5C2A" }}/>
                    </div>
                    <span style={{ fontSize:10, fontFamily:"'JetBrains Mono', monospace", color: delta > 0.1 ? "#1A5C2A" : delta < -0.1 ? "#991B1B" : "#7A7268", minWidth:24, textAlign:"right" }}>{curr.toFixed(1)}</span>
                    {Math.abs(delta) > 0.1 && <span style={{ fontSize:9, color: delta > 0 ? "#1A5C2A" : "#991B1B", minWidth:28 }}>{delta > 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(1)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div style={{ padding:"16px", background:"rgba(0,0,0,0.025)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:12, marginBottom:16 }}>
        <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7A7268", marginBottom:0 }}>Playability Index</p>
        <PlayabilityRadar scores={scores}/>
      </div>

      <div style={{ padding:"16px", background:"rgba(0,0,0,0.025)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:12, marginBottom:16 }}>
        <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7A7268", marginBottom:14 }}>Scores</p>
        <ScoreBar label="Power" val={scores.power}/>
        <ScoreBar label="Control" val={scores.control}/>
        <ScoreBar label="Comfort / Vibration Damping" val={scores.comfort}/>
        <ScoreBar label="Sweet Spot Size" val={scores.sweetSpot}/>
        <ScoreBar label="Stability (Off-Center Resistance)" val={scores.stability}/>
        <ScoreBar label="Spin Potential" val={scores.spin}/>
        <ScoreBar label="Durability" val={scores.durability}/>
        <p style={{ fontSize:11, color:"#7A7268", lineHeight:1.5, marginTop:12, fontFamily:"Inter, sans-serif" }}>
          Index is a directional model derived from published material characteristics, not a lab-measured value. Use it to compare configurations, not as a guaranteed spec.
        </p>
      </div>

      {mode === "manufacturer" && (
        <div style={{ padding:"16px", background:"rgba(0,0,0,0.025)", border:"1px solid rgba(26,92,42,0.15)", borderRadius:12, marginBottom:16 }}>
          <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#1A5C2A", marginBottom:4 }}>Physics Engine — Geometry-Based Mechanics</p>
          <p style={{ fontSize:11.5, color:"#7A7268", lineHeight:1.5, marginTop:0, marginBottom:14, fontFamily:"Inter, sans-serif" }}>
            Computed directly from this build's mass distribution using standard rigid-body mechanics (moment of inertia, parallel-axis theorem) — not estimates. Real units, directly comparable build-to-build.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ background:"rgba(0,0,0,0.035)", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Swingweight</div>
              <div style={{ fontSize:20, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, color:"#18181B" }}>{geometryPhysics.swingweightKgCm2.toFixed(1)} <span style={{fontSize:12, color:"#7A7268", fontWeight:600}}>kg·cm²</span></div>
              <div style={{ fontSize:10.5, color:"#7A7268", marginTop:3, fontFamily:"Inter, sans-serif" }}>Moment of inertia about a pivot 10cm from the butt — depends on WHERE mass sits, not just how much there is. A heavier but head-light build can score lower here than a lighter, head-heavy one. Same units and pivot convention used for tennis swingweight; there's no meaningful way to express this in grams, since it isn't a mass measurement.</div>
            </div>
            <div style={{ background:"rgba(0,0,0,0.035)", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Twistweight</div>
              <div style={{ fontSize:20, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, color:"#18181B" }}>{geometryPhysics.twistweightKgCm2.toFixed(2)} <span style={{fontSize:12, color:"#7A7268", fontWeight:600}}>kg·cm²</span></div>
              <div style={{ fontSize:10.5, color:"#7A7268", marginTop:3, fontFamily:"Inter, sans-serif" }}>Polar moment about the long axis. Higher = more resistant to twisting on off-center hits.</div>
            </div>
            <div style={{ background:"rgba(0,0,0,0.035)", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Polar Inertia (SI)</div>
              <div style={{ fontSize:20, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, color:"#18181B" }}>{geometryPhysics.polarInertiaKgM2.toFixed(5)} <span style={{fontSize:12, color:"#7A7268", fontWeight:600}}>kg·m²</span></div>
              <div style={{ fontSize:10.5, color:"#7A7268", marginTop:3, fontFamily:"Inter, sans-serif" }}>Same twistweight value in standard SI units, for cross-referencing published research.</div>
            </div>
            <div style={{ background:"rgba(0,0,0,0.035)", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Balance Point</div>
              <div style={{ fontSize:20, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, color:"#18181B" }}>{geometryPhysics.balanceCm.toFixed(1)} <span style={{fontSize:12, color:"#7A7268", fontWeight:600}}>cm</span></div>
              <div style={{ fontSize:10.5, color:"#7A7268", marginTop:3, fontFamily:"Inter, sans-serif" }}>Distance from the butt end to the center of mass — your existing Dimensions slider value, restated here as a mechanics input.</div>
            </div>
          </div>
          <p style={{ fontSize:10.5, color:"#7A7268", lineHeight:1.5, marginTop:12, fontFamily:"Inter, sans-serif" }}>
            Reference: published tennis-racket research places swingweight at roughly 270–310 kg·cm² and twistweight at roughly 12–15 kg·cm² for tournament frames. Padel values run meaningfully lower, consistent with a shorter (≤45.5cm vs. ~68–70cm) and narrower solid-faced design.
          </p>
        </div>
      )}

      {mode === "manufacturer" && (
        <div style={{ padding:"16px", background:"rgba(0,0,0,0.025)", border:"1px solid rgba(255,180,0,0.15)", borderRadius:12, marginBottom:16 }}>
          <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#D97706", marginBottom:4 }}>Relative Material Index (RPS)</p>
          <p style={{ fontSize:11.5, color:"#7A7268", lineHeight:1.5, marginTop:0, marginBottom:14, fontFamily:"Inter, sans-serif" }}>
            Not a lab measurement — no padel equivalent to tennis's RA deflection-test scale exists yet. This is a transparent, internally-consistent 0–100 relative index, weighted from real, sourced composite-engineering relationships (core hardness and frame material dominate; carbon tow size is deliberately a small secondary factor, not the headline number).
          </p>
          <ScoreBar label="RPS — Stiffness Index" val={materialPhysics.rpsIndex / 20} max={5} />
          <ScoreBar label="Damping Index" val={materialPhysics.dampingIndex / 20} max={5} />
          <ScoreBar label="Impact Stiffness" val={materialPhysics.impactStiffnessIndex / 20} max={5} />
          <ScoreBar label="Rebound Index" val={materialPhysics.reboundIndex / 20} max={5} />
          <div style={{ marginTop:10, padding:"10px 12px", background: Math.abs(materialPhysics.kCountContributionPts) > 0.01 ? "#FEF3C7" : "rgba(0,0,0,0.025)", border: Math.abs(materialPhysics.kCountContributionPts) > 0.01 ? "1px solid #D97706" : "1px solid rgba(0,0,0,0.045)", borderRadius:8 }}>
            <p style={{ fontSize:11.5, color: Math.abs(materialPhysics.kCountContributionPts) > 0.01 ? "#92400E" : "#7A7268", margin:0, fontFamily:"Inter, sans-serif" }}>
              <strong>Carbon tow-size contribution to RPS: {materialPhysics.kCountContributionPts >= 0 ? "+" : ""}{materialPhysics.kCountContributionPts.toFixed(2)} points</strong> (of 100). This is the market-correction number: tow size (3K/12K/18K) is mainly a weave-density and manufacturing spec, not a stiffness specification — composite-engineering sources confirm fiber grade, not tow size, governs material stiffness when fiber type is held constant. Core hardness and frame material together carry roughly 60% of this index; face material category (fiberglass vs. carbon vs. graphene vs. kevlar) carries the rest — tow size is a small nudge within that, by design.
            </p>
          </div>
        </div>
      )}

      {/* Build Summary */}
      <div style={{ padding:"16px", background:"rgba(0,0,0,0.025)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:12, marginBottom:24 }}>
        <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7A7268", marginBottom:12 }}>Current Build</p>
        <div style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:12, lineHeight:1.9 }}>
          {[
            ["Shape", shape.label],
            ["Length / Width", `${lengthMm}mm / ${widthMm}mm`],
            ["Thickness", `${thicknessMm}mm`],
            ["Weight", `${weightG}g`],
            ["Balance", `${balanceCm}cm`],
            ["Face", face.label],
            ["Core", core.label],
            ["Frame", frame.label],
            ["Surface", surface.label],
            ["Bridge", bridgeId === "open" ? `${bridge.label} — ${beamCount} ${beamOrientation} beam${beamCount>1?"s":""}` : bridge.label],
            ["Grip", `${grip.label}`],
            ["Grip Circ.", `${gripCircMm}mm`],
            ["Holes", holes.length === 0 ? "None (solid face)" : `${holes.length} holes — ${holeDiameterMm}mm diameter`],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid rgba(0,0,0,0.04)", padding:"2px 0", gap:8 }}>
              <span style={{ color:"#7A7268", flexShrink:0 }}>{k}</span>
              <span style={{ color:"#4A4540", textAlign:"right" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Closest real-market racquets */}
      <div style={{ padding:"16px", background:"rgba(0,0,0,0.025)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:12, marginBottom:24 }}>
        <p style={{ fontSize:11, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7A7268", marginBottom:4 }}>Closest racquets on the market</p>
        <p style={{ fontSize:11.5, color:"#7A7268", lineHeight:1.5, marginTop:0, marginBottom:14, fontFamily:"Inter, sans-serif" }}>
          Matched against {MARKET_RACQUETS.length} verified models across 11 brands. Every model is scored by the same formula; none is favored. Percentages reflect spec similarity to your current build, not a quality ranking.
        </p>
        {matchedRacquets.map((m, i) => (
          <div key={m.racquet.id} style={{ padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.045)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 13.5, color: "#18181B", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>{m.racquet.brand} {m.racquet.model}</span>
              <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#1A5C2A", fontWeight: 700 }}>{m.matchPct}%</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#7A7268", lineHeight: 1.5, margin: "0 0 6px", fontFamily: "Inter, sans-serif" }}>
              {m.reasons.length > 0 ? m.reasons.join(" · ") : "Partial match on some dimensions"}
            </p>
            {m.racquet.note && (
              <p style={{ fontSize: 11.5, color: "#4A4540", lineHeight: 1.6, margin: "0 0 4px", fontFamily: "Inter, sans-serif", paddingLeft: 10, borderLeft: "2px solid rgba(0,0,0,0.07)" }}>
                {m.racquet.note}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,0.035)", padding: "2px 6px", borderRadius: 4 }}>{m.racquet.shapeId}</span>
              <span style={{ fontSize: 10, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,0.035)", padding: "2px 6px", borderRadius: 4 }}>{m.racquet.weightG}g</span>
              <span style={{ fontSize: 10, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,0.035)", padding: "2px 6px", borderRadius: 4 }}>{m.racquet.balanceCm}cm balance</span>
              <span style={{ fontSize: 10, color: "#7A7268", fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,0.035)", padding: "2px 6px", borderRadius: 4 }}>{m.racquet.priceTier}</span>
              {m.racquet.sourceConfidence === "approximate" && (
                <span style={{ fontSize: 10, color: "#92400E", fontFamily: "Inter, sans-serif", padding: "2px 6px", background: "#FEF3C7", borderRadius: 4 }}>⚠ specs approximate</span>
              )}
            </div>
          </div>
        ))}
        <p style={{ fontSize: 10.5, color: "#7A7268", lineHeight: 1.5, marginTop: 12, fontFamily: "Inter, sans-serif" }}>
          Specs were cross-checked against multiple independent sources where possible. Padel brands frequently update models year to year and offer weight-adjustment systems on several of these racquets, so treat exact weight/balance figures as approximate — verify current specs with the retailer before purchasing.
        </p>
      </div>

      {mode === "manufacturer" && (
        <p style={{ fontSize:11, color:"#7A7268", lineHeight:1.6, marginBottom:32, fontFamily:"Inter, sans-serif" }}>
          Material playability characteristics are drawn from publicly available manufacturer and OEM technical guides current as of mid-2026. Brand-specific marketing names are intentionally not used — this tool models the underlying material science. Always confirm freedom-to-operate with qualified patent counsel before committing a design to production.
        </p>
      )}
    </div>
  );

  // ---- FIND CONTENT (standalone tab) ----
  const findContent = (
    <div style={{ padding:"0 16px" }}>
      {mode === "manufacturer" ? (
        <FactoryBriefPanel onApply={handleApplyFactorySpec}/>
      ) : (
        <FindRacquetPanel onApply={handleApplyRec} mode={mode}/>
      )}
    </div>
  );

  const tabContent = {
    find: findContent,
    build: buildContent,
    view: viewContent,
    scores: scoresContent,
  };

  return (
    <div style={{ fontFamily:"Inter, system-ui, sans-serif", background:"#F0EBE0", minHeight:"100dvh", color:"#18181B" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        scrollbar-width: none;
        input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; background: rgba(0,0,0,0.08); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #1A5C2A; cursor: pointer; border: 2px solid #FFFFFF; box-shadow: 0 0 0 2px rgba(26,92,42,0.4); }
        input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #1A5C2A; cursor: pointer; border: 2px solid #FFFFFF; }
        select option { background: #FFFFFF; color: #18181B; }
        button { -webkit-tap-highlight-color: transparent; }
        @keyframes forja-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: forja-spin 0.8s linear infinite; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background:"#FFFFFF", borderBottom:"1.5px solid #D4CCB8", position:"sticky", top:0, zIndex:50 }}>
        <div className="header-row" style={{ maxWidth:1024, margin:"0 auto", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Racquet icon */}
            <div style={{ width:32, height:32, borderRadius:8, background:"rgba(26,92,42,0.15)", border:"1px solid rgba(26,92,42,0.35)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <ellipse cx="9" cy="9" rx="7" ry="7" stroke="#1A5C2A" strokeWidth="1.8"/>
                <path d="M14.5 14.5 L21 21" stroke="#1A5C2A" strokeWidth="2.2" strokeLinecap="round"/>
                <circle cx="9" cy="9" r="2.5" fill="rgba(26,92,42,0.25)" stroke="#1A5C2A" strokeWidth="1.2" strokeDasharray="2 2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:16, letterSpacing:"0.04em", color:"#18181B", lineHeight:1 }}>FOR<span style={{color:"#1A5C2A"}}>JA</span></div>
              <div style={{ fontSize:10, color:"#7A7268", fontFamily:"'JetBrains Mono', monospace", letterSpacing:"0.06em", lineHeight:1, marginTop:2 }}>{shape.label.toUpperCase()} · {weightG}G · {balanceCm}CM</div>
            </div>
          </div>

          <div className="header-actions" style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Save & Share */}
          <button
            onClick={handleSaveBuild}
            disabled={shareStatus === "saving" || !supabaseConfigured}
            title={!supabaseConfigured ? "Save & Share is coming soon" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              border: `1px solid ${supabaseConfigured ? "rgba(26,92,42,0.35)" : "rgba(0,0,0,0.06)"}`,
              background: shareStatus === "saved" ? "rgba(26,92,42,0.15)" : "rgba(0,0,0,0.035)",
              color: supabaseConfigured ? "#1A5C2A" : "#7A7268",
              fontSize: 12, fontWeight: 700, cursor: supabaseConfigured && shareStatus !== "saving" ? "pointer" : "default",
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", textTransform: "uppercase",
              WebkitTapHighlightColor: "transparent", flexShrink: 0,
            }}
          >
            {shareStatus === "saving" ? (
              <Loader2 size={13} className="spin" />
            ) : shareStatus === "saved" ? (
              <CheckCircle2 size={13} />
            ) : (
              <Share2 size={13} />
            )}
            {shareStatus === "saved"
              ? "Link Copied"
              : shareStatus === "saving"
              ? "Saving…"
              : supabaseConfigured
              ? "Save & Share"
              : "Save & Share (soon)"}
          </button>

          {/* Mode toggle */}
          <div style={{ display:"flex", gap:4, background:"rgba(0,0,0,0.04)", padding:3, borderRadius:8, border:"1px solid rgba(0,0,0,0.05)" }}>
            {[{id:"player",label:"Player",icon:<User size={12}/>},{id:"manufacturer",label:"Factory",icon:<Wrench size={12}/>}].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id as any); analytics.modeChanged(m.id); }} style={{
                display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:6, border:"none",
                background: mode===m.id ? "#1A5C2A" : "transparent",
                color: mode===m.id ? "#F0EBE0" : "#7A7268",
                fontSize:11.5, fontWeight:700, cursor:"pointer",
                fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:"0.05em", textTransform:"uppercase",
                WebkitTapHighlightColor:"transparent", transition:"all 0.15s ease",
              }}>{m.icon}{m.label}</button>
            ))}
          </div>
          </div>
        </div>
      </header>

      {loadStatus === "error" && (
        <div style={{ background: "#FEF3C7", borderBottom: "1px solid #D97706", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <AlertTriangle size={14} color="#D97706" />
          <span style={{ fontSize: 12.5, color: "#92400E", fontFamily: "Inter, sans-serif" }}>That build link doesn't exist or may have been removed — showing the default build instead.</span>
        </div>
      )}
      {shareStatus === "error" && shareError && (
        <div style={{ background: "#FEE2E2", borderBottom: "1px solid #F87171", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <AlertTriangle size={14} color="#991B1B" />
          <span style={{ fontSize: 12.5, color: "#991B1B", fontFamily: "Inter, sans-serif" }}>{shareError}</span>
        </div>
      )}

      {/* ── TABLET LAYOUT (md+) ── */}
      <div style={{ maxWidth:1024, margin:"0 auto" }} className="md-layout">
        <div style={{ display:"grid" }} className="content-grid">

          {/* Desktop: two-column */}
          <style>{`
            @media (min-width: 768px) {
              .content-grid { grid-template-columns: 380px 1fr !important; min-height: calc(100dvh - 57px); }
              .left-col { border-right: 1px solid rgba(0,0,0,0.05); overflow-y: auto; height: calc(100dvh - 57px); position: sticky; top: 57px; }
              .right-col { padding: 0; display: flex; flex-direction: column; }
              .bottom-nav { display: none !important; }
              .mobile-only { display: none !important; }
              .desktop-right-tabs { display: flex !important; }
              .main-scroll { padding-bottom: 24px !important; }
            }
            @media (max-width: 767px) {
              .content-grid { grid-template-columns: 1fr !important; }
              .left-col { display: none !important; }
              .right-col { display: none !important; }
              .desktop-right-tabs { display: none !important; }
              .header-row { flex-wrap: wrap; }
              .header-actions { flex: 1 1 100%; justify-content: space-between; margin-top: 8px; }
            }
          `}</style>

          {/* Left col: build sections (desktop only) */}
          <div className="left-col" style={{ padding:"8px 0" }}>
            {buildContent}
          </div>

          {/* Right col: view + scores (desktop only) */}
          <div className="right-col">
            {/* Tab strip */}
            <div className="desktop-right-tabs" style={{ display:"none", padding:"12px 20px 0", gap:8, borderBottom:"1px solid rgba(0,0,0,0.05)" }}>
              {[{id:"view",label:"Visualize",icon:<Eye size={14}/>},{id:"scores",label:"Scores & Summary",icon:<BarChart3 size={14}/>}].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{
                  display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:"8px 8px 0 0",
                  border:"1px solid rgba(0,0,0,0.05)", borderBottom:"none",
                  background: activeTab===t.id ? "#EAF3EC" : "transparent",
                  color: activeTab===t.id ? "#1A5C2A" : "#7A7268",
                  fontSize:12.5, fontWeight:700, cursor:"pointer",
                  fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:"0.06em", textTransform:"uppercase",
                  WebkitTapHighlightColor:"transparent",
                }}>{t.icon}{t.label}</button>
              ))}
            </div>
            <div style={{ overflowY:"auto", flex:1, padding:"0", paddingBottom:24 }}>
              {(activeTab === "view" || activeTab === "find" || activeTab === "build") ? viewContent : scoresContent}
            </div>
          </div>

        </div>
      </div>

      {/* ── MOBILE LAYOUT ── */}
      {/* Mobile main scroll area */}
      <div className="mobile-only main-scroll" style={{ paddingBottom:"calc(72px + env(safe-area-inset-bottom))", WebkitOverflowScrolling:"touch" }}>
        {tabContent[activeTab]}
      </div>

      {/* Bottom nav (mobile only) */}
      <nav className="bottom-nav" style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:100,
        background:"#FFFFFF",
        borderTop:"1.5px solid #D4CCB8",
        paddingBottom:"env(safe-area-inset-bottom)",
        display:"flex",
        transform:"translateZ(0)", WebkitTransform:"translateZ(0)", willChange:"transform",
      }}>
        {tabDefs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            padding:"10px 4px", border:"none", background:"none", cursor:"pointer",
            color: activeTab===tab.id ? "#1A5C2A" : "#B0A898",
            WebkitTapHighlightColor:"transparent", transition:"color 0.15s ease", gap:4,
          }}>
            <span style={{ transition:"color 0.15s ease" }}>{tab.icon}</span>
            <span style={{ fontSize:9.5, fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{tab.label}</span>
            {activeTab===tab.id && <span style={{ position:"absolute", bottom:"env(safe-area-inset-bottom)", width:20, height:2, borderRadius:1, background:"#1A5C2A" }}/>}
          </button>
        ))}
      </nav>
    </div>
  );
}
