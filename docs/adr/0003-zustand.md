# ADR 0003: Zustand for client state (over Redux, Jotai, Context)

**Status:** Accepted · Sprint 0 · 2026-04-28

## Context

The web app has a few distinct state shapes:
- Auth state (Firebase user, Gemini key verification, settings) — global, low-frequency writes
- Live meeting state (transcript stream, hints, sentiment, mute) — global, high-frequency writes (10+/sec)
- Per-screen UI state (modals, filters, form drafts) — local, useState-friendly
- Pre-meeting wizard state — feature-scoped, multi-step

We need:
- Subscriptions that don't re-render the whole tree on every transcript line
- DevTools for debugging the live state stream
- A small bundle (the SPA already pulls in Firebase + TanStack Router + Floating UI)

## Decision

Use **Zustand 5** with a slice-per-feature pattern. No Redux. No Jotai. No global Context for stateful data.

- One slice per feature: `useAuthStore`, `useLiveMeetingStore`, `usePreMeetingWizard`.
- Use `subscribeWithSelector` middleware for fine-grained subscriptions in the live screen.
- Derive computed values via selectors at the call site, not in the store.
- DevTools middleware enabled in dev only.

## Why not Redux Toolkit

- Heavier (~13 KB vs ~3 KB for Zustand).
- Boilerplate (slices + reducers + dispatch) is overkill for this app's complexity.
- The team isn't large enough to need Redux's prescriptive conventions.

## Why not Jotai

- Atom-per-value model maps poorly onto streaming data (transcript lines, sentiment samples).
- Subscriptions are at the atom level — managing dozens of related atoms gets tedious for the live screen.

## Why not React Context

- Context re-renders every consumer when the value changes; the live screen would be uselessly slow.
- Cannot subscribe to a slice of context value.

## Consequences

**Good:**
- Tiny bundle, simple mental model.
- Fine-grained subscriptions stop the live screen from re-rendering on every transcript line.
- DevTools work out of the box.

**Bad:**
- No enforced action/reducer pattern; team must agree on conventions for store shape.
- Time-travel debugging is less rich than Redux DevTools.

## Revisit when

- The team grows past 5 FE devs and we need the discipline of Redux conventions.
- We need server-state caching beyond what `fetch` + a thin client provides — at that point add TanStack Query alongside Zustand (server state vs client state separation).
