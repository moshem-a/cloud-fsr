import type { AdminMeetingView, AdminUser } from "@scoach/types";
import type { FastifyInstance } from "fastify";

import { getDb, isFirestoreEnabled } from "../repos/firestore.ts";
import { summaryRepo } from "../repos/summary.repo.ts";

const ADMIN_EMAIL = "moshem@google.com";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get<{ Reply: { users: AdminUser[] } }>("/admin/users", async (req, reply) => {
    if (req.user?.email !== ADMIN_EMAIL) {
      return reply.code(403).send({ code: "forbidden", message: "Admin only" } as never);
    }

    if (!isFirestoreEnabled()) {
      return { users: [] };
    }

    const snap = await getDb().collection("meetings").get();
    const byOwner = new Map<string, {
      email: string;
      name: string;
      count: number;
      simCount: number;
      totalMinutes: number;
      lastDate: string;
    }>();

    for (const doc of snap.docs) {
      const d = doc.data();
      const uid = d.ownerUid as string;
      if (!uid) continue;

      const cur = byOwner.get(uid) ?? {
        email: uid,
        name: "",
        count: 0,
        simCount: 0,
        totalMinutes: 0,
        lastDate: "",
      };

      cur.count++;
      if (d.meetingType === "simulation") cur.simCount++;

      // Calculate duration in minutes
      if (d.startedAt && d.endedAt) {
        const mins = (Date.parse(d.endedAt) - Date.parse(d.startedAt)) / 60000;
        if (mins > 0 && mins < 600) cur.totalMinutes += mins;
      }

      const date = (d.updatedAt ?? d.createdAt ?? "") as string;
      if (date > cur.lastDate) cur.lastDate = date;

      // Extract email/name from meeting participants or owner fields
      if (d.ownerEmail) cur.email = d.ownerEmail as string;
      if (d.ownerName) cur.name = d.ownerName as string;
      // Fallback: check participants for the rep
      if (!d.ownerEmail && d.participants) {
        const rep = (d.participants as Array<{ side: string; name: string }>)
          .find((p) => p.side === "rep");
        if (rep?.name) cur.name = rep.name;
      }

      byOwner.set(uid, cur);
    }

    // Try to resolve emails via Firebase Auth for users where we only have uid
    try {
      const { getApps } = await import("firebase-admin/app");
      const { getAuth } = await import("firebase-admin/auth");
      const adminApp = getApps()[0];
      if (adminApp) {
        for (const [uid, info] of byOwner) {
          if (info.email === uid) {
            try {
              const userRecord = await getAuth(adminApp).getUser(uid);
              if (userRecord.email) info.email = userRecord.email;
              if (userRecord.displayName) info.name = userRecord.displayName;
            } catch {}
          }
        }
      }
    } catch {}

    const users: AdminUser[] = [];
    for (const [uid, info] of byOwner) {
      users.push({
        uid,
        email: info.email,
        name: info.name || undefined,
        meetingCount: info.count,
        simulationCount: info.simCount,
        totalMinutes: Math.round(info.totalMinutes),
        lastMeetingDate: info.lastDate || undefined,
      });
    }

    users.sort((a, b) => (b.lastMeetingDate ?? "").localeCompare(a.lastMeetingDate ?? ""));
    return { users };
  });

  app.get<{
    Params: { uid: string };
    Reply: { meetings: AdminMeetingView[] };
  }>("/admin/users/:uid/meetings", async (req, reply) => {
    if (req.user?.email !== ADMIN_EMAIL) {
      return reply.code(403).send({ code: "forbidden", message: "Admin only" } as never);
    }

    if (!isFirestoreEnabled()) {
      return { meetings: [] };
    }

    const snap = await getDb()
      .collection("meetings")
      .where("ownerUid", "==", req.params.uid)
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();

    const meetings: AdminMeetingView[] = [];

    for (const doc of snap.docs) {
      const m = doc.data();
      let summaryHighlights: AdminMeetingView["summaryHighlights"];
      try {
        const summary = await summaryRepo.get(doc.id);
        if (summary?.internal) {
          summaryHighlights = {
            wentWell: summary.internal.wentWell?.slice(0, 3),
            couldImprove: summary.internal.couldImprove?.slice(0, 3),
            actionItemCount: summary.internal.actionItems?.length,
          };
        }
      } catch {}

      const startMs = m.startedAt ? Date.parse(m.startedAt) : 0;
      const endMs = m.endedAt ? Date.parse(m.endedAt) : 0;
      const dur = startMs && endMs ? `${Math.round((endMs - startMs) / 60000)}m` : "—";

      meetings.push({
        id: doc.id,
        title: m.title ?? "Untitled",
        client: m.account?.name ?? "—",
        stage: m.stage ?? "—",
        status: m.status,
        meetingType: m.meetingType,
        createdAt: m.createdAt ?? "",
        duration: dur,
        summaryHighlights,
      });
    }

    return { meetings };
  });
}
