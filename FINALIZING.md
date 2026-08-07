# PalaLab — finalizing checklist

Deferred polish to revisit when the app is near-complete. These are deliberate
"good enough for now, tune later" decisions, not bugs blocking release.

## Basin solver

- [ ] **Widen the NORM sampling to include grips (and other dims).**
  `api/basin-solve.ts` calibrates its power/comfort/control normalization range by
  sampling only core×face combinations at cold start. Other dimensions (notably a
  damping grip) can push a real build just past the sampled max — comfort hit 1.07
  before we clamped it. We clamped `nP`/`nC`/`nCt` to [0,1] for now (see `clamp01`).
  Proper fix: fold grip (and ideally throat/thickness/weight extremes) into the
  NORM sample so the range is honest and the clamp becomes a no-op.

- [x] **Objective realism — stop recommending beginner/unbuildable frames.** DONE.
  Added three levers to `cost()` / the solver: (1) a normalized durability floor so
  fragile builds are penalized; (2) a frame-stiffness realism term that penalizes a
  soft (entry) frame in proportion to how performance-leaning the target is; (3) the
  solver now only searches commercially real frames (`SOLVE_FRAMES` excludes the
  `experimental` ones). Verified across comfort / aggressive / beginner / control
  targets — every full-custom now returns a coherent, buildable carbon/hybrid frame.
  Follow-up audit (48-target sweep) found the same class of "cheat" on the face and
  surface axes: basalt-face (15/48), kevlar-reinforced-as-a-face (6/48), and the
  hybrid-texture surface — all good on paper, none a real buy. Fixed with explicit
  `EXCLUDE_*` sets (cores/faces/frames/surfaces) so the solver only builds from
  commercially real, use-appropriate parts. Re-sweep: 0/48 flagged, 48/48 still hit
  both targets. The manual builder still exposes every material — exclusions only
  constrain auto-suggestions.

- [ ] **Minor: solver always picks a smooth surface (and leans hard on carbon-18k).**
  The cost function doesn't reward spin, so smooth (highest power, no spin credit)
  wins every target. Not a realism bug — smooth is a legit control/power choice — but
  a spin-seeking player isn't served a textured face. If we add a spin dimension to
  the target, add a spin term to `cost()`. Low priority.
