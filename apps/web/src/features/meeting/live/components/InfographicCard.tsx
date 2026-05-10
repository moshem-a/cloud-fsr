import type { Infographic } from "@scoach/types";

import { DiagramRenderer } from "./diagrams/DiagramRenderer.tsx";

export function InfographicCard({ infographic, badge }: { infographic: Infographic; badge?: string }) {
  const kindLabel = infographic.kind[0]!.toUpperCase() + infographic.kind.slice(1);
  const time = new Date(infographic.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="infographic-card">
      <div className="ig-card-head">
        <span className="ig-card-title">{infographic.title}</span>
        <span className="ig-card-meta mono">
          {badge && <span className="ig-badge">{badge}</span>}
          {kindLabel} · {time}
        </span>
      </div>
      <div className="ig-card-body">
        <DiagramRenderer infographic={infographic} />
      </div>
    </div>
  );
}
