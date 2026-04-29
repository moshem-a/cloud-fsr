import type { SignInRequest, SignInResponse, VerifyGeminiKeyResponse } from "@scoach/types";
import type { FastifyInstance } from "fastify";

import type { Config } from "../config.ts";
import { isAllowedEmail } from "../middleware/domain-gate.ts";

const KEY_RX = /^AIza[\w-]{20,}$/;

export async function registerAuthRoutes(app: FastifyInstance, config: Config) {
  app.post<{ Body: SignInRequest; Reply: SignInResponse }>("/auth/signin", async (_req, reply) => {
    return reply.code(501).send({
      code: "not-implemented",
      message: "Sign-in is handled client-side via Firebase Auth; the api uses the resulting ID token.",
    } as unknown as SignInResponse);
  });

  /**
   * Probes generativelanguage.googleapis.com/v1beta/models?key=… with the
   * caller's key. Returns { valid: true } if the key works AND lists at least
   * one Gemini model.
   *
   * Authoritative — do not skip even if regex passes; we want to catch revoked
   * or domain-restricted keys.
   */
  app.post<{ Body: { key: string }; Reply: VerifyGeminiKeyResponse }>(
    "/auth/verify-gemini-key",
    async (req, reply) => {
      const user = req.user;
      if (!user || !isAllowedEmail(user.email, config)) {
        return reply.code(403).send({ valid: false, error: "Access restricted to @google.com accounts" });
      }
      const key = req.body?.key;
      if (!key || !KEY_RX.test(key)) {
        return reply.send({ valid: false, error: "Key format invalid (expected AIzaSy…)" });
      }

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          return reply.send({ valid: false, error: body.error?.message ?? `HTTP ${res.status}` });
        }
        const json = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
        const models = json.models ?? [];
        const proHit = models.find((m) => m.name?.includes("gemini-2.5-pro") || m.name?.includes("gemini-pro"));
        return reply.send({
          valid: true,
          quotaTier: "paid",
          modelAvailable: proHit?.name?.replace(/^models\//, "") ?? "gemini-2.5-flash",
        });
      } catch (err) {
        app.log.warn({ err }, "verify-gemini-key probe failed");
        return reply.send({ valid: false, error: (err as Error).message });
      }
    },
  );

  app.post("/auth/signout", async (_req, reply) => reply.code(204).send());
}
