import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@scoach/tokens/tokens.css";
import "./styles/index.css";

import { applyTheme, getStoredTheme } from "./lib/theme.ts";
import { applyDirection, getStoredDirection } from "./lib/i18n.ts";

import { routeTree } from "./routeTree.gen.ts";

applyTheme(getStoredTheme());
applyDirection(getStoredDirection());

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function bootstrap() {
  // MSW is opt-in via VITE_USE_MSW=true. Default behavior calls the real api
  // at VITE_API_BASE_URL so users see their own data, not fixtures.
  const useMsw = import.meta.env.DEV && import.meta.env.VITE_USE_MSW === "true";
  console.log("[scoach] bootstrap start, DEV=%s, MSW=%s", import.meta.env.DEV, useMsw);
  if (useMsw) {
    try {
      const { worker } = await import("./mocks/browser.ts");
      await worker.start({ onUnhandledRequest: "bypass", quiet: false });
      console.log("[scoach] MSW started");
    } catch (err) {
      console.warn("MSW failed to start; falling back to real API", err);
    }
  }

  const root = document.getElementById("root");
  if (!root) throw new Error("#root not found");

  console.log("[scoach] mounting React");
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  console.log("[scoach] mount complete");
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap app", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:32px;font-family:sans-serif;color:#EA4335">
      <h2>Bootstrap error</h2>
      <pre style="white-space:pre-wrap">${String(err?.stack ?? err)}</pre>
    </div>`;
  }
});
