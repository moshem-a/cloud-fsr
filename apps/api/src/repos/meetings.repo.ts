import type { HistoryItem, Meeting, MeetingStage } from "@scoach/types";

import { getDb, isFirestoreEnabled } from "./firestore.ts";
import { summaryRepo } from "./summary.repo.ts";

const COLLECTION = "meetings";

// In-memory store for local dev when Firestore isn't configured
const memory = new Map<string, Meeting>();

export const meetingsRepo = {
  async create(m: Meeting): Promise<Meeting> {
    if (isFirestoreEnabled()) {
      await getDb().collection(COLLECTION).doc(m.id).set(m);
      return m;
    }
    memory.set(m.id, m);
    return m;
  },

  async get(id: string): Promise<Meeting | null> {
    if (isFirestoreEnabled()) {
      const snap = await getDb().collection(COLLECTION).doc(id).get();
      return snap.exists ? (snap.data() as Meeting) : null;
    }
    return memory.get(id) ?? null;
  },

  async patch(id: string, patch: Partial<Meeting>): Promise<Meeting | null> {
    const updated = { ...patch, updatedAt: new Date().toISOString() };
    if (isFirestoreEnabled()) {
      await getDb().collection(COLLECTION).doc(id).set(updated, { merge: true });
      const snap = await getDb().collection(COLLECTION).doc(id).get();
      return snap.exists ? (snap.data() as Meeting) : null;
    }
    const cur = memory.get(id);
    if (!cur) return null;
    const next = { ...cur, ...updated };
    memory.set(id, next);
    return next;
  },

  async listForOwner(uid: string): Promise<Meeting[]> {
    if (isFirestoreEnabled()) {
      const snap = await getDb()
        .collection(COLLECTION)
        .where("ownerUid", "==", uid)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();
      return snap.docs.map((d) => d.data() as Meeting);
    }
    return Array.from(memory.values())
      .filter((m) => m.ownerUid === uid)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async historyForOwner(
    uid: string,
    opts: { scope?: "mine" | "shared"; stage?: MeetingStage; search?: string } = {},
  ): Promise<HistoryItem[]> {
    const all = await this.listForOwner(uid);
    let filtered = all;
    if (opts.scope === "shared") filtered = filtered.filter((m) => m.ownerUid !== uid);
    if (opts.stage) filtered = filtered.filter((m) => m.stage === opts.stage);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.account.name.toLowerCase().includes(q) ||
          m.title.toLowerCase().includes(q),
      );
    }
    const items = filtered.map(meetingToHistoryItem);
    await Promise.all(
      items.map(async (item) => {
        try {
          const summary = await summaryRepo.get(item.id);
          if (summary?.internal?.actionItems) {
            item.actionItemCount = summary.internal.actionItems.length;
            item.actionItemDone = summary.internal.actionItems.filter((a) => a.done).length;
          }
        } catch {}
      }),
    );
    return items;
  },
};

function meetingToHistoryItem(m: Meeting): HistoryItem {
  return {
    id: m.id,
    client: m.account.name,
    title: m.title,
    date: m.scheduledAt ?? m.createdAt,
    duration: m.endedAt && m.startedAt
      ? `${Math.round((Date.parse(m.endedAt) - Date.parse(m.startedAt)) / 60000)}m`
      : "—",
    rep: "Unknown",
    stage: m.stage,
    meetingType: m.meetingType,
    status: m.status,
    score: 0,
    sentiment: "neutral",
    tags: [],
    participants: m.participants.map((p) => p.name),
    hintCount: 0,
    actedOn: 0,
    avatar: "#5F6368",
  };
}
