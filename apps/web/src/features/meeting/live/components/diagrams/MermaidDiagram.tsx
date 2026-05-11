import { useEffect, useRef } from "react";
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
  // Strip markdown code fences that LLMs sometimes add
  chart = chart.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  // Fix escaped newlines from JSON
  chart = chart.replace(/\\n/g, "\n");
  // Remove empty lines that can confuse the parser
  chart = chart
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .join("\n");
  return chart;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !chart) return;
    const id = `mermaid-${++counter}`;
    ref.current.innerHTML = "";
    const cleaned = sanitizeMermaid(chart);
    mermaid
      .render(id, cleaned)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch((err) => {
        console.warn("[mermaid] render failed", err);
        if (ref.current) {
          const pre = document.createElement("pre");
          pre.style.cssText = "font-size:12px;color:var(--text-3);white-space:pre-wrap;padding:8px;margin:0";
          pre.textContent = cleaned;
          ref.current.innerHTML = "";
          ref.current.appendChild(pre);
        }
      });
  }, [chart]);

  return <div ref={ref} className="mermaid-container" />;
}
