import { createFileRoute } from "@tanstack/react-router";

import { ClientsScreen } from "../features/clients/components/ClientsScreen.tsx";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsScreen,
});
