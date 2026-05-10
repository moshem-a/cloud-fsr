import type { ListCalendarEventsResponse } from "@scoach/types";
import type { FastifyInstance } from "fastify";

import { listUpcomingEvents } from "../services/google-calendar.service.ts";

export async function registerCalendarRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { days?: string }; Reply: ListCalendarEventsResponse }>(
    "/calendar/events",
    async (req, reply) => {
      const accessToken = req.headers["x-google-access-token"] as string | undefined;
      if (!accessToken) {
        return reply.code(401).send({ events: [] } as unknown as ListCalendarEventsResponse);
      }

      const days = Math.min(Number(req.query.days) || 7, 30);

      try {
        const events = await listUpcomingEvents(accessToken, days);
        return { events };
      } catch (err) {
        req.log.error(err, "Calendar API error");
        return reply.code(502).send({ events: [] } as unknown as ListCalendarEventsResponse);
      }
    },
  );
}
