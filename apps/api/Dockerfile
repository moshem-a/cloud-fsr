# syntax=docker/dockerfile:1.7
#
# Single-stage image. Runtime is Node 20 + pnpm + tsx (TypeScript runtime).
# Cold start ~500 ms on Cloud Run; image ~250 MB. Sprint 5+ can switch to
# esbuild bundling + distroless for smaller image / faster start.

FROM node:20-bookworm-slim
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Workspace manifests first for build-cache friendliness
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/tsconfig packages/tsconfig
COPY packages/types packages/types
COPY apps/api/package.json apps/api/package.json

# Install only the api workspace + its deps
RUN pnpm install --frozen-lockfile --filter "@scoach/api..."

# App source
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.json

WORKDIR /repo/apps/api

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["pnpm", "exec", "tsx", "src/server.ts"]
