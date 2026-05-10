import type { ComparisonData, FlowData, GanttData, Infographic, StepData, TimelineData } from "@scoach/types";

import { ComparisonDiagram } from "./ComparisonDiagram.tsx";
import { FlowDiagram } from "./FlowDiagram.tsx";
import { GanttDiagram } from "./GanttDiagram.tsx";
import { MermaidDiagram } from "./MermaidDiagram.tsx";
import { StepsDiagram } from "./StepsDiagram.tsx";
import { TimelineDiagram } from "./TimelineDiagram.tsx";

export function DiagramRenderer({ infographic }: { infographic: Infographic }) {
  if (infographic.mermaid) {
    return <MermaidDiagram chart={infographic.mermaid} />;
  }

  switch (infographic.kind) {
    case "flow":
      return <FlowDiagram data={infographic.data as FlowData} />;
    case "timeline":
      return <TimelineDiagram data={infographic.data as TimelineData} />;
    case "comparison":
      return <ComparisonDiagram data={infographic.data as ComparisonData} />;
    case "steps":
      return <StepsDiagram data={infographic.data as StepData} />;
    case "gantt":
      return <GanttDiagram data={infographic.data as GanttData} />;
    default:
      return null;
  }
}
