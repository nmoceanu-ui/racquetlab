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
