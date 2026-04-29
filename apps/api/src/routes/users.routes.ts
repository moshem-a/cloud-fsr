import type { TeamMember, User, UserStatsResponse } from "@scoach/types";
import type { FastifyInstance } from "fastify";

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
    const display: User = {
      uid: u.uid,
      email: u.email,
      name: u.email.split("@")[0] ?? u.uid,
      role: "Sr. Cloud SE",
      team: "EMEA Cloud Sales",
      timezone: "Asia/Jerusalem",
      initials: (u.email[0] ?? "?").toUpperCase(),
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

  app.get<{ Reply: UserStatsResponse }>("/users/me/stats", async () => ({
    thisWeek: { meetings: 0, minutes: 0, hintsActedPct: 0, avgConfidence: 0, buyingSignals: 0 },
    trend: { meetings: 0, minutes: 0, hintsActedPct: 0 },
  }));

  app.get<{ Querystring: { q?: string }; Reply: { items: TeamMember[] } }>("/team/members", async (req) => {
    const q = req.query.q?.toLowerCase() ?? "";
    const items = q
      ? TEAM.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))
      : TEAM;
    return { items };
  });
}
