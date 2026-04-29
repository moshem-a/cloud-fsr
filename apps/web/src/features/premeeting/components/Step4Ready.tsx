import { Card } from "@scoach/ui";
import { Lock, Monitor } from "@scoach/ui/icons";

import { usePreMeetingStore } from "../store.ts";

export function Step4Ready() {
  const s = usePreMeetingStore();

  return (
    <div className="setup-step">
      <h2 className="setup-step-title">Ready to start</h2>

      <Card className="ready-summary">
        <div className="ready-row"><span>Client</span><strong>{s.client || "Unspecified"}</strong></div>
        <div className="ready-row"><span>Title</span><strong>{s.title || "Untitled"}</strong></div>
        <div className="ready-row"><span>Stage</span><strong>{s.stage}</strong></div>
        <div className="ready-row"><span>Language</span><strong>{s.language === "auto" ? "Auto-detect" : s.language === "he" ? "Hebrew" : "English"}</strong></div>
        <div className="ready-row">
          <span>Context</span>
          <strong>
            {s.contextFiles.length} document{s.contextFiles.length === 1 ? "" : "s"} indexed
            {s.insights ? ` · ${s.insights.entities.length} entities` : ""}
          </strong>
        </div>
      </Card>

      <Card className="ready-silent">
        <Lock size={18} />
        <div>
          <div className="ready-silent-title">Silent mode active</div>
          <div className="ready-silent-sub">
            Microphone is muted. Nothing is being captured until you press Start listening.
          </div>
        </div>
      </Card>

      <Card className="ready-share">
        <div className="ready-share-head">
          <Monitor size={18} />
          <span>Screen share preview</span>
          <button type="button" className="ghost-btn">Switch source</button>
        </div>
        <div className="ready-share-placeholder">
          When you click Start listening, you'll be prompted to share your Meet tab. Make sure to tick
          <strong> "Share tab audio"</strong>.
        </div>
      </Card>
    </div>
  );
}
