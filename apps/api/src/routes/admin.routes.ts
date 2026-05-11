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

    const users: AdminUser[] = [];

    // 1. List all Firebase Auth users (actual logged-in Google accounts)
    const authUsers = new Map<string, { email: string; name: string; photoUrl?: string }>();
    try {
      const { getApps } = await import("firebase-admin/app");
      const { getAuth } = await import("firebase-admin/auth");
      const adminApp = getApps()[0];
      if (adminApp) {
        let nextPageToken: string | undefined;
        do {
          const result = await getAuth(adminApp).listUsers(1000, nextPageToken);
          for (const u of result.users) {
            authUsers.set(u.uid, {
              email: u.email ?? u.uid,
              name: u.displayName ?? "",
              photoUrl: u.photoURL,
            });
          }
          nextPageToken = result.pageToken;
        } while (nextPageToken);
      }
    } catch (err) {
      console.warn(`[admin] listUsers failed: ${(err as Error).message}`);
    }

    // 2. Count meetings per owner from Firestore
    const meetingStats = new Map<string, {
      count: number;
      simCount: number;
      totalMinutes: number;
      lastDate: string;
    }>();

    if (isFirestoreEnabled()) {
      try {
        const snap = await getDb().collection("meetings").get();
        for (const doc of snap.docs) {
          const d = doc.data();
          const uid = d.ownerUid as string;
          if (!uid) continue;

          const cur = meetingStats.get(uid) ?? { count: 0, simCount: 0, totalMinutes: 0, lastDate: "" };
          cur.count++;
          if (d.meetingType === "simulation") cur.simCount++;

          if (d.startedAt && d.endedAt) {
            const mins = (Date.parse(d.endedAt) - Date.parse(d.startedAt)) / 60000;
            if (mins > 0 && mins < 600) cur.totalMinutes += mins;
          }

          const date = (d.updatedAt ?? d.createdAt ?? "") as string;
          if (date > cur.lastDate) cur.lastDate = date;

          meetingStats.set(uid, cur);
        }
      } catch (err) {
        console.warn(`[admin] meetings query failed: ${(err as Error).message}`);
      }
    }

    // 3. Merge: start from auth users, enrich with meeting stats
    for (const [uid, info] of authUsers) {
      const stats = meetingStats.get(uid);
      users.push({
        uid,
        email: info.email,
        name: info.name || undefined,
        meetingCount: stats?.count ?? 0,
        simulationCount: stats?.simCount ?? 0,
        totalMinutes: Math.round(stats?.totalMinutes ?? 0),
        lastMeetingDate: stats?.lastDate || undefined,
      });
    }

    // 4. Add any meeting owners not in auth (edge case)
    for (const [uid, stats] of meetingStats) {
      if (!authUsers.has(uid)) {
        users.push({
          uid,
          email: uid,
          name: undefined,
          meetingCount: stats.count,
          simulationCount: stats.simCount,
          totalMinutes: Math.round(stats.totalMinutes),
          lastMeetingDate: stats.lastDate || undefined,
        });
      }
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
