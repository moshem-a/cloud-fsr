import type { CoachInsight, CoachInsightsResponse, TeamMember, User, UserStatsResponse } from "@scoach/types";
import type { FastifyInstance } from "fastify";

import { meetingsRepo } from "../repos/meetings.repo.ts";
import { summaryRepo } from "../repos/summary.repo.ts";

// Minimal "team directory" — Sprint 5 backs this with Workspace Directory API.
const TEAM: TeamMember[] = [
  { uid: "u-noa", name: "Noa Levi", role: "Sr. Cloud SE", initials: "NL", color: "#1A73E8", email: "noalevi@google.com" },
  { uid: "u-tomer", name: "Tomer Avraham", role: "Sales Manager", initials: "TA", color: "#EA4335", email: "tavraham@google.com" },
  { uid: "u-maya", name: "Maya Stern", role: "Customer Engineer", initials: "MS", color: "#34A853", email: "mstern@google.com" },
  { uid: "u-eitan", name: "Eitan Shapira", role: "AE — Fintech", initials: "ES", color: "#F9AB00", email: "eitans@google.com" },
];

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get<{ Reply: User }>("/users/me", async (req, reply) => {
    const u = req.user!;
    const name = u.name ?? u.email.split("@")[0] ?? u.uid;
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
    const display: User = {
      uid: u.uid,
      email: u.email,
      name,
      role: "Sr. Cloud SE",
      team: "EMEA Cloud Sales",
      timezone: "Asia/Jerusalem",
      initials,
      color: "#1A73E8",
      settings: { language: "en", hintPace: "balanced", autoSummary: true, quietByDefault: false },
      geminiKeyVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return reply.send(display);
  });

  app.put<{ Body: Partial<User> }>("/user/profile", async (req, reply) => {
    // Sprint 5 persists; Sprint 2 just echoes.
    return reply.send({ ...req.body, uid: req.user!.uid });
  });

  app.put<{ Body: Partial<User["settings"]> }>("/user/settings", async (req, reply) => {
    return reply.send({ uid: req.user!.uid, settings: req.body });
  });

  app.get<{ Reply: UserStatsResponse }>("/users/me/stats", async (req) => {
    const uid = req.user!.uid;
    const meetings = await meetingsRepo.listForOwner(uid);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const thisWeekMeetings = meetings.filter((m) => new Date(m.updatedAt) >= weekStart);
    let totalMinutes = 0;
    for (const m of thisWeekMeetings) {
      if (m.startedAt && m.endedAt) {
        totalMinutes += Math.round((Date.parse(m.endedAt) - Date.parse(m.startedAt)) / 60_000);
      }
    }

    let totalConfidence = 0;
    let confCount = 0;
    let openTasks = 0;
    for (const m of meetings) {
      try {
        const summary = await summaryRepo.get(m.id);
        if (summary?.internal) {
          if (summary.internal.confidence) { totalConfidence += summary.internal.confidence; confCount++; }
          openTasks += (summary.internal.actionItems ?? []).filter((a) => !a.done).length;
        }
      } catch {}
    }

    return {
      thisWeek: {
        meetings: thisWeekMeetings.length,
        minutes: totalMinutes,
        hintsActedPct: 0,
        avgConfidence: confCount > 0 ? totalConfidence / confCount : undefined,
        openTasks,
      },
      trend: { meetings: 0, minutes: 0, hintsActedPct: 0 },
    };
  });

  app.get<{ Reply: CoachInsightsResponse }>("/users/me/insights", async (req) => {
    const uid = req.user!.uid;
    const meetings = await meetingsRepo.listForOwner(uid);
    const topicCounts = new Map<string, number>();
    const overdueItems: string[] = [];
    const riskSet = new Set<string>();
    const now = new Date();

    for (const m of meetings.slice(0, 20)) {
      try {
        const summary = await summaryRepo.get(m.id);
        if (!summary?.internal) continue;
        for (const moment of summary.internal.topMoments ?? []) {
          const words = moment.quote.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
          for (const w of words) topicCounts.set(w, (topicCounts.get(w) ?? 0) + 1);
        }
        for (const risk of summary.internal.risks ?? []) riskSet.add(risk);
        for (const ai of summary.internal.actionItems ?? []) {
          if (!ai.done && ai.due && new Date(ai.due) < now) {
            overdueItems.push(`${ai.what} (${m.account.name})`);
          }
        }
      } catch {}
    }

    const insights: CoachInsight[] = [];
    const repeating = [...topicCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (repeating.length > 0) {
      const top = repeating.slice(0, 3).map(([word, count]) => `"${word}" (${count}x)`).join(", ");
      insights.push({ icon: "info", title: `Recurring topics across meetings:`, detail: top });
    }
    if (overdueItems.length > 0) {
      insights.push({ icon: "warn", title: `${overdueItems.length} overdue action item${overdueItems.length > 1 ? "s" : ""}.`, detail: overdueItems.slice(0, 2).join("; ") });
    }
    if (riskSet.size > 0) {
      insights.push({ icon: "warn", title: `${riskSet.size} risk${riskSet.size > 1 ? "s" : ""} flagged across meetings.`, detail: [...riskSet].slice(0, 2).join("; ") });
    }
    if (meetings.length > 0 && insights.length < 3) {
      insights.push({ icon: "up", title: `${meetings.length} meetings tracked.`, detail: "Keep using Sally to build deeper insights." });
    }

    return { items: insights.slice(0, 3) };
  });

  app.get<{ Querystring: { q?: string }; Reply: { items: TeamMember[] } }>("/team/members", async (req) => {
    const q = req.query.q?.toLowerCase() ?? "";
    const items = q
      ? TEAM.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))
      : TEAM;
    return { items };
  });
}
