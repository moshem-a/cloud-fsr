import { createFileRoute } from "@tanstack/react-router";

import { Dashboard } from "../features/dashboard/components/Dashboard.tsx";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});
