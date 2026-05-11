import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#e8f0fe",
    primaryBorderColor: "#1a73e8",
    primaryTextColor: "#202124",
    lineColor: "#5f6368",
    secondaryColor: "#e6f4ea",
    tertiaryColor: "#fef7e0",
    fontFamily: "Inter, sans-serif",
    fontSize: "13px",
  },
  flowchart: { curve: "basis", padding: 12 },
  securityLevel: "loose",
});

let counter = 0;

function sanitizeMermaid(raw: string): string {
  let chart = raw.trim();
  // Strip markdown code fences
  chart = chart.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  // Fix escaped newlines from JSON
  chart = chart.replace(/\\n/g, "\n");
  // Remove empty lines
  chart = chart
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .join("\n");

  // Fix common LLM mermaid mistakes:
  // 1. Unquoted labels with special chars — wrap in quotes
  chart = chart.replace(/\[([^\]"]*[()&<>{}#][^\]"]*)\]/g, (_m, label: string) => {
    return `["${label.replace(/"/g, "'")}"]`;
  });
  // 2. Remove HTML-like tags that break parsing
  chart = chart.replace(/<br\s*\/?>/gi, " ");
  // 3. Fix double-quoted strings inside node labels that use double quotes
  chart = chart.replace(/\["([^"]*)"([^"]*)"([^"]*)"\]/g, '["$1\'$2\'$3"]');
  // 4. Semicolons at end of lines break some diagram types
  chart = chart.replace(/;\s*$/gm, "");
  // 5. Fix "end" as a node name (reserved keyword)
  chart = chart.replace(/\b(end)\b(?=\s*[\[({])/gi, "End_");

  return chart;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current || !chart) return;
    setFailed(false);
    const id = `mermaid-${++counter}`;
    ref.current.innerHTML = "";
    const cleaned = sanitizeMermaid(chart);
    mermaid
      .render(id, cleaned)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => {
        setFailed(true);
        if (ref.current) ref.current.innerHTML = "";
      });
  }, [chart]);

  if (failed) return null;

  return <div ref={ref} className="mermaid-container" />;
}
