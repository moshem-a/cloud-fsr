import type { AdminMeetingView, AdminUser } from "@scoach/types";
import type { FastifyInstance } from "fastify";
import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { getDb, isFirestoreEnabled } from "../repos/firestore.ts";
import { summaryRepo } from "../repos/summary.repo.ts";

const ADMIN_EMAIL = "moshem@google.com";

function isAdmin(email: string | undefined): boolean {
  return email === ADMIN_EMAIL;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get<{ Reply: { users: AdminUser[] } }>("/admin/users", async (req, reply) => {
    if (!isAdmin(req.user?.email)) {
      return reply.code(403).send({ code: "forbidden", message: "Admin only" } as never);
    }

    if (!isFirestoreEnabled()) {
      return { users: [] };
    }

    const snap = await getDb().collection("meetings").orderBy("updatedAt", "desc").get();
    const byOwner = new Map<string, { count: number; simCount: number; lastDate: string }>();

    for (const doc of snap.docs) {
      const d = doc.data();
      const uid = d.ownerUid as string;
      if (!uid) continue;
      const cur = byOwner.get(uid) ?? { count: 0, simCount: 0, lastDate: "" };
      cur.count++;
      if (d.meetingType === "simulation") cur.simCount++;
      const date = (d.updatedAt ?? d.createdAt ?? "") as string;
      if (date > cur.lastDate) cur.lastDate = date;
      byOwner.set(uid, cur);
    }

    const adminApp = getApps()[0];
    const users: AdminUser[] = [];

    for (const [uid, info] of byOwner) {
      let email = uid;
      let name: string | undefined;
      if (adminApp) {
        try {
          const userRecord = await getAuth(adminApp).getUser(uid);
          email = userRecord.email ?? uid;
          name = userRecord.displayName ?? undefined;
        } catch {}
      }
      users.push({
        uid,
        email,
        name,
        meetingCount: info.count,
        simulationCount: info.simCount,
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
    if (!isAdmin(req.user?.email)) {
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
