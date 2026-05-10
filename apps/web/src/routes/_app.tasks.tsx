import { createFileRoute } from "@tanstack/react-router";

import { TasksScreen } from "../features/tasks/components/TasksScreen.tsx";

export const Route = createFileRoute("/_app/tasks")({
  component: TasksScreen,
  validateSearch: (search: Record<string, unknown>) => ({
    client: (search.client as string) || "",
  }),
});
