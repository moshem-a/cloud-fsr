import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "sally.live.layout.v1";

// Defaults — transcript dominant per user request, coach smaller, rail compact.
const DEFAULTS = { rail: 240, coach: 460 } as const;
const MIN = { rail: 200, coach: 320, transcript: 280 } as const;

interface Widths {
  rail: number;
  coach: number;
}

interface ResizableMainProps {
  rail: ReactNode;
  coach: ReactNode;
  transcript: ReactNode;
}

function loadWidths(): Widths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rail: DEFAULTS.rail, coach: DEFAULTS.coach };
    const parsed = JSON.parse(raw) as Partial<Widths>;
    return {
      rail: Math.max(MIN.rail, Math.min(parsed.rail ?? DEFAULTS.rail, 480)),
      coach: Math.max(MIN.coach, Math.min(parsed.coach ?? DEFAULTS.coach, 900)),
    };
  } catch {
    return { rail: DEFAULTS.rail, coach: DEFAULTS.coach };
  }
}

function saveWidths(w: Widths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
  } catch {
    // Ignore — quota / private mode.
  }
}

/**
 * Three-column live-meeting layout with drag-resizable boundaries.
 * Persists to localStorage so per-rep preferences stick across sessions.
 */
export function ResizableMain({ rail, coach, transcript }: ResizableMainProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Widths>(() =>
    typeof window === "undefined" ? { rail: DEFAULTS.rail, coach: DEFAULTS.coach } : loadWidths(),
  );
  const dragRef = useRef<{ which: "rail-coach" | "coach-transcript"; startX: number; startRail: number; startCoach: number } | null>(null);

  useEffect(() => {
    saveWidths(widths);
  }, [widths]);

  const onMouseDown = useCallback(
    (which: "rail-coach" | "coach-transcript") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { which, startX: e.clientX, startRail: widths.rail, startCoach: widths.coach };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [widths.rail, widths.coach],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const containerW = containerRef.current?.clientWidth ?? 1200;
      const maxTotal = containerW - 28; // gaps + padding
      if (drag.which === "rail-coach") {
        const nextRail = Math.max(MIN.rail, Math.min(drag.startRail + dx, 480));
        // Ensure transcript still has min space.
        const remaining = maxTotal - nextRail - widths.coach;
        if (remaining < MIN.transcript) return;
        setWidths((w) => ({ ...w, rail: nextRail }));
      } else {
        const nextCoach = Math.max(MIN.coach, Math.min(drag.startCoach + dx, 900));
        const remaining = maxTotal - widths.rail - nextCoach;
        if (remaining < MIN.transcript) return;
        setWidths((w) => ({ ...w, coach: nextCoach }));
      }
    }
    function onUp() {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [widths.rail, widths.coach]);

  const gridStyle = useMemo<React.CSSProperties>(
    () => ({
      gridTemplateColumns: `${widths.rail}px 6px minmax(0, 1fr) 6px min(20vw, 360px)`,
    }),
    [widths.rail, widths.coach],
  );

  return (
    <main className="main main-resizable" ref={containerRef} style={gridStyle}>
      <div className="resizable-col rail-col">{rail}</div>
      <div
        className="col-resizer"
        onMouseDown={onMouseDown("rail-coach")}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize rail / coach"
        title="Drag to resize"
      />
      <div className="resizable-col coach-col">{coach}</div>
      <div
        className="col-resizer"
        onMouseDown={onMouseDown("coach-transcript")}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize coach / transcript"
        title="Drag to resize"
      />
      <div className="resizable-col transcript-col">{transcript}</div>
    </main>
  );
}

export function resetLiveLayout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
  // Force a hard reload so the new defaults take effect cleanly.
  window.location.reload();
}

