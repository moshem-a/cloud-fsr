import { Search } from "@scoach/ui/icons";
import { useState } from "react";

/**
 * Sprint 5+ wires this to the real meeting transcript stored in
 * Firestore at `meetings/:id/transcript`. Until then the panel shows an
 * empty state — no fake speaker names.
 */
export function FullTranscript() {
  const [lang, setLang] = useState<"en" | "he" | "bi">("en");
  const [search, setSearch] = useState("");

  return (
    <div className="ft-wrap">
      <div className="ft-head">
        <div className="search-box">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search transcript…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="seg seg-sm">
          <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
          <button type="button" className={lang === "he" ? "on" : ""} onClick={() => setLang("he")}>עברית</button>
          <button type="button" className={lang === "bi" ? "on" : ""} onClick={() => setLang("bi")}>Both</button>
        </div>
      </div>
      <div className="ft-body">
        <div className="ft-line" style={{ color: "var(--text-3)", textAlign: "center", padding: "32px 16px" }}>
          The full transcript will appear here after the live meeting ends and the recording is processed.
        </div>
      </div>
    </div>
  );
}
