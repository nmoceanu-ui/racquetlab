import React from "react";
import { analytics } from "./lib/analytics";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Class component is required here — React has no hook equivalent for
// catching render errors (getDerivedStateFromError / componentDidCatch
// only exist on class components). This wraps the whole app in
// main.tsx so a crash anywhere in App's render tree shows a recoverable
// screen instead of a blank white page.
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the crash in analytics so it's visible without someone
    // having to report it manually — this is the one place a thrown
    // error is expected and intentionally caught, so reporting it here
    // rather than letting it propagate is correct, not a swallow.
    try {
      analytics.appCrashed(error.message || "unknown error");
    } catch {
      // analytics itself must never be able to crash the crash handler
    }
    // eslint-disable-next-line no-console
    console.error("RacquetLab crashed:", error, info);
  }

  handleReset = () => {
    // A full reload is the safest recovery here — component state may
    // be inconsistent in ways a soft reset (just clearing hasError)
    // can't reliably fix, since we don't know which piece of state
    // caused the crash.
    window.location.href = window.location.origin + window.location.pathname;
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          background: "#080B10",
          color: "#EAE6DC",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(255,180,0,0.1)",
              border: "1px solid rgba(255,180,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
              fontSize: 22,
            }}
          >
            ⚠
          </div>
          <h1
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: "0.02em",
              margin: "0 0 8px",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ fontSize: 13.5, color: "#9AA3B0", lineHeight: 1.6, margin: "0 0 22px" }}>
            RacquetLab hit an unexpected error and couldn't continue. This has been logged. Reloading
            usually fixes it — if you had a build in progress, anything already saved with{" "}
            <strong style={{ color: "#EAE6DC" }}>Save &amp; Share</strong> is safe and can be reopened
            from its link.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "11px 22px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #AEFB00, #7DD400)",
              color: "#080B10",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reload RacquetLab
          </button>
          {this.state.error && (
            <p
              style={{
                fontSize: 11,
                color: "#4A5568",
                marginTop: 20,
                fontFamily: "'JetBrains Mono', monospace",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
