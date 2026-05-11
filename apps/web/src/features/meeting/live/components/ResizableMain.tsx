import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "sally.live.layout.v2";

const DEFAULTS = { rail: 240, coach: 460, transcript: 400 } as const;
const MIN = { rail: 200, coach: 320, transcript: 280 } as const;
const MAX = { rail: 480, coach: 900, transcript: 800 } as const;

interface Widths {
  rail: number;
  coach: number;
  transcript: number;
}

interface ResizableMainProps {
  rail: ReactNode;
  coach: ReactNode;
  transcript: ReactNode;
}

function loadWidths(): Widths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Widths>;
    return {
      rail: Math.max(MIN.rail, Math.min(parsed.rail ?? DEFAULTS.rail, MAX.rail)),
      coach: Math.max(MIN.coach, Math.min(parsed.coach ?? DEFAULTS.coach, MAX.coach)),
      transcript: Math.max(MIN.transcript, Math.min(parsed.transcript ?? DEFAULTS.transcript, MAX.transcript)),
    };
  } catch {
    return { ...DEFAULTS };
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
    typeof window === "undefined" ? { ...DEFAULTS } : loadWidths(),
  );
  const dragRef = useRef<{ which: "rail-coach" | "coach-transcript"; startX: number; startWidths: Widths } | null>(null);

  useEffect(() => {
    saveWidths(widths);
  }, [widths]);

  const onMouseDown = useCallback(
    (which: "rail-coach" | "coach-transcript") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { which, startX: e.clientX, startWidths: { ...widths } };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [widths],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      if (drag.which === "rail-coach") {
        const nextRail = Math.max(MIN.rail, Math.min(drag.startWidths.rail + dx, MAX.rail));
        setWidths((w) => ({ ...w, rail: nextRail }));
      } else {
        const nextCoach = Math.max(MIN.coach, Math.min(drag.startWidths.coach + dx, MAX.coach));
        const nextTranscript = Math.max(MIN.transcript, Math.min(drag.startWidths.transcript - dx, MAX.transcript));
        setWidths((w) => ({ ...w, coach: nextCoach, transcript: nextTranscript }));
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
  }, []);

  const gridStyle = useMemo<React.CSSProperties>(
    () => ({
      gridTemplateColumns: `${widths.rail}px 6px minmax(0, 1fr) 6px ${widths.transcript}px`,
    }),
    [widths.rail, widths.transcript],
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

