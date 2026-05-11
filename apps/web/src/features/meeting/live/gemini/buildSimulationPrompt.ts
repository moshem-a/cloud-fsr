import type { MeetingSummary } from "@scoach/types";

export interface SimulationContext {
  clientName: string;
  contactName?: string;
  contactRole?: string;
  industry?: string;
  stage: string;
  meetingGoal?: string;
  summary?: MeetingSummary | null;
}

export function buildSimulationPrompt(ctx: SimulationContext): string {
  const contactDesc = ctx.contactName
    ? `${ctx.contactName}${ctx.contactRole ? `, ${ctx.contactRole}` : ""}`
    : "the main contact";

  const parts: string[] = [
    `You are roleplaying as a client in a simulated sales meeting. You are ${contactDesc} from ${ctx.clientName}${ctx.industry ? ` (${ctx.industry} industry)` : ""}.`,
    "",
    "RULES:",
    "- Stay in character at all times. Never break the fourth wall or acknowledge you are AI.",
    "- Speak naturally in short sentences, like a real business conversation.",
    "- Ask realistic follow-up questions about what the sales rep is proposing.",
    "- Raise concerns, objections, or budget questions when appropriate.",
    "- Reference your company's actual needs and pain points from the previous meeting context.",
    "- If the rep makes a good point, acknowledge it but push for specifics.",
    "- Keep responses concise — 1-3 sentences per turn, like a real phone call.",
    `- The meeting stage is: ${ctx.stage}.`,
  ];

  if (ctx.summary) {
    const s = ctx.summary.internal;
    if (s.wentWell?.length) {
      parts.push("", "PREVIOUS MEETING — what went well:");
      for (const item of s.wentWell.slice(0, 3)) parts.push(`- ${item}`);
    }
    if (s.couldImprove?.length) {
      parts.push("", "PREVIOUS MEETING — areas that need improvement:");
      for (const item of s.couldImprove.slice(0, 3)) parts.push(`- ${item}`);
    }
    if (s.risks?.length) {
      parts.push("", "YOUR CONCERNS (bring these up naturally):");
      for (const item of s.risks.slice(0, 3)) parts.push(`- ${item}`);
    }
    const openItems = s.actionItems?.filter((a) => !a.done) ?? [];
    if (openItems.length > 0) {
      parts.push("", "OUTSTANDING ACTION ITEMS (ask about these):");
      for (const item of openItems.slice(0, 5)) {
        parts.push(`- ${item.what} (assigned to: ${item.who || "unassigned"})`);
      }
    }
    const allNeeds = [...(s.needs?.stated ?? []), ...(s.needs?.actual ?? [])];
    if (allNeeds.length) {
      parts.push("", "YOUR NEEDS:");
      for (const item of allNeeds.slice(0, 3)) parts.push(`- ${item}`);
    }
  }

  if (ctx.meetingGoal) {
    parts.push("", `REP'S GOAL FOR THIS MEETING: ${ctx.meetingGoal}`);
    parts.push("(Challenge them on this — don't make it easy.)");
  }

  parts.push("", "Start by greeting the rep and asking what's on the agenda for today.");

  return parts.join("\n");
}
