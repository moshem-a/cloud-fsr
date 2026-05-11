import { createFileRoute } from "@tanstack/react-router";

import { AdminScreen } from "../features/admin/components/AdminScreen.tsx";

export const Route = createFileRoute("/_app/admin")({
  component: AdminScreen,
});
