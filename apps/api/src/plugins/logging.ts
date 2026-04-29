import type { FastifyInstance } from "fastify";

/**
 * Logging plugin — scrubs PII before any log line is emitted.
 * Per requirements: NEVER log transcript text or client names.
 *
 * Sprint 0: pass-through. Sprint 4 wires the redaction list when transcripts arrive.
 */
export async function registerLogging(app: FastifyInstance) {
  app.addHook("onRequest", async (req) => {
    req.log.info({ method: req.method, url: req.url }, "request received");
  });
}
