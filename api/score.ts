// PalaLab scoring engine - SERVER-ONLY (Vercel Edge Function).
// Trade-secret core: material tables plus scoring math.
// Must never be imported by client code or shipped in the browser bundle.
export const config = { runtime: "edge" };
const CORE_MATERIALS = [
  { id: "eva-soft", label: "EVA Foam — Soft", density: "20–25 kg/m³", hardnessShoreC: "30–40°C", power: 2, control: 4, comfort: 5, sweetSpot: 5, durability: 3, note: "Ethylene-vinyl acetate foam at its lowest commercial density for padel. Compresses significantly under ball impact, giving long dwell time and a wide sweet spot. Absorbs ~30–40% of impact energy as heat rather than returning it to the ball — controlled feel, gentle on the arm. Shore C 30–40° is the QC spec to request from factories. Primary failure mode: foam cell collapse over time — soft EVA wears faster than hard EVA under equivalent loads. Royal Padel M27 Poly uses PE (see below) for even softer feel, but soft EVA is the most common arm-friendly core.", bestFor: "Beginners, recreational, arm/elbow sensitivity, defensive play", manufacturingNote: "Standard OEM. EVA foam blanks cut or molded then wrapped in carbon during co-cure. Specify Shore C range, not just 'soft'." },
  { id: "eva-medium", label: "EVA Foam — Medium", density: "25–32 kg/m³", hardnessShoreC: "40–55°C", power: 3, control: 3, comfort: 3, sweetSpot: 4, durability: 4, note: "The industry default — majority of padel racquets produced globally. Compresses and rebounds quickly, splitting power/control. Multiple brands (Bullpadel MultiEva, Head Power Foam mid-range) tune within this zone with proprietary density gradients. The 'medium' label covers a meaningful range — 26 kg/m³ vs 31 kg/m³ is perceptible on direct comparison. Request Shore C confirmation (40–55°) rather than relying on supplier's 'medium' designation.", bestFor: "Intermediate players, all-round builds, highest commercial volume", manufacturingNote: "Readily available from all major EVA suppliers. Cost-neutral vs soft." },
  { id: "eva-hard", label: "EVA Foam — Hard", density: "30–45 kg/m³", hardnessShoreC: "55–75°C", power: 5, control: 4, comfort: 1, sweetSpot: 2, durability: 5, note: "Dense, low-compressibility foam. At 40+ kg/m³ ball-core contact drops to ~3–5ms vs 8–12ms for soft EVA — energy is returned to the ball rather than absorbed. Smashes feel explosive, mishits transmit full impact to the arm. Shore C 55–75° should be specified and tested. Babolat Viper, Adidas Metalbone HRD+, Wilson Bela Pro, StarVie Triton+ all use hard EVA. Excellent long-term durability. Medical caveat: players with existing elbow or shoulder injuries should avoid this specification.", bestFor: "Advanced players, smash-dominant styles, net-forward attacking play", manufacturingNote: "Standard OEM. Hard EVA marginally more expensive per kg but negligible at racquet scale (~95g foam). Specify Shore C range and request batch QC." },
  { id: "foam-pe", label: "Polyethylene Core Foam (PE)", density: "15–22 kg/m³", hardnessShoreC: "18–30°C", power: 1, control: 2, comfort: 5, sweetSpot: 4, durability: 2, note: "Closed-cell polyethylene rather than EVA. PE is softer and more elastic — its molecular structure allows greater deformation and recovery without permanent set. Lower energy-loss coefficient than EVA at equivalent density — can feel both softer AND more lively than soft EVA depending on impact velocity. Royal Padel uses PE core (branded 'Poly Core') in their M27 Poly line targeting players with elbow sensitivity. PE wears faster than EVA — cell wall fatigue resistance is lower. Not appropriate for players hitting heavy balls at high frequency.", bestFor: "Entry-level, recreational, arm-protection priority, low-to-medium frequency play", manufacturingNote: "Less commonly stocked by padel OEM factories than EVA. PE bonds to carbon less readily — primer treatment may be required. Confirm supplier capability before specifying." },
  { id: "hybrid-core", label: "Hybrid Dual-Density Core", density: "20–40 kg/m³ varies by zone", hardnessShoreC: "30–40° throat / 50–65° tip", power: 4, control: 4, comfort: 3, sweetSpot: 4, durability: 3, note: "Two distinct foam densities bonded or co-molded into one core insert — softer near the throat (defensive touch shots, net volleys) and firmer toward the tip (offensive smashes, high-speed contact). The rationale: optimal foam stiffness for a 90 km/h smash differs from optimal for a soft lob return. Bullpadel's MultiEva (Neuron 02, Hack 04) and Nox AT10 Genius both implement this. Manufacturing complexity is higher — requires two-pour process or precision-bonded insert. Delamination between foam zones is a failure mode not present in single-density cores. Worth the complexity for advanced players who genuinely use the full court.", bestFor: "Advanced all-court players, players transitioning between net and baseline frequently", manufacturingNote: "Specify the density of each zone and transition depth from throat — these are independent design variables. Gradient transition (co-molded) is more consistent but harder to produce than two bonded pieces." },
  { id: "two-piece-cassette-core", label: "Modular Foam Cassette Insert", experimental: true, density: "varies — any EVA spec", hardnessShoreC: "varies", power: 3, control: 3, comfort: 3, sweetSpot: 3, durability: 5, note: "A construction architecture rather than a foam type: the foam is pre-formed as a discrete insert placed inside a separately-manufactured hollow tube frame, rather than co-molded with the carbon. Frame and foam are independent components. Enables: (1) foam replacement without replacing the frame — the carbon shell, which carries all structural load, lasts indefinitely while foam inserts are replaced when worn; (2) modular product lines — one frame mold produces multiple racquets differentiated by foam density insert; (3) experimentation with non-EVA core materials without redesigning the frame. The foam does not bond to the carbon — retained by geometry and slight compression fit (2–3% oversize), which improves vibration damping versus bonded foam because micro-slip at the interface absorbs energy. Precedent in tennis racquet patents (US6071203, US6800239) but never applied to padel's solid-face geometry. IP note: hollow tube padel frame + captured modular foam cassette + horizontal clamshell bond + solid face geometry is potentially patentable in the padel context.", bestFor: "Premium product lines, replaceable-core business model, research builds, performance customization at retail", manufacturingNote: "Higher tooling cost (two frame half-molds + foam insert mold). Assembly adds 2–3 steps per unit. Co-cure bonding (both frame halves partially cured when pressed) achieves full structural integrity. Creates a fundamentally different product category — recurring foam insert revenue model." },
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
  { id: "hollow-tubular-frame", label: "Hollow Tubular Frame", experimental: true, stiffness: 5, weightImpact: "Light", torsionalRigidity: "Very high", vibrationFrequency: "Very high", note: "Standard in tennis for 40+ years, essentially absent from padel. A hollow tube distributes bending loads to the outer walls (perimeter) where they generate highest internal stresses — structurally more efficient than solid cross-section. A 1.5mm-wall hollow carbon tube is stiffer in bending per gram than a 5mm solid carbon rod of the same outer diameter. Manufacturing: bladder molding — pre-preg carbon wrapped around inflatable nylon bladder, placed in clamshell mold, heated to 140–150°C while bladder pressurized to 5–8 bar, forcing carbon against mold walls. After cure (~25 min), demolded. In hollow tube padel construction: NO foam inside the frame tube — foam sits in the central face area. Throat is a continuous narrowing of the same hollow tube — structurally continuous, eliminating the main failure zone of current padel construction. Weight: 10–18g lighter than foam-filled equivalent at same stiffness. Vibration frequency is higher — some players describe as 'livelier'. Can cause arm fatigue over long sessions if not compensated with damping materials at grip/throat.", manufacturingNote: "Bladder molding tooling: $8,000–$14,000 vs $3,000–$5,000 for standard padel molds. Bladder nylon inserts are low-cost per-part consumables. Cure time similar to standard padel (~25–30 min). Critical design element: transition from hollow perimeter tube to the face panel area." },
  { id: "honeycomb-reinforced-frame", label: "Honeycomb-Reinforced Frame", experimental: true, stiffness: 4, weightImpact: "Mid", torsionalRigidity: "High", vibrationFrequency: "Medium-high", note: "Structural honeycomb core (aluminum alloy or Nomex aramid paper) bonded inside a hollow carbon tube frame. The honeycomb occupies the void inside the tubular frame perimeter, providing shear resistance in the frame wall — preventing thin carbon walls from buckling under compressive load. Standard in premium tennis frames since the 1970s and aerospace sandwich panels. Near-zero density but very high out-of-plane shear modulus — stabilizes frame wall against local buckling without meaningful weight. Vs solid foam fill: 30–50% weight reduction, higher structural rigidity, better vibration damping (honeycomb cell geometry excels at absorbing high-frequency vibrations). Not commercially applied in padel.", manufacturingNote: "More complex than standard hollow tube. Honeycomb must be pre-cut to frame cross-section profile and bonded inside before or during cure. Nomex honeycomb preferred over aluminum for vibration characteristics. Adds cost vs hollow tube alone." },
  { id: "two-piece-clamshell-frame", label: "Two-Piece Clamshell Frame (Modular Hollow)", experimental: true, stiffness: 5, weightImpact: "Light", torsionalRigidity: "Very high", vibrationFrequency: "High", note: "Frame manufactured as two horizontal halves — the racquet laid flat, split along the face plane — bonded together around a pre-placed foam insert. Direct precedent in tennis patents (US6071203 'Two piece sports racquet', US6800239). Manufacturing sequence: (1) Upper half laid up in carbon pre-preg in its half-mold and B-staged (partially cured — pliable but formed). (2) Foam insert placed inside lower half. (3) Upper half pressed onto lower half. (4) Full press at 140–150°C completes cure and fuses the two halves. The bond line runs around the full frame perimeter at the face mid-plane — under ball impact loads the seam is in shear, which is the optimal loading condition for co-cure bonds. Co-cure bonding achieves strength indistinguishable from one-piece construction in mechanical testing. Throat-to-handle continues as a continuous hollow tube — only the face/frame section uses the clamshell approach, avoiding the highest-stress junction. Key advantages: foam is mechanically captured without bonding (retained by geometry and 2–3% compression fit), frame mold reused for all foam variants, holes can be pre-formed during cure using pin inserts rather than drilled afterward. IP status: this specific combination — hollow tube padel frame + captured foam cassette + clamshell bond + solid face geometry — is novel in padel and potentially patentable.", manufacturingNote: "Requires upper and lower half-molds (two tools per frame shape). Alignment fixtures critical. Total tooling: ~$12,000–$18,000 vs $3,000–$5,000 conventional. Assembly adds 2–3 steps per unit. Long-term per-unit economics potentially favorable due to modular foam line extensions." },
];

const SURFACE_TEXTURES = [
  { id: "smooth", label: "Smooth Face", spin: 1, power: 4.5, control: 4, durability: 5, textureLevel: 12, note: "Unfinished or lightly finished carbon/fiberglass face. Ball contact essentially frictionless — felt slides across surface. Energy transfer clean and efficient in shot direction. Most predictable ball exit angle, cleanest energy transfer for flat power shots, easiest to maintain, least performance degradation over time. Zero spin generation beyond what wrist technique alone produces. Used as a deliberate choice in control racquets where predictability is prioritized over spin potential.", manufacturingNote: "No additional finishing required. Standard as-molded carbon/glass surface." },
  { id: "rough", label: "Rough / Sandblasted / Grit-Coated Face", spin: 4, power: 3.5, control: 3.5, durability: 3.5, textureLevel: 62, note: "Surface roughness applied by: (1) Sandblasting — compressed abrasive media abrades the cured carbon surface creating micro-roughness of 10–30 μm Ra. Most common. (2) Abrasive coating — grit compound (aluminium oxide, silicon carbide) applied in resin carrier and cured onto surface. More durable than sandblasting. (3) Pre-textured carbon — rough weave produces texture directly from the mold. Mechanism: micro-peaks engage ball felt fibers during contact, transmitting more torque for spin. Spin increase vs smooth: approximately 20–35% higher ball spin rate under equivalent technique, based on analogous tennis surface studies. Trade-off: rough surfaces create slightly more drag on ball exit. Durability: sandblasted surfaces wear 20–30% reduction in surface friction after 200–300 playing hours as micro-peaks flatten.", manufacturingNote: "Sandblasting: post-cure step, grit size 60–120 μm typical. Abrasive coating: additional materials and application step. Both standard OEM processes." },
  { id: "3d-print", label: "3D-Printed Raised Micro-Texture", spin: 5, power: 3, control: 3.2, durability: 2.5, textureLevel: 88, note: "Raised geometric patterns (pyramids, diamonds, hexagons) applied via UV-cured resin printed directly onto the cured carbon face. Fundamentally different from sandblasting: adds positive material above the face (0.2–0.8mm raised) rather than abrading the surface. Ball felt engages with vertical walls of raised geometry rather than just micro-peaks. Spin increase: 30–50% higher than rough sandblasted surfaces in controlled comparisons. Raised structures more susceptible to damage from wall/floor contact than flush sandblasting. Premium cost: printing process adds manufacturing time and material cost. Used by Siux Diablo, Bullpadel Hack 04 line.", manufacturingNote: "Requires UV-cure 3D printing equipment (can be outsourced to specialist coating facilities). Pattern geometry, height, and coverage percentage are all design variables." },
  { id: "xl-honeycomb", label: "XL Honeycomb / Large-Cell Raised Pattern", spin: 5, power: 2.8, control: 3, durability: 3, textureLevel: 95, note: "Large raised honeycomb cells (cell diameter 3–8mm, wall height 0.3–1.0mm) molded or applied onto the face. Ball contacts raised cell walls rather than peaks — on a brushed spin shot, the ball edge engages cell walls perpendicular to the brush direction, generating higher torque. The large cell size creates turbulent boundary layer flow over the face during swing, subtly affecting swing resistance. Visually distinctive. Manufacturing approach: textured mold insert (most cost-effective for volume) or post-cure application. Mold insert creates the pattern during cure — integral to the carbon surface, more durable. Explored by SANE Padel's 3D Texture XL.", manufacturingNote: "Textured mold insert preferred for volume. EDM (electrical discharge machining) of mold texture adds $500–$2,000 per mold. Applied method possible but less durable." },
  { id: "hybrid-texture", label: "Hybrid Zone Texture (Center Rough / Edge Smooth)", spin: 4, power: 3.8, control: 3.6, durability: 4, textureLevel: 45, note: "Central hitting zone (~inner 60% of face area) has rough/textured treatment for spin; outer perimeter zone is smooth or lighter texture for aerodynamic efficiency. Engineering rationale: center is intended contact zone — maximizing grip there optimizes spin for well-struck shots. Smooth perimeter reduces swing drag slightly. Differential also creates tactile feedback cue: centered shots feel grippier (more spin engagement), off-center shots slightly slicker (less spin, cleaner exit). Helps players understand contact quality over time. Manufacturing: masking smooth zones during sandblasting/coating, or two mold inserts, or post-cure application with zone masking. Almost entirely unexplored commercially.", manufacturingNote: "Two-step finishing process. Masking must be precisely registered to face center. Adds 15–25 min per unit in finishing time. Define center zone diameter and transition clearly." },
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

// Frame edge geometry — the rounded (Babolat-style) vs sharp/boxy (Nox-style)
// profile of the outer frame. A real, cross-checked trade-off: a squared box
// section is stiffer in bending and presents a profiled edge brands tune for
// airflow (Nox markets "profiled edges to increase aerodynamics"), giving a
// crisper, more connected feel and faster head speed on a hard swing — but it
// buzzes more (needs damping) and its exposed corner is a stress riser that
// chips more easily (Nox reinforces the frame-into-face to counter cracking).
// A rounded profile flexes and damps a touch more (softer, comfier), resists
// chipping, and glances off the glass cleaner, at a small cost to aero/stiff
// feedback. "Standard" is the neutral default so every existing racquet scores
// exactly as before (no bias); only builds that opt in get the deviation.
const EDGE_PROFILES = [
  { id: "rounded", label: "Rounded", note: "Softened, tube-like outer frame edge. Flexes and damps slightly more than a boxed section, so the frame feels a touch softer and more comfortable and sends less buzz to the arm. The corner-free profile is a weaker stress riser, so it resists chipping and cracking, and it glances off the back/side glass more cleanly. The trade: marginally less aerodynamic and less of the crisp, ultra-connected feedback a squared edge gives. A control-and-comfort-oriented edge rather than a sharp-feedback one." },
  { id: "standard", label: "Standard", note: "A conventional edge — neither deliberately rounded nor sharply squared. The neutral middle ground and the default: no change to the scored trade-offs." },
  { id: "sharp", label: "Sharp / boxy", note: "A squared, well-defined box-section edge. Structurally stiffer in bending, so impact transmits more directly for a crisp, 'connected' feel with more feedback, and the profiled edge is engineered for airflow — on a heavy, head-heavy frame swung hard it converts to real head speed and smash power (the same aerodynamic logic behind profiled-edge frames). The trade: it buzzes more (stiff frames send more vibration, which is why boxy carbon frames are usually paired with dedicated damping) and its exposed corner is a stress riser that chips more easily unless reinforced." },
];

// Head-shape SIDE geometry — how curved vs straight/angular the head's side
// edges are. Rounded sides (most brands) bow outward smoothly; straight sides
// (Siux-style, and some geometric moulds) run the perimeter more directly
// between tip, shoulder and throat. Straightening pushes more of the frame's
// perimeter mass out to the widest zone, which raises twistweight/off-centre
// stability and broadens the sweet spot laterally, at a small aerodynamic cost
// (a flatter, larger side profile catches marginally more air). "Standard"
// (curved) is the neutral default so existing racquets are unchanged — no bias.
const SIDE_PROFILES = [
  { id: "curved", label: "Curved sides", note: "Smoothly bowed side edges — the conventional look on most padel moulds. Balanced twistweight and aerodynamics." },
  { id: "soft-straight", label: "Semi-straight", note: "Partly flattened sides — a subtle move toward a more geometric outline. A little more perimeter mass at the widest point for extra off-centre stability and a slightly wider sweet spot." },
  { id: "straight", label: "Straight sides", note: "Distinctly straight, angular side edges running more directly between tip, shoulder and throat. Concentrates the most perimeter mass at the widest zone → the highest twistweight and off-centre stability and the widest sweet spot of the three, at a small aerodynamic cost from the flatter, larger side profile." },
];

const SHAPES = [
  { id: "round", label: "Round", balanceRange: "low (closer to handle, typically 24.0–25.2cm)", sweetSpot: "Large, centered — typically 25–35mm radius", power: 2, control: 5, forgiveness: 5, note: "The round head places mass symmetrically around the face center, with the center of mass closest to the handle of any shape. Lowest swingweight (easiest to accelerate) and most centered sweet spot. Off-center hits cause less face rotation because twistweight (resistance to face twist) is maximized when mass is distributed symmetrically — round heads have higher effective twistweight per gram than diamond shapes. Power ceiling is lower not because 'round = soft' but because balance point is lower: power transfer on a smash scales with (M × d²) where d is the distance from pivot point to the mass. Lower balance = smaller d = lower effective swing mass = less smash power. The round is not 'just for beginners' — it is optimal for net-forward defensive players, arm-sensitive players, and any style prioritizing touch and placement over raw smash output.", bestFor: "Beginners, defensive players, net specialists, arm/shoulder sensitivity, high-frequency recreational play" },
  { id: "teardrop", label: "Teardrop (Hybrid)", balanceRange: "medium, typically 25.4–26.2cm", sweetSpot: "Medium, shifted slightly toward tip — typically 20–28mm radius", power: 4, control: 4, forgiveness: 3, note: "A geometric compromise — narrower at the base (throat) and wider at the tip — shifting mass slightly upward from round while keeping a wider midsection than diamond. Balance point between the two extremes. Sweet spot shifts slightly higher in the face, matching where most padel smashes actually contact the face. Swingweight moderate — easier to accelerate than diamond, heavier-feeling than round. Twistweight still reasonable — the wide midsection prevents the extreme face narrowing of a pure diamond, keeping some twistweight for mishit forgiveness. Most commercially versatile shape — majority of intermediate and advanced padel racquets globally. Advanced players who primarily play baseline control rallies often find teardrop satisfying: the power uplift versus round is significant while the control penalty versus diamond is modest.", bestFor: "Intermediate to advanced players, all-court play, the most commercially versatile specification" },
  { id: "diamond", label: "Diamond", balanceRange: "high, typically 26.3–27.5cm (from butt)", sweetSpot: "Small, positioned high in the face — typically 14–22mm radius", power: 5, control: 2, forgiveness: 1, note: "Diamond tapers sharply from widest point toward both tip and throat, concentrating mass at the top of the face. Highest balance point and highest swingweight — maximum smash power by the parallel-axis theorem. Sweet spot migrates toward the tip (where mass concentration is highest) and becomes small. Off-center contact causes significant face rotation because narrow midsection reduces twistweight — a diamond's resistance to face twist on mishit is substantially lower per gram than round or teardrop. The playing experience: hitting the sweet spot is explosive and rewarding. Missing it by even 10mm produces an arm-jarring deflection. This is a feature not a flaw for elite players — precision demand enforces technique discipline and the reward for clean contact is maximum. Coello, Galán, Lebrón, and Chingotto all use diamond because at their precision level the sweet spot miss-rate is low enough that the power ceiling benefit dominates.", bestFor: "Advanced players with consistent high-technique contact, attacking/finishing play styles, professional level" },
  { id: "diamond-wide", label: "Wide-Body Diamond", balanceRange: "high, typically 26.0–27.2cm", sweetSpot: "Medium-small, positioned high but laterally wider than standard diamond — ~18–26mm radius", power: 5, control: 3, forgiveness: 2, note: "Wider-than-standard diamond cross-section — maintaining the diamond's high balance point and mass-toward-tip principle but with broader face (typically 260–270mm vs standard 255mm). Wider body increases twistweight — moment of inertia about long axis scales with face width squared, so even 5mm width increase produces meaningful (~4%) improvement in twistweight. Directly translates to better forgiveness on off-axis hits while power character is preserved. Sweet spot is broader laterally. Addresses the primary complaint about diamonds — the narrow sweet spot — while retaining the signature power ceiling. A genuine market gap: standard diamonds are abundant, wide-body diamonds are essentially nonexistent commercially in 2026. FIP maximum face width is 26cm — verify specific competition rules.", bestFor: "Advanced players wanting diamond power with more structural forgiveness, players transitioning from teardrop to diamond" },
];

const BRIDGE_TYPES = [
  { id: "open", label: "Open Bridge", note: "Throat area contains one or more composite struts spanning a gap rather than being filled solid. Reduces material and weight in throat zone, lowering center of mass slightly toward handle and reducing overall weight. Aerodynamically, an open bridge offers marginally less resistance on downswing — air passes through the gap. With fewer throat cross-sections carrying torsional load, transmits slightly less torsional rigidity from handle to head — some players describe this as more 'wrist feel' or 'touch' because the connection is slightly less rigid. Specific strut geometry (number, orientation, cross-section) determines structural properties within the open bridge category." },
  { id: "closed", label: "Closed Bridge", note: "Throat area completely filled — solid structural transition from head to handle. Maximum torsional rigidity. Players experience this as more 'connected' or 'direct' — grip adjustments translate more immediately to face angle changes. Weight slightly higher than open bridge. Vibration from ball contact travels through the closed throat more efficiently to the handle — closed bridge can increase perceived impact harshness versus open bridge. Preferred for stability-focused builds. Some closed-bridge designs triangulate the throat further for torsional optimization." },
];

function computeStability({ core, face, frame, bridgeId, beamOrientation, beamCount, widthMm, weightG }) {
  let stability = 0.5;
  stability += (frame.stiffness - 3) * 0.06;
  stability += (face.durability - 3) * 0.03;
  stability += (6 - core.comfort) * 0.015;
  // Throat torsional stiffness: a solid (closed) throat and a diagonal X-brace
  // resist frame twist best; a lateral (horizontal) tie is moderate; a plain
  // vertical (longitudinal) strut adds the least anti-twist (it's aligned with
  // the swing, not the twist). More struts stiffen further. (Researched.)
  if (bridgeId === "closed") stability += 0.12;
  else {
    stability += beamOrientation === "diagonal" ? 0.13 : beamOrientation === "horizontal" ? 0.06 : 0.02;
    stability += ((beamCount ?? 2) - 2) * 0.03;
  }
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

interface HolePoint { x: number; y: number; d?: number; } // normalized x,y (-1..1 from face centre); optional per-hole diameter in mm (falls back to the build's global holeDiameterMm — e.g. oversized air ports on an otherwise uniform face)

function computeHoleOpenAreaPct(holes: HolePoint[], holeDiameterMm: number, faceWidthMm: number, faceHeightMm: number): number {
  if (!holes.length) return 0;
  // Real hole area in mm², scaled by how many holes actually land inside
  // the usable elliptical hitting area (mirrors the 0.9 face-area factor
  // used elsewhere in this file for consistency).
  // Each hole contributes its own diameter when one is set (oversized air
  // ports on the OXDOG Pro Smash, say), otherwise it inherits the build's
  // global holeDiameterMm — so a plain {x,y} face scores exactly as before.
  const totalHoleAreaMm2 = holes.reduce((sum, h) => {
    const d = (typeof h.d === "number" && h.d > 0) ? h.d : holeDiameterMm;
    return sum + Math.PI * (d / 2) ** 2;
  }, 0);
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

function computeSweetSpotAndStability({ shape, balanceCm, widthMm, thicknessMm, weightG, core, face, frame, bridgeId, beamOrientation, beamCount, holes, holeDiameterMm, topY, headHeight, halfWidth }) {
  const baseYFrac = shape === "round" ? 0.56 : (shape === "diamond" || shape === "diamond-wide") ? 0.36 : 0.48;
  const balanceShift = ((balanceCm - 25.5) / 1.5) * 0.07;
  const yFrac = Math.max(0.22, Math.min(0.62, baseYFrac - balanceShift));
  const y = topY + headHeight * yFrac;
  const stability = computeStability({ core, face, frame, bridgeId, beamOrientation, beamCount, widthMm, weightG });
  const baseR = shape === "round" ? 50 : shape === "diamond" ? 32 : shape === "diamond-wide" ? 38 : 40;
  const stabilityScale = 0.78 + stability * 0.5;
  let r = baseR * stabilityScale;

  // Face width — direct physical contribution, not just its diluted path
  // through computeStability. A wider face literally has more material
  // between the intended contact zone and the frame perimeter, so the
  // usable sweet-spot area scales up close to linearly with face width
  // (more room for the flex zone to exist within, independent of how
  // that width affects overall torsional stability). FIP width range in
  // this tool is 200-260mm; 255mm (the app's typical default) is the
  // reference point this scales around.
  const widthMmVal = widthMm ?? 255;
  const widthFactor = 0.85 + ((widthMmVal - 200) / 60) * 0.3; // 0.85x at 200mm, 1.15x at 260mm
  r *= widthFactor;

  // Face thickness — real, direct physical contribution established
  // alongside the thickness playability engine: bending stiffness scales
  // with thickness cubed. A stiffer (thicker) face resists cooperative
  // flex across a wide area, concentrating the effective sweet spot into
  // a smaller, more sharply-defined zone. A thinner, more flexible face
  // lets a wider area of material participate in absorbing an off-center
  // hit, which is part of why thin, flexible constructions are described
  // as more forgiving even before core or hole pattern are considered.
  const thicknessMmVal = thicknessMm ?? 38;
  const relStiffness = Math.pow(thicknessMmVal / 38, 3); // 0-1, matches the thickness playability engine exactly
  const thicknessFactor = 1.12 - relStiffness * 0.24; // 1.12x at minimum stiffness (28mm), 0.88x at max (38mm)
  r *= thicknessFactor;

  // Weight — direct physical contribution via effective swingweight. A
  // heavier racquet carries more momentum through contact, which resists
  // the frame twisting or decelerating on an off-center hit — the same
  // physical principle (moment of inertia resisting angular acceleration)
  // that makes heavier tennis frames more forgiving on mishits, distinct
  // from the general torsional-stability role weight already plays in
  // computeStability above.
  const weightGVal = weightG ?? 365;
  const weightFactor = 0.92 + ((weightGVal - 350) / 30) * 0.16; // 0.92x at 350g, 1.08x at 380g
  r *= weightFactor;

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

function computeScores({ shape, core, face, frame, surface, grip, bridgeId, beamOrientation, beamCount, holes, holeDiameterMm, weightG, balanceCm, widthMm, thicknessMm, edgeProfile, sideProfile, dampening, stiffnessAdj, counterweightG, handleLengthMm, gripCircMm, coreGradient }) {
  const s = { power: 0, control: 0, comfort: 0, sweetSpot: 0, durability: 0, spin: 0 };
  const n = { power: 0, control: 0, comfort: 0, sweetSpot: 0, durability: 0, spin: 0 };
  const add = (key, val) => { if (val === undefined) return; s[key] += val; n[key] += 1; };
  add("power", shape.power); add("control", shape.control); add("sweetSpot", shape.forgiveness);
  add("power", core.power); add("control", core.control); add("comfort", core.comfort); add("sweetSpot", core.sweetSpot); add("durability", core.durability);
  add("power", face.power); add("control", face.control); add("comfort", face.comfort); add("durability", face.durability);
  add("durability", frame.stiffness >= 4 ? 5 : frame.stiffness); add("comfort", 6 - frame.stiffness);
  // Surface texture is not just a spin lever: a SMOOTH face gives the cleanest,
  // most predictable energy transfer (flat power + control) and wears slowest,
  // while raised/rough textures buy spin at a small cost in clean power, exit
  // predictability and durability (raised structures chip; big honeycomb also
  // drags). This is why many elite attack frames (e.g. the Viper) run smoother
  // and generate spin from technique — so texture now trades off, not free spin.
  add("spin", surface.spin);
  add("power", surface.power ?? 3.5);
  add("control", surface.control ?? 3.5);
  add("durability", surface.durability ?? 3.5);
  add("comfort", grip.vibrationDamp);
  // Throat/bridge — real trade-offs (researched against pro usage + physics):
  //  • closed/solid throat: most connected control + torsional stability + direct
  //    power transfer, but harsh (low comfort) and no aero help;
  //  • open + vertical strut: the attacking-diamond choice (Coello/Lebrón) — an
  //    open throat cuts drag so the head accelerates faster → more effective smash
  //    power, plus throat flex damps shock (comfort/touch); it gives up frame
  //    control/torsional stiffness;
  //  • open + diagonal X-brace: max control + anti-twist, but stiffer/heavier and
  //    less comfortable/aero;
  //  • open + horizontal tie: firm smash base + off-centre hold, at an aero cost.
  //  More struts stiffen (control↑) but cost comfort and swing-speed (power↑ from
  //  aero fades). No option is strictly best — it depends what you're optimizing.
  {
    let bP, bC, bCf, bD;
    const bc = beamCount ?? 2;
    if (bridgeId === "closed") { bP = 4; bC = 5; bCf = 1.5; bD = 5; }
    else if (beamOrientation === "diagonal") { bP = 3; bC = 4.5; bCf = 2.5; bD = 4.5; }
    else if (beamOrientation === "horizontal") { bP = 4; bC = 3.5; bCf = 3; bD = 3.5; }
    else { bP = 4.5; bC = 3; bCf = 4; bD = 3; } // open + vertical
    if (bridgeId !== "closed") { bC += (bc - 2) * 0.5; bCf += (2 - bc) * 0.5; bP += (2 - bc) * 0.35; bD += (bc - 2) * 0.4; }
    // Aerodynamics: the faster the head travels (heavier + more head-heavy = a
    // hard attacking swing), the more an OPEN throat's lower drag converts into
    // real smash power, and the more a solid CLOSED throat's drag saps it. On a
    // light, head-light control build the swing is slow and this washes out —
    // which is why the pro attacking diamonds run open+vertical for head speed.
    const aeroBias = Math.max(0, Math.min(1, ((weightG ?? 365) - 355) / 20)) * Math.max(0, Math.min(1, ((balanceCm ?? 25.5) - 25.4) / 1.6));
    bP += (bridgeId === "closed" ? -aeroBias * 0.9 : (1 - (bc - 1) * 0.12) * aeroBias * 0.9); // each extra strut adds a little drag
    const cl = v => Math.max(1, Math.min(5, v));
    add("power", cl(bP)); add("control", cl(bC)); add("comfort", cl(bCf)); add("durability", cl(bD));
  }

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

  // POWER now flows the way physics does: a SWINGWEIGHT term (mass × head-heaviness — the
  // parallel-axis smash lever, compounding when a frame is BOTH heavy and head-heavy) plus a
  // TRAMPOLINE term (cubed thickness — the springboard). Weight/balance/thickness keep their
  // control/comfort buckets; only the power path changed. (Length sits near the FIP max on
  // essentially every frame and isn't in the catalog data, so it's omitted for now.)
  {
    const _w = weightG ?? 365, _bal = balanceCm ?? 25.5;
    const _mN = Math.max(0, Math.min(1, (_w - 345) / 27));       // 345..372g -> 0..1
    const _bN = Math.max(0, Math.min(1, (_bal - 24) / 3.5));     // 24..27.5cm -> 0..1
    const _swIdx = Math.max(0, Math.min(1, 0.34 * _mN + 0.34 * _bN + 0.32 * (_mN * _bN)));
    add("power", Math.max(1, Math.min(5, 1.3 + _swIdx * 3.1)));  // swingweight (mass far from axis)
    // (trampoline / thickness->power is applied as a post-average delta below so it can
    //  properly outweigh the thin-frame aero bonus, which real padel physics does not support.)
  }
  if (weightG !== undefined) {
    if (weightG >= 374) { add("control", 2); add("comfort", 2); }
    else if (weightG >= 362) { add("control", 3); add("comfort", 3); }
    else { add("control", 4); add("comfort", 4); }
  }
  if (balanceCm !== undefined) {
    if (balanceCm >= 26.5) { add("control", 2); }
    else if (balanceCm >= 25.3) { add("control", 3); }
    else { add("control", 4); }
  }
  if (widthMm !== undefined) {
    if (widthMm >= 250) add("sweetSpot", 4);
    else if (widthMm >= 230) add("sweetSpot", 3);
    else add("sweetSpot", 2);
  }
  if (thicknessMm !== undefined) {
    if (thicknessMm >= 37) { add("comfort", 2); }
    else if (thicknessMm >= 33) { add("comfort", 3); }
    else { add("comfort", 4); }
  }
  const out: any = {};
  ["power","control","comfort","sweetSpot","durability","spin"].forEach(k => {
    out[k] = n[k] ? Math.round((s[k] / n[k]) * 10) / 10 : 0;
  });
  // Hole aerodynamics. Open face area cuts air drag on the downswing, so on a
  // heavy, head-heavy frame swung hard the head accelerates faster → real
  // effective smash power. This partly offsets the face-softening power loss
  // that holes otherwise impose (HOLE_POWER_CURVE above), which is why real
  // attacking diamonds are heavily perforated rather than bare-faced. It scales
  // with the same weight × head-heaviness "swing intensity" as the throat aero
  // and saturates past ~20% open — on a light, head-light control frame the
  // swing is slow so this washes out, and holes stay a pure forgiveness lever.
  const holeAeroBias = Math.max(0, Math.min(1, ((weightG ?? 365) - 355) / 20)) * Math.max(0, Math.min(1, ((balanceCm ?? 25.5) - 25.4) / 1.6));
  const holeAeroBonus = (Math.min(openPct, 20) / 20) * holeAeroBias * 0.9;
  out.power = Math.round(Math.min(5, out.power + holeAeroBonus) * 10) / 10;
  // TRAMPOLINE — the primary thickness->power lever. A thicker profile is a stiffer
  // springboard (cubed, like real bending stiffness). 38mm (the FIP-max reference) is
  // neutral; thinner loses power. This intentionally outweighs the small thin-frame aero
  // bonus below, so "aggressive" builds to 38mm (real power) rather than drifting thin.
  { const _tr = Math.pow(Math.max(0, Math.min(1, (thicknessMm ?? 38) / 38)), 3); out.power = Math.round(Math.min(5, Math.max(1, out.power + (_tr - 1) * 0.9)) * 10) / 10; }
  // Frame-thickness aerodynamics. A thinner frame presents a smaller frontal
  // cross-section, so it cuts less air on the downswing → faster head speed →
  // more effective smash power. Like the hole/throat/edge aero, this only cashes
  // in on a heavy, head-heavy frame swung hard (holeAeroBias); on a light control
  // frame the swing is too slow, so thinness there instead just buys flex,
  // comfort and a bigger sweet spot (already handled in the averaged thickness
  // term and the sweet-spot radius factor above). Baseline 38mm = no bonus,
  // scaling to the 28mm structural floor. This is the signal that tells a factory
  // to go thinner for an attacking frame: swing speed, not touch.
  const thinFactor = Math.max(0, Math.min(1, (38 - (thicknessMm ?? 38)) / 10));
  const thickAeroBonus = thinFactor * holeAeroBias * 0.2;  // minor swing-speed effect; the trampoline (above) is the real thickness->power lever
  out.power = Math.round(Math.min(5, out.power + thickAeroBonus) * 10) / 10;
  // Frame edge geometry (rounded ↔ sharp). Applied as small post-average
  // deltas so "standard" (the default, and every existing racquet) is exactly
  // unchanged — no bias — while opting into rounded/sharp shifts the honest
  // trade-off. Sharp/boxy = stiffer & more connected (+control) but harsher
  // (−comfort) and more chip-prone (−durability), plus an aero head-speed power
  // bonus that, like the hole/throat aero, only shows up on a heavy head-heavy
  // frame swung hard. Rounded = comfier and more durable, a touch less crisp
  // and less aerodynamic.
  const clampS = (v: number) => Math.round(Math.max(1, Math.min(5, v)) * 10) / 10;
  if (edgeProfile === "sharp") {
    const edgeAero = Math.max(0, Math.min(1, ((weightG ?? 365) - 355) / 20)) * Math.max(0, Math.min(1, ((balanceCm ?? 25.5) - 25.4) / 1.6)) * 0.4;
    out.control = clampS(out.control + 0.2);
    out.comfort = clampS(out.comfort - 0.3);
    out.durability = clampS(out.durability - 0.3);
    out.power = clampS(out.power + edgeAero);
  } else if (edgeProfile === "rounded") {
    out.comfort = clampS(out.comfort + 0.3);
    out.durability = clampS(out.durability + 0.3);
    out.control = clampS(out.control - 0.15);
    out.power = clampS(out.power - 0.1);
  }
  out.stability = Math.round(computeStability({ core, face, frame, bridgeId, beamOrientation, beamCount, widthMm: widthMm ?? 230, weightG }) * 5 * 10) / 10;
  // Head-shape side geometry. Straighter/more-angular sides carry more of the
  // perimeter mass out to the widest zone → higher twistweight (off-centre
  // stability) and a broader sweet spot, at a small aero cost. "curved" (the
  // default) is neutral so nothing existing changes — no bias.
  if (sideProfile === "straight") {
    out.stability = clampS(out.stability + 0.25);
    out.sweetSpot = clampS(out.sweetSpot + 0.2);
    out.power = clampS(out.power - 0.1);
  } else if (sideProfile === "soft-straight") {
    out.stability = clampS(out.stability + 0.12);
    out.sweetSpot = clampS(out.sweetSpot + 0.1);
  }

  // ===================== TUNING LEVERS (all neutral-default -> no-bias) =====================
  // Each lever below is a post-average delta that is EXACTLY 0 at its neutral default, so every
  // existing racquet (which sends none of these fields) scores byte-identical. swingweight and
  // armFriendliness are brand-new derived readouts; they do not touch the 7 comparison scores.
  const _d  = typeof dampening      === "number" ? Math.max(0,  Math.min(10, dampening))      : 0;
  const _st = typeof stiffnessAdj   === "number" ? Math.max(-3, Math.min(3,  stiffnessAdj))   : 0;
  const _cw = typeof counterweightG === "number" ? Math.max(0,  Math.min(25, counterweightG)) : 0;
  const _hl = typeof handleLengthMm === "number" ? Math.max(195,Math.min(235,handleLengthMm)) : 215;
  const _gc = typeof gripCircMm     === "number" ? Math.max(35, Math.min(42, gripCircMm))     : 38;
  const _cg = typeof coreGradient   === "number" ? Math.max(0,  Math.min(10, coreGradient))   : 0;
  if (_d > 0)   { out.comfort = clampS(out.comfort + (_d/10)*0.6); out.control = clampS(out.control + (_d/10)*0.15); out.power = clampS(out.power - (_d/10)*0.25); }
  if (_st !== 0){ out.power = clampS(out.power + _st*0.12); out.comfort = clampS(out.comfort - _st*0.15); out.durability = clampS(out.durability + _st*0.05); if (_st < 0) out.control = clampS(out.control - _st*0.10); }
  if (_cw > 0)  { out.stability = clampS(out.stability + (_cw/25)*0.3); out.comfort = clampS(out.comfort + (_cw/25)*0.2); out.power = clampS(out.power - (_cw/25)*0.15); }
  if (_hl !== 215){ const _hdn = (_hl - 215)/20; out.power = clampS(out.power + _hdn*0.2); out.control = clampS(out.control - _hdn*0.1); }
  if (_gc !== 38){ const _gdn = (_gc - 38)/2; out.spin = clampS(out.spin - _gdn*0.25); out.comfort = clampS(out.comfort + _gdn*0.15); out.stability = clampS(out.stability + _gdn*0.1); }
  if (_cg > 0)  { out.sweetSpot = clampS(out.sweetSpot + (_cg/10)*0.5); out.stability = clampS(out.stability + (_cg/10)*0.3); out.power = clampS(out.power - (_cg/10)*0.2); }
  {
    const _wg = weightG ?? 365, _bc = balanceCm ?? 25.8;
    const _tot = _wg + _cw;
    const _eff = (_wg * _bc + _cw * 3) / _tot;
    const _len = _hl / 215;
    out.swingweight = Math.round(_tot * Math.pow(_eff / 25.8, 2) * _len * 0.822);
  }
  {
    let _af = 25 + (out.comfort / 5) * 60;
    _af += (_d / 10) * 12;
    _af += (_cw / 25) * 6;
    _af -= _st * 4;
    out.armFriendliness = Math.round(Math.max(0, Math.min(100, _af)));
  }

  return out;
}
function scoreSpec(g) {
  g = g || {};
  // Angular variants are appearance-only chamfers; they score exactly like their base shape.
  const _shapeId = g.shapeId === "round-angular" ? "round" : g.shapeId === "diamond-angular" ? "diamond" : g.shapeId;
  const shp = SHAPES.find((s) => s.id === _shapeId) || SHAPES.find((s) => s.id === "teardrop");
  const cor = CORE_MATERIALS.find((c) => c.id === g.coreId) || CORE_MATERIALS.find((c) => c.id === "eva-medium");
  const fac = FACE_MATERIALS.find((f) => f.id === g.faceId) || FACE_MATERIALS.find((f) => f.id === "carbon-12k");
  const frm = FRAME_MATERIALS.find((f) => f.id === g.frameId) || FRAME_MATERIALS.find((f) => f.id === "hybrid-frame");
  const srf = SURFACE_TEXTURES.find((s) => s.id === g.surfaceId) || SURFACE_TEXTURES.find((s) => s.id === "rough");
  const grp = GRIP_MATERIALS.find((gr) => gr.id === g.gripId) || GRIP_MATERIALS.find((gr) => gr.id === "pu-grip");
  const bId = typeof g.bridgeId === "string" ? g.bridgeId : "open";
  const bOr = typeof g.beamOrientation === "string" ? g.beamOrientation : "vertical";
  const bCt = typeof g.beamCount === "number" ? g.beamCount : 2;
  const wG = typeof g.weightG === "number" ? g.weightG : 365;
  const bal = typeof g.balanceCm === "number" ? g.balanceCm : 25.8;
  const wid = typeof g.widthMm === "number" ? g.widthMm : 255;
  const thk = typeof g.thicknessMm === "number" ? g.thicknessMm : 38;
  const hls = Array.isArray(g.holes) ? g.holes : [];
  const hd = typeof g.holeDiameterMm === "number" ? g.holeDiameterMm : 9;
  const edge = typeof g.edgeProfile === "string" ? g.edgeProfile : "standard";
  const side = typeof g.sideProfile === "string" ? g.sideProfile : "curved";
  const dmp = typeof g.dampening === "number" ? g.dampening : 0;
  const stf = typeof g.stiffnessAdj === "number" ? g.stiffnessAdj : 0;
  const cwt = typeof g.counterweightG === "number" ? g.counterweightG : 0;
  const hln = typeof g.handleLengthMm === "number" ? g.handleLengthMm : 215;
  const grc = typeof g.gripCircMm === "number" ? g.gripCircMm : 38;
  const cgr = typeof g.coreGradient === "number" ? g.coreGradient : 0;
  const sc = computeScores({ shape: shp, core: cor, face: fac, frame: frm, surface: srf, grip: grp, bridgeId: bId, beamOrientation: bOr, beamCount: bCt, holes: hls, holeDiameterMm: hd, weightG: wG, balanceCm: bal, widthMm: wid, thicknessMm: thk, edgeProfile: edge, sideProfile: side, dampening: dmp, stiffnessAdj: stf, counterweightG: cwt, handleLengthMm: hln, gripCircMm: grc, coreGradient: cgr });
  const bridgeLabel = (BRIDGE_TYPES.find((b) => b.id === bId) || {}).label || bId;
  const edgeLabel = (EDGE_PROFILES.find((e) => e.id === edge) || {}).label || edge;
  const sideLabel = (SIDE_PROFILES.find((sp) => sp.id === side) || {}).label || side;
  const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
  const throat = bId === "closed" ? bridgeLabel : (bridgeLabel + " \u00B7 " + cap(bOr) + " \u00B7 " + bCt);
  return { scores: sc, summary: { shape: shp.label, weightG: wG, balanceCm: bal, core: cor.label, face: fac.label, frame: frm.label, surface: srf.label, throat: throat, edge: edgeLabel, side: sideLabel } };
}

const CORS = { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST a spec as JSON" }), { status: 405, headers: CORS });
  let body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  try {
    const out = scoreSpec(body);
    return new Response(JSON.stringify(out), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "scoring_failed", detail: String((e && e.message) || e) }), { status: 500, headers: CORS });
  }
}

// Server-only exports so sibling edge functions (e.g. basin-solve) can reuse the engine
// without duplicating the trade-secret tables. NOT imported by client code.
export { scoreSpec, CORE_MATERIALS, FACE_MATERIALS, FRAME_MATERIALS, SURFACE_TEXTURES, GRIP_MATERIALS, SHAPES };
