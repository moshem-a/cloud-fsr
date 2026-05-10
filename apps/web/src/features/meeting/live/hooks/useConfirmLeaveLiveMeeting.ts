import type { MouseEvent } from "react";

import { useLiveMeetingStore } from "../store.ts";

export function useConfirmLeaveLiveMeeting(): (e: MouseEvent) => void {
  const listening = useLiveMeetingStore((s) => s.listening);
  return (e) => {
    if (!listening) return;
    const ok = window.confirm(
      "You're in a live meeting. Leave to dashboard? Notes are saved and the meeting stays Live so you can resume it from the dashboard.",
    );
    if (!ok) e.preventDefault();
  };
}
