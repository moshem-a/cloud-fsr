import { createFileRoute } from "@tanstack/react-router";

import { ApiKeySetup } from "../features/auth/components/ApiKeySetup.tsx";

export const Route = createFileRoute("/_app/apikey")({
  component: ApiKeySetup,
});
