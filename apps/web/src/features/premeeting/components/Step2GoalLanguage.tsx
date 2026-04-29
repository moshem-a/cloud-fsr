import { Field, SegmentedControl } from "@scoach/ui";
import type { LangCode } from "@scoach/types";

import { usePreMeetingStore } from "../store.ts";

const TEMPLATES: { label: string; goal: string }[] = [
  { label: "First intro", goal: "First introduction call. Build rapport, understand their cloud strategy, and identify the most critical pain point we could help with." },
  { label: "Commercial alignment", goal: "Align on commercial terms: budget range, decision criteria, procurement timeline, and any existing AWS/Azure commitments." },
  { label: "Technical deep-dive", goal: "Technical deep-dive on the proposed architecture. Validate latency / cost / compliance assumptions and identify integration risks." },
  { label: "Procurement", goal: "Walk through procurement: contract terms, security review path, MSA red lines, and target signature date." },
];

export function Step2GoalLanguage() {
  const { goal, language, hintTone, patchStep2 } = usePreMeetingStore();

  return (
    <div className="setup-step">
      <h2 className="setup-step-title">What's the goal of this meeting?</h2>

      <Field label="Meeting goal" hint="Specificity matters — vague goals get generic hints.">
        <textarea
          className="setup-textarea"
          rows={4}
          value={goal}
          onChange={(e) => patchStep2({ goal: e.target.value })}
          placeholder="e.g. Probe latency requirements and current Bedrock spend; surface Model Garden + regional endpoints."
          autoFocus
        />
      </Field>

      <div className="setup-templates">
        <span className="setup-templates-label">Or pick a template:</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            className="setup-template-chip"
            onClick={() => patchStep2({ goal: t.goal })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Field label="Primary language">
        <SegmentedControl<"auto" | LangCode>
          options={[
            { value: "auto", label: "Auto-detect" },
            { value: "he", label: "עברית" },
            { value: "en", label: "English" },
          ]}
          value={language}
          onChange={(v) => patchStep2({ language: v })}
        />
      </Field>

      <Field label="Hint tone">
        <SegmentedControl
          options={[
            { value: "direct", label: "Direct" },
            { value: "consultative", label: "Consultative" },
            { value: "brief", label: "Brief" },
          ]}
          value={hintTone}
          onChange={(v) => patchStep2({ hintTone: v as "direct" | "consultative" | "brief" })}
        />
      </Field>
    </div>
  );
}
