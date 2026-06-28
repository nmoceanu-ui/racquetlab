import { track } from "@vercel/analytics";

// Thin wrapper around Vercel Analytics' custom event tracking, scoped to
// the specific funnel events that actually matter for this app: where
// people drop off in the Smart Finder, whether they ever see a market
// match, and whether Save & Share gets used at all. Vercel Analytics is
// privacy-respecting by default (no cookies, no cross-site tracking) and
// is a single dependency with zero extra account setup beyond enabling
// it in the Vercel project dashboard.
//
// Every call is wrapped in try/catch — analytics failing must never
// break the actual app experience.

function safeTrack(event: string, props?: Record<string, string | number | boolean>) {
  try {
    track(event, props);
  } catch {
    // analytics should never throw into the UI
  }
}

export const analytics = {
  // Smart Finder funnel
  finderSectionViewed: (sectionId: string) => safeTrack("finder_section_viewed", { sectionId }),
  finderQuestionAnswered: (questionId: string, answer: string) =>
    safeTrack("finder_question_answered", { questionId, answer }),
  finderCompleted: (level: string) => safeTrack("finder_completed", { level }),
  finderAbandoned: (lastQuestionId: string) => safeTrack("finder_abandoned", { lastQuestionId }),

  // Build / spec interaction
  specFieldChanged: (field: string) => safeTrack("spec_field_changed", { field }),
  modeChanged: (mode: string) => safeTrack("mode_changed", { mode }),
  diagramModeChanged: (mode: string) => safeTrack("diagram_mode_changed", { mode }),

  // Market match + monetization-relevant events
  marketMatchesViewed: (topMatchPct: number, topMatchModel: string) =>
    safeTrack("market_matches_viewed", { topMatchPct, topMatchModel }),
  marketMatchClicked: (model: string) => safeTrack("market_match_clicked", { model }),

  // Save & share
  buildSaved: (code: string) => safeTrack("build_saved", { code }),
  buildLoaded: (code: string) => safeTrack("build_loaded", { code }),
  buildSaveFailed: (reason: string) => safeTrack("build_save_failed", { reason }),

  // Reliability — fired by ErrorBoundary when the app crashes, so
  // production errors are visible without someone having to report them.
  appCrashed: (message: string) => safeTrack("app_crashed", { message }),
};
