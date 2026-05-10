# Sally — Your AI Sales Assistant

Real-time AI assistant that runs alongside Google Meet during Google Cloud sales calls. Listens to audio via Cloud Speech-to-Text V2 (Chirp 3), surfaces competitive and coaching hints using Gemini 2.5 Pro/Flash, tracks live sentiment, and produces post-meeting deliverables (internal summary + client email draft + PDF export).

**Live:** [agentic-system-488914.web.app](https://agentic-system-488914.web.app)
**Internal tool — `@google.com` access only.**

---

## Architecture

```mermaid
graph TB
    subgraph Browser["Browser (React SPA)"]
        UI["TanStack Router<br/>Dashboard · Live · Summary<br/>Tasks · Clients · Settings"]
        Auth["Firebase Auth<br/>Google OAuth"]
        Zustand["Zustand Store"]
        Mic["Mic Capture<br/>WebAudio API"]
        Screen["Screen Share<br/>getDisplayMedia"]
        QuietAsk["Quiet Ask<br/>Client-side Gemini"]
    end

    subgraph Firebase["Firebase"]
        Hosting["Firebase Hosting<br/>CDN + Rewrites"]
        Firestore["Firestore<br/>meetings · transcript<br/>hints · sentiment · notes"]
        Storage["Cloud Storage<br/>Context uploads · Exports"]
        FBAuth["Firebase Auth<br/>Domain-gated @google.com"]
    end

    subgraph CloudRun["Cloud Run (scoach-api)"]
        Fastify["Fastify Server"]
        subgraph Services["Services"]
            STT["Speech-to-Text V2<br/>Chirp 3<br/>Hebrew + English"]
            GeminiSvc["Gemini Service<br/>Vertex AI"]
            AudioSvc["Audio Session<br/>Manager"]
            SummarySvc["Summary Service"]
            PDFSvc["PDF Export<br/>pdf-lib"]
        end
        subgraph Routes["API Routes"]
            AuthR["/auth"]
            MeetingsR["/meetings"]
            LiveR["/live · /ws"]
            SummaryR["/summary"]
            TasksR["/tasks"]
            ContextR["/context"]
        end
    end

    subgraph GCP["Google Cloud AI"]
        Gemini25Pro["Gemini 2.5 Pro<br/>Hints · Summary · Email"]
        Gemini25Flash["Gemini 2.5 Flash<br/>Sentiment · Entities<br/>Screen Analysis"]
        CloudSTT["Cloud Speech-to-Text V2<br/>Streaming Transcription"]
    end

    UI --> Hosting
    Hosting --> Fastify
    Auth --> FBAuth
    UI <-->|Real-time sync| Firestore
    Mic -->|PCM 16kHz chunks| LiveR
    Screen -->|Frames| LiveR
    QuietAsk -->|Direct| Gemini25Flash

    Fastify --> FBAuth
    AudioSvc --> CloudSTT
    CloudSTT -->|Transcript lines| Firestore
    GeminiSvc --> Gemini25Pro
    GeminiSvc --> Gemini25Flash
    GeminiSvc -->|Hints · Sentiment| Firestore
    SummarySvc --> Gemini25Pro
    PDFSvc --> Storage

    style Browser fill:#e8f0fe,stroke:#1a73e8
    style Firebase fill:#fff3e0,stroke:#f9a825
    style CloudRun fill:#e6f4ea,stroke:#1e8e3e
    style GCP fill:#fce4ec,stroke:#d32f2f
```

### Data Flow — Live Meeting

```mermaid
sequenceDiagram
    participant Rep as Sales Rep (Browser)
    participant API as Cloud Run API
    participant STT as Cloud STT V2
    participant Gemini as Gemini 2.5
    participant FS as Firestore
    participant UI as Live UI

    Rep->>API: POST /meetings/:id/audio (PCM chunks)
    API->>STT: Stream audio
    STT-->>API: Partial + final utterances
    API->>FS: Write transcript lines
    API->>Gemini: Transcript context → generate hints
    Gemini-->>API: Coaching hints + entities
    API->>FS: Write hints + sentiment
    FS-->>UI: Real-time snapshot listeners
    UI-->>Rep: Live transcript + hints + sentiment
    Rep->>API: POST /meetings/:id/screen (frame)
    API->>Gemini: Vision analysis (competitor detection)
    Gemini-->>API: Screen insights
    API->>FS: Write screen hints
```

### Post-Meeting Summary Flow

```mermaid
sequenceDiagram
    participant Rep as Sales Rep
    participant API as Cloud Run API
    participant Gemini as Gemini 2.5 Pro
    participant FS as Firestore
    participant PDF as PDF Service

    Rep->>API: POST /summary/:id/generate
    API->>FS: Read full transcript + hints + sentiment
    API->>Gemini: Generate summary (health, risks, upsell, action items)
    Gemini-->>API: Structured summary
    API->>FS: Write summary document
    API->>Gemini: Draft client email
    Gemini-->>API: Email content
    API->>FS: Write email draft
    Rep->>API: GET /summary/:id/pdf
    API->>PDF: Render summary to PDF
    PDF-->>Rep: PDF download
```

---

## Stack

| Layer    | Technology                                                             |
| -------- | ---------------------------------------------------------------------- |
| Monorepo | pnpm workspaces                                                        |
| Frontend | Vite + React 18 + TypeScript + TanStack Router + Zustand               |
| Backend  | Node 20 + Fastify 5 + TypeScript                                       |
| Auth     | Firebase Auth + Google OAuth (Workspace Internal, `@google.com`)        |
| Database | Firestore (Native mode, `nam5` multi-region)                            |
| Storage  | Cloud Storage (context uploads, PDF exports)                            |
| STT      | Cloud Speech-to-Text V2 (Chirp 3, `he-IL` + `en-US` bilingual)         |
| LLM      | Gemini 2.5 Pro / Flash via Vertex AI (server) + browser-direct (Quiet Ask) |
| Hosting  | Firebase Hosting (CDN) + Cloud Run (`scoach-api`, `us-central1`)        |
| CI/CD    | Cloud Build → Artifact Registry → Cloud Run / Firebase Hosting          |

---

## Project Layout

```
apps/
  web/          # React SPA (Vite + TanStack Router)
  api/          # Cloud Run service (Fastify)
packages/
  types/        # Shared TypeScript types (Meeting, Hint, Transcript, etc.)
  ui/           # Design system primitives + icon set
  tokens/       # Design tokens (CSS variables)
  tsconfig/     # Shared tsconfig presets
infra/
  terraform/    # GCP project infra (Cloud Run, Firestore, Storage, Monitoring)
  firebase/     # Firestore rules, indexes, Storage rules
  cloudbuild/   # CI/CD pipeline configs
scripts/        # Deployment and utility scripts
docs/
  adr/          # Architecture decision records
  runbooks/     # Operational runbooks
spikes/
  audio-capture/ # WebAudio + getDisplayMedia proof-of-concept
```

---

## Features

- **Dashboard** — Meeting history, top clients, coach insights, team activity
- **Pre-Meeting Wizard** — Set goals, language, stage, upload client context docs
- **Live Coaching** — Real-time transcript, AI coaching hints, sentiment tracking, screen share analysis, private notes
- **Quiet Ask** — Private Q&A with Gemini during live calls (client-side, not visible to others)
- **Post-Meeting Summary** — AI-generated internal summary with health score, risks, upsell opportunities, action items
- **Client Email Draft** — Auto-generated follow-up email ready to send
- **PDF Export** — Downloadable meeting summary with bilingual support (Hebrew + English)
- **Tasks** — Action items aggregated across all meetings
- **Clients** — Client directory with meeting history per account
- **Sharing** — Share meeting summaries with teammates

---

## Local Development

Requires Node 20.10+ and pnpm 9+.

```bash
pnpm install
pnpm dev          # starts web (5173) + api (8080) in parallel
pnpm test         # runs all workspace tests
pnpm typecheck
pnpm lint
```

The web app uses [MSW](https://mswjs.io/) in development, so it works without the API service running.

---

## Deployment

### Web (Firebase Hosting)
```bash
cd apps/web && pnpm build
firebase deploy --only hosting
```

### API (Cloud Run)
```bash
gcloud builds submit --config=cloudbuild.yaml
```

---

## Environment Variables

| Variable | Where | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | API | Google Cloud project for Vertex AI + STT |
| `FIREBASE_PROJECT_ID` | API | Firebase project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | API | Service account key path |
| `VITE_FIREBASE_*` | Web | Firebase client config (apiKey, authDomain, etc.) |
