import { Badge, Button, Card, Spinner, useToast } from "@scoach/ui";
import { Doc, Plus, Trash } from "@scoach/ui/icons";
import { useRef } from "react";

import { preMeetingApi } from "../api.ts";
import { usePreMeetingStore } from "../store.ts";

export interface Step3ContextProps {
  meetingId: string;
}

const ACCEPT = ".pdf,.docx,.txt,.md";
const MAX_BYTES = 25 * 1024 * 1024;

export function Step3Context({ meetingId }: Step3ContextProps) {
  const { contextFiles, setContextFiles, insights, setInsights, analyzing, setAnalyzing } = usePreMeetingStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const tooBig = arr.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.push({ tone: "error", message: `${tooBig.name} exceeds 25 MB.` });
      return;
    }
    try {
      const r = await preMeetingApi.uploadContext(meetingId, arr);
      setContextFiles([...contextFiles, ...r.files]);
      toast.push({ tone: "success", message: `${arr.length} file(s) uploaded.` });
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    }
  }

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      await preMeetingApi.startAnalyze(meetingId);
      // Simple poll loop. Real impl uses SSE or longer-poll; this is enough for MSW.
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 600));
        const r = await preMeetingApi.pollAnalyze(meetingId);
        if (r.status === "done" && r.insights) {
          setInsights(r.insights);
          break;
        }
        if (r.status === "error") {
          toast.push({ tone: "error", message: r.error ?? "Analysis failed" });
          break;
        }
      }
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="setup-step">
      <h2 className="setup-step-title">Add context to sharpen the coach</h2>
      <p className="setup-sub">
        Upload battlecards, prior call notes, security docs. Up to 25 MB each. PDF, DOCX, TXT, MD.
      </p>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="upload-zone" onClick={() => fileInput.current?.click()} role="button" tabIndex={0}>
        <Plus size={20} />
        <div>
          <strong>Click to upload</strong> or drag PDF / DOCX / TXT / MD here
        </div>
      </div>

      {contextFiles.length > 0 && (
        <Card>
          <ul className="ctx-file-list">
            {contextFiles.map((f) => (
              <li key={f.id}>
                <Doc size={16} />
                <span className="ctx-file-name">{f.name}</span>
                <span className="ctx-file-size">{(f.size / 1024).toFixed(0)} KB</span>
                {f.indexed ? <Badge color="green">Indexed</Badge> : <Badge color="yellow">Pending</Badge>}
                <button
                  type="button"
                  aria-label="Remove"
                  className="icon-btn icon-btn-sm"
                  onClick={() => setContextFiles(contextFiles.filter((x) => x.id !== f.id))}
                >
                  <Trash size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="setup-analyze">
        <Button variant="primary" onClick={runAnalyze} loading={analyzing} disabled={analyzing}>
          {analyzing ? "Analyzing context…" : "Build knowledge base"}
        </Button>
        {analyzing && <Spinner size={16} />}
      </div>

      {insights && (
        <Card className="setup-insights">
          <div className="kicker">Knowledge base ready</div>
          <div className="insights-section">
            <strong>Entities ({insights.entities.length}):</strong>{" "}
            {insights.entities.map((e) => (
              <Badge key={e}>{e}</Badge>
            ))}
          </div>
          <div className="insights-section">
            <strong>Pain points ({insights.painPoints.length}):</strong>{" "}
            <ul>
              {insights.painPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="insights-section">
            <strong>Tags:</strong>{" "}
            {insights.tags.map((t) => (
              <Badge key={t} color="blue">{t}</Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
