import { Field, SegmentedControl } from "@scoach/ui";
import type { MeetingStage } from "@scoach/types";

import { usePreMeetingStore } from "../store.ts";

export function Step1Client() {
  const { client, website, title, stage, patchStep1 } = usePreMeetingStore();

  return (
    <div className="setup-step">
      <h2 className="setup-step-title">Who and what is this meeting about?</h2>

      <Field label="Client / company" hint="Used to look up prior calls and build context.">
        <input
          type="text"
          className="setup-input"
          value={client}
          onChange={(e) => patchStep1({ client: e.target.value })}
          placeholder="e.g. Aviv Capital"
          autoFocus
        />
      </Field>

      <Field label="Meeting title">
        <input
          type="text"
          className="setup-input"
          value={title}
          onChange={(e) => patchStep1({ title: e.target.value })}
          placeholder="e.g. Vertex AI Migration · Technical deep-dive"
        />
      </Field>

      <Field label="Website" hint="Optional. We'll fetch and analyze it for client context.">
        <input
          type="text"
          className="setup-input"
          value={website}
          onChange={(e) => patchStep1({ website: e.target.value })}
          placeholder="e.g. avivcapital.com"
        />
      </Field>

      <Field label="Stage">
        <SegmentedControl<MeetingStage>
          options={[
            { value: "Intro", label: "Intro" },
            { value: "Discovery", label: "Discovery" },
            { value: "Qualification", label: "Qualification" },
            { value: "Negotiation", label: "Negotiation" },
          ]}
          value={stage}
          onChange={(v) => patchStep1({ stage: v })}
        />
      </Field>
    </div>
  );
}
