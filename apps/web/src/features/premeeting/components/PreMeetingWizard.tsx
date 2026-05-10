import { Button, Stepper, useToast } from "@scoach/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { preMeetingApi } from "../api.ts";
import { usePreMeetingStore } from "../store.ts";
import { PreviewRail } from "./PreviewRail.tsx";
import { Step1Client } from "./Step1Client.tsx";
import { Step2GoalLanguage } from "./Step2GoalLanguage.tsx";
import { Step3Context } from "./Step3Context.tsx";
import { Step4Ready } from "./Step4Ready.tsx";

const STEPS = ["Client", "Goal & Language", "Context", "Ready"];

export interface PreMeetingWizardProps {
  meetingId: string;
}

export function PreMeetingWizard({ meetingId }: PreMeetingWizardProps) {
  const { step, setStep, hydrated, hydrateFromMeeting, client, title, stage, goal, language, hintTone, reset } = usePreMeetingStore();
  const nav = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(!hydrated);

  useEffect(() => {
    let cancelled = false;
    preMeetingApi.fetchMeeting(meetingId).then((m) => {
      if (cancelled) return;
      if (m) {
        hydrateFromMeeting(m);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  useEffect(() => () => reset(), []);

  const canGoNext =
    (step === 0 && client.trim() && title.trim()) ||
    (step === 1 && goal.trim().length > 5) ||
    step === 2 ||
    step === 3;

  async function persistAndAdvance() {
    if (step === 0) {
      try {
        await preMeetingApi.patchMeeting(meetingId, {
          account: { name: client },
          title,
          stage,
        });
      } catch (err) {
        toast.push({ tone: "error", message: (err as Error).message });
        return;
      }
    }
    if (step === 1) {
      try {
        await preMeetingApi.patchMeeting(meetingId, {
          goal,
          language,
        });
      } catch (err) {
        toast.push({ tone: "error", message: (err as Error).message });
        return;
      }
    }
    if (step < 3) {
      setStep((step + 1) as 0 | 1 | 2 | 3);
    }
  }

  void hintTone;

  if (loading) {
    return (
      <div className="setup">
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
          Loading meeting setup...
        </div>
      </div>
    );
  }

  return (
    <div className="setup">
      <div className="setup-top">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => nav({ to: "/dashboard" })}
        >
          ← Cancel
        </button>
        <Stepper steps={STEPS} current={step} onStepClick={(s) => setStep(s as 0 | 1 | 2 | 3)} />
      </div>

      <div className="setup-body">
        <main className="setup-main">
          {step === 0 && <Step1Client />}
          {step === 1 && <Step2GoalLanguage />}
          {step === 2 && <Step3Context meetingId={meetingId} />}
          {step === 3 && <Step4Ready meetingId={meetingId} />}
        </main>

        <PreviewRail />
      </div>

      <footer className="setup-footer">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((step - 1) as 0 | 1 | 2 | 3)}
        >
          Back
        </Button>
        {step < 3 && (
          <Button variant="primary" onClick={persistAndAdvance} disabled={!canGoNext}>
            Next
          </Button>
        )}
      </footer>
    </div>
  );
}
