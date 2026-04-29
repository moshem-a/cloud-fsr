import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { ToastProvider } from "@scoach/ui";
import { bootstrapAuth } from "../features/auth/store.ts";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    const unsub = bootstrapAuth();
    return unsub;
  }, []);

  return (
    <ToastProvider>
      <div className="app-root">
        <Outlet />
      </div>
    </ToastProvider>
  );
}
