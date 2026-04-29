import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { loadConfig } from "./config.ts";
import { registerLogging } from "./plugins/logging.ts";
import { registerAuth } from "./plugins/auth.ts";
import { registerHealthRoutes } from "./routes/health.routes.ts";
import { registerAuthRoutes } from "./routes/auth.routes.ts";
import { registerContextRoutes } from "./routes/context.routes.ts";
import { registerLiveRoutes } from "./routes/live.routes.ts";
import { registerMeetingsRoutes } from "./routes/meetings.routes.ts";
import { registerSummaryRoutes } from "./routes/summary.routes.ts";
import { registerUsersRoutes } from "./routes/users.routes.ts";
import { registerWsMeeting } from "./routes/ws.meeting.ts";

export async function buildServer() {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
          : undefined,
    },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(","),
    credentials: true,
  });
  await app.register(websocket);

  await registerLogging(app);
  await registerAuth(app, config);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app, config);
  await registerUsersRoutes(app);
  await registerMeetingsRoutes(app);
  await registerContextRoutes(app);
  await registerLiveRoutes(app);
  await registerSummaryRoutes(app);
  await registerWsMeeting(app);

  app.decorate("config", config);
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    config: ReturnType<typeof loadConfig>;
  }
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ host: app.config.HOST, port: app.config.PORT });
    app.log.info(`api ready on http://${app.config.HOST}:${app.config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
