import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({
    ok: true,
    service: "scoach-api",
    version: process.env.npm_package_version ?? "0.0.1",
    ts: Date.now(),
  }));
}
