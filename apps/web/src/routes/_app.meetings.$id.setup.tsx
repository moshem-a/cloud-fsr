import { createFileRoute } from "@tanstack/react-router";

import { PreMeetingWizard } from "../features/premeeting/components/PreMeetingWizard.tsx";

export const Route = createFileRoute("/_app/meetings/$id/setup")({
  component: PreMeetingPage,
});

function PreMeetingPage() {
  const { id } = Route.useParams();
  return <PreMeetingWizard meetingId={id} />;
}
