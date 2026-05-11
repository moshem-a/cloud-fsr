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
    const now = new Date();

    const upsellCounts = new Map<string, number>();
    const overdueByClient = new Map<string, number>();
    let totalOverdue = 0;
    const riskByClient = new Map<string, number>();
    let totalRisks = 0;
    let totalHintsActed = 0;
    let totalHints = 0;
    let bestScore = 0;
    let bestClient = "";
    const clientMeetings = new Map<string, number>();

    for (const m of meetings.slice(0, 20)) {
      const client = m.account?.name || "Unknown";
      clientMeetings.set(client, (clientMeetings.get(client) ?? 0) + 1);
      try {
        const summary = await summaryRepo.get(m.id);
        if (!summary?.internal) continue;
        for (const u of summary.internal.upsell ?? []) {
          upsellCounts.set(u.name, (upsellCounts.get(u.name) ?? 0) + 1);
        }
        const riskCount = summary.internal.risks?.length ?? 0;
        if (riskCount > 0) {
          riskByClient.set(client, (riskByClient.get(client) ?? 0) + riskCount);
          totalRisks += riskCount;
        }
        for (const ai of summary.internal.actionItems ?? []) {
          if (!ai.done && ai.due && new Date(ai.due) < now) {
            totalOverdue++;
            overdueByClient.set(client, (overdueByClient.get(client) ?? 0) + 1);
          }
        }
        totalHintsActed += summary.internal.hintsActed ?? 0;
        totalHints += summary.internal.hintsSurfaced ?? 0;
        if (summary.internal.score > bestScore) {
          bestScore = summary.internal.score;
          bestClient = client;
        }
      } catch {}
    }

    const insights: CoachInsight[] = [];

    // Best performing meeting
    if (bestScore > 0 && bestClient) {
      insights.push({ icon: "up", title: `Best meeting score: ${bestScore}/100`, detail: `with ${bestClient}. Keep using the techniques that worked here.` });
    }

    // Upsell opportunities spotted across meetings
    const topUpsells = [...upsellCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (topUpsells.length > 0) {
      const detail = topUpsells.map(([name, count]) => `${name} (${count}x)`).join(", ");
      insights.push({ icon: "up", title: `Top upsell opportunities:`, detail });
    }

    // Overdue action items — show count + which clients
    if (totalOverdue > 0) {
      const topClients = [...overdueByClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const detail = topClients.map(([c, n]) => `${c} (${n})`).join(", ");
      insights.push({ icon: "warn", title: `${totalOverdue} overdue action item${totalOverdue > 1 ? "s" : ""}`, detail: `across ${overdueByClient.size} client${overdueByClient.size > 1 ? "s" : ""}: ${detail}` });
    }

    // Risks — count per client, no raw text
    if (totalRisks > 0 && insights.length < 3) {
      const topRiskClients = [...riskByClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const detail = topRiskClients.map(([c, n]) => `${c} (${n})`).join(", ");
      insights.push({ icon: "warn", title: `${totalRisks} risks flagged`, detail: `Top clients to review: ${detail}` });
    }

    // Hint usage rate
    if (totalHints > 0 && insights.length < 3) {
      const pct = Math.round((totalHintsActed / totalHints) * 100);
      insights.push({ icon: "info", title: `Hint usage: ${pct}%`, detail: `You acted on ${totalHintsActed} of ${totalHints} coaching hints across your meetings.` });
    }

    // Most active client
    if (insights.length < 3) {
      const topClient = [...clientMeetings.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topClient && topClient[1] > 1) {
        insights.push({ icon: "info", title: `Most active client: ${topClient[0]}`, detail: `${topClient[1]} meetings. Consider reviewing trends for this account.` });
      }
    }

    // Fallback
    if (meetings.length > 0 && insights.length < 3) {
      insights.push({ icon: "up", title: `${meetings.length} meetings tracked.`, detail: "Keep using Sally to build deeper coaching insights." });
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
