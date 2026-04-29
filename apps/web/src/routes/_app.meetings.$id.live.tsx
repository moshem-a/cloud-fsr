import { createFileRoute } from "@tanstack/react-router";

import { LiveMeetingScreen } from "../features/meeting/live/components/LiveMeetingScreen.tsx";

export const Route = createFileRoute("/_app/meetings/$id/live")({
  component: LivePage,
});

function LivePage() {
  const { id } = Route.useParams();
  return <LiveMeetingScreen meetingId={id} />;
}
