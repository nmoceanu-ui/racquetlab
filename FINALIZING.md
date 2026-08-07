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
  Possible future polish: extend the same realism guard to faces (e.g. kevlar is a
  frame-reinforcement material, not a full perforated face) — low priority.
