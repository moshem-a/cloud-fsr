import type { TranscriptLine as TLine } from "@scoach/types";
import type { LangMode } from "../store.ts";

export interface TranscriptLineProps {
  line: TLine;
  lang: LangMode;
}

const HEBREW_COLOR_BY_NAME: Record<string, string> = {
  Daniel: "#F9AB00",
  Yael: "#EA4335",
};

export function TranscriptLine({ line, lang }: TranscriptLineProps) {
  const isClient = line.speaker === "client";

  let body: React.ReactNode;
  if (line.lang === "he") {
    if (lang === "he") {
      body = (
        <div className="t-he" dir="rtl">
          {line.text}
        </div>
      );
    } else if (lang === "en") {
      body = <div className="t-en">{line.trans ?? line.text}</div>;
    } else {
      body = (
        <>
          <div className="t-he" dir="rtl">
            {line.text}
          </div>
          <div className="t-trans">{line.trans}</div>
        </>
      );
    }
  } else {
    body = <div className="t-en">{line.text}</div>;
  }

  const avatarBg = isClient ? HEBREW_COLOR_BY_NAME[line.name] ?? "#EA4335" : "#1A73E8";

  return (
    <div className={`t-line ${isClient ? "t-line-client" : "t-line-rep"}`}>
      <div className="t-meta">
        <div className="t-avatar" style={{ background: avatarBg }}>
          {line.name[0]}
        </div>
        <div className="t-name">{line.name}</div>
        <div className="t-time mono">{line.t}</div>
        {line.sentiment === "buying" && <span className="t-sig sig-buying">↑ buying signal</span>}
        {line.sentiment === "concern" && <span className="t-sig sig-concern">⚠ hesitation</span>}
        <div className="t-flag mono">{line.lang.toUpperCase()}</div>
      </div>
      <div className="t-body">
        {body}
        {line.entities && line.entities.length > 0 && (
          <div className="t-ents">
            {line.entities.map((e) => (
              <span key={e} className="ent-pill">
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
