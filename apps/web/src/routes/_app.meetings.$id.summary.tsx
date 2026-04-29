import { createFileRoute } from "@tanstack/react-router";

import { SummaryScreen } from "../features/summary/components/SummaryScreen.tsx";

export const Route = createFileRoute("/_app/meetings/$id/summary")({
  component: SummaryPage,
});

function SummaryPage() {
  const { id } = Route.useParams();
  return <SummaryScreen meetingId={id} />;
}
