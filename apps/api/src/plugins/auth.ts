import { type App, applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { Config } from "../config.ts";
import { isAllowedEmail } from "../middleware/domain-gate.ts";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const PUBLIC_PATHS = new Set<string>(["/healthz", "/auth/signin"]);

let _adminApp: App | null = null;
function getAdminApp(): App {
  if (_adminApp) return _adminApp;
  _adminApp =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
    });
  return _adminApp;
}

export async function registerAuth(app: FastifyInstance, config: Config) {
  const allowDevToken = config.NODE_ENV !== "production";

  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split("?")[0] ?? "";
    if (PUBLIC_PATHS.has(path)) return;
    if (req.url.startsWith("/ws/")) return; // WS upgrade is auth'd via query token

    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.code(401).send({ code: "unauthenticated", message: "Missing bearer token" });
    }

    const token = auth.slice(7);

    // Dev convenience: a literal "dev-token" lets local curls hit authed routes.
    // Disabled in production.
    if (allowDevToken && token === "dev-token") {
      const firstDomain = config.ALLOWED_EMAIL_DOMAIN.split(",")[0]?.trim() ?? "google.com";
      req.user = { uid: "dev", email: `dev@${firstDomain}`, emailVerified: true };
      return;
    }

    try {
      // checkRevoked=false (default): don't hit Identity Toolkit on every request.
      // The token's 1h expiry + Firebase auto-rotation are sufficient. Revocation
      // requires firebaseauth.user.get permission the api-runtime SA doesn't have.
      const decoded = await getAdminAuth(getAdminApp()).verifyIdToken(token);
      const email = decoded.email;
      if (!email || !decoded.email_verified || !isAllowedEmail(email, config)) {
        return reply.code(403).send({
          code: "domain-restricted",
          message: `Access is restricted to ${config.ALLOWED_EMAIL_DOMAIN
            .split(",")
            .map((d) => `@${d.trim()}`)
            .join(" or ")} accounts`,
        });
      }
      req.user = { uid: decoded.uid, email, emailVerified: decoded.email_verified, name: decoded.name as string | undefined };
    } catch (err) {
      app.log.warn({ err }, "token verification failed");
      return reply.code(401).send({ code: "unauthenticated", message: "Invalid token" });
    }
  });
}
