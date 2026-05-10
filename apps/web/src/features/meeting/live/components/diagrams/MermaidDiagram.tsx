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

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !chart) return;
    const id = `mermaid-${++counter}`;
    ref.current.innerHTML = "";
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch((err) => {
        console.warn("[mermaid] render failed", err);
        if (ref.current) {
          ref.current.innerHTML = `<pre style="font-size:12px;color:var(--text-3);white-space:pre-wrap">${chart}</pre>`;
        }
      });
  }, [chart]);

  return <div ref={ref} className="mermaid-container" />;
}
