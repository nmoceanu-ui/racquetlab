import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import ForjaAccounts from "./ForjaAccounts";
import { ErrorBoundary } from "./ErrorBoundary";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Dev-only: /?paint renders JUST the Paint Shop (lazy-loaded) for fast, isolated
// iteration on PaintShop.tsx / Racquet3D.tsx. Normal app path is unchanged.
if (typeof location !== "undefined" && new URLSearchParams(location.search).has("paint")) {
  import("./PaintDev").then(({ default: PaintDev }) => {
    root.render(
      <React.StrictMode>
        <PaintDev />
      </React.StrictMode>
    );
  });
} else if (typeof location !== "undefined" && new URLSearchParams(location.search).has("basin")) {
  Promise.all([import("./BasinPool"), import("./PlayerProfileWidget")]).then(([{ default: BasinPool }, { default: PlayerProfileWidget }]) => {
    root.render(
      <React.StrictMode>
        <div style={{ minHeight: "100vh", background: "#0e2233", padding: 20, boxSizing: "border-box", fontFamily: "Inter, system-ui, sans-serif" }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div style={{ fontSize: 12, color: "#7d94a2", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 14 }}>THE BASIN · dev preview (?basin) — live solver via /api/basin-solve · floating questionnaire bottom-right</div>
            <BasinPool onOpenBuild={(spec) => { console.log("basin-solve spec:", spec); alert("Would open the builder with:\n" + spec.shapeId + " · " + spec.faceId + " face · " + spec.coreId + " core · " + spec.frameId); }} />
          </div>
        </div>
        <PlayerProfileWidget />
      </React.StrictMode>
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <ForjaAccounts />
      <Analytics />
    </React.StrictMode>
  );
}
