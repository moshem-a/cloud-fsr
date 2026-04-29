import { Card } from "@scoach/ui";
import { usePreMeetingStore } from "../store.ts";

export function PreviewRail() {
  const s = usePreMeetingStore();
  return (
    <aside className="setup-preview">
      <Card>
        <div className="kicker">Preview</div>
        <div className="preview-row">
          <div className="preview-label">Client</div>
          <div className="preview-value">{s.client || <em>Not set</em>}</div>
        </div>
        <div className="preview-row">
          <div className="preview-label">Title</div>
          <div className="preview-value">{s.title || <em>Untitled</em>}</div>
        </div>
        <div className="preview-row">
          <div className="preview-label">Stage</div>
          <div className="preview-value">{s.stage}</div>
        </div>
        {s.goal && (
          <div className="preview-row">
            <div className="preview-label">Goal</div>
            <div className="preview-value preview-goal">{s.goal}</div>
          </div>
        )}
        <div className="preview-row">
          <div className="preview-label">Language</div>
          <div className="preview-value">{s.language === "auto" ? "Auto-detect" : s.language === "he" ? "עברית" : "English"}</div>
        </div>
        <div className="preview-row">
          <div className="preview-label">Context</div>
          <div className="preview-value">
            {s.contextFiles.length === 0
              ? "No documents yet"
              : `${s.contextFiles.length} document${s.contextFiles.length === 1 ? "" : "s"} indexed`}
          </div>
        </div>
      </Card>

      <Card className="setup-tip">
        <div className="kicker">Tip</div>
        <p>
          The more specific your goal, the better the coach's hints. Mention the customer's deal stage, what
          you want to learn, and what would count as a win.
        </p>
      </Card>
    </aside>
  );
}
