import type {
  ListTasksResponse,
  TaskView,
  UpdateTaskRequest,
  UpdateTaskResponse,
} from "@scoach/types";
import type { FastifyInstance } from "fastify";

import { meetingsRepo } from "../repos/meetings.repo.ts";
import { summaryRepo } from "../repos/summary.repo.ts";
import { invalidateSummaryCache } from "./summary.routes.ts";

export async function registerTasksRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { client?: string; status?: string }; Reply: ListTasksResponse }>(
    "/tasks",
    async (req) => {
      const uid = req.user!.uid;
      const meetings = await meetingsRepo.listForOwner(uid);
      const tasks: TaskView[] = [];

      for (const m of meetings) {
        const summary = await summaryRepo.get(m.id);
        if (!summary?.internal?.actionItems) continue;
        for (const ai of summary.internal.actionItems) {
          tasks.push({
            taskId: `${m.id}::${ai.id}`,
            meetingId: m.id,
            client: m.account.name,
            meetingTitle: m.title,
            meetingDate: m.scheduledAt ?? m.createdAt,
            who: ai.who,
            what: ai.what,
            due: ai.due,
            done: ai.done,
          });
        }
      }

      let filtered = tasks;
      const { client, status } = req.query;
      if (client) filtered = filtered.filter((t) => t.client === client);
      if (status === "open") filtered = filtered.filter((t) => !t.done);
      if (status === "done") filtered = filtered.filter((t) => t.done);

      filtered.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.due.localeCompare(b.due);
      });

      return { items: filtered };
    },
  );

  app.patch<{ Params: { taskId: string }; Body: UpdateTaskRequest; Reply: UpdateTaskResponse }>(
    "/tasks/:taskId",
    async (req, reply) => {
      const parts = req.params.taskId.split("::");
      const meetingId = parts[0];
      const actionItemId = parts[1];
      if (!meetingId || !actionItemId) {
        return reply.code(400).send({} as TaskView);
      }

      const m = await meetingsRepo.get(meetingId);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({} as TaskView);
      }

      const summary = await summaryRepo.get(meetingId);
      if (!summary) return reply.code(404).send({} as TaskView);

      const idx = summary.internal.actionItems.findIndex((ai) => ai.id === actionItemId);
      if (idx === -1) return reply.code(404).send({} as TaskView);

      const existing = summary.internal.actionItems[idx]!;
      summary.internal.actionItems[idx] = { ...existing, done: req.body.done };
      await summaryRepo.write(meetingId, summary);
      invalidateSummaryCache(meetingId);

      const updated = summary.internal.actionItems[idx]!;
      return reply.send({
        taskId: req.params.taskId,
        meetingId,
        client: m.account.name,
        meetingTitle: m.title,
        meetingDate: m.scheduledAt ?? m.createdAt,
        who: updated.who,
        what: updated.what,
        due: updated.due,
        done: updated.done,
      });
    },
  );
}
