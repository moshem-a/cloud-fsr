import type { TranscriptLine } from "@scoach/types";
import { Search, Trash } from "@scoach/ui/icons";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";

import { getDb } from "../../../lib/firestore.ts";

export interface FullTranscriptProps {
  meetingId: string;
}

export function FullTranscript({ meetingId }: FullTranscriptProps) {
  const [lang, setLang] = useState<"en" | "he" | "bi">("bi");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const db = getDb();
        const ref = doc(db, "meetings", meetingId);
        const q = query(collection(ref, "transcript"), orderBy("_at", "asc"));
        const snap = await getDocs(q);
        if (cancelled) return;
        setLines(snap.docs.map((d) => d.data() as TranscriptLine));
      } catch (err) {
        console.warn("[transcript] failed to load", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [meetingId]);

  async function handleDeleteTranscript() {
    if (!window.confirm("Delete the entire transcript for this meeting? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const db = getDb();
      const ref = doc(db, "meetings", meetingId);
      const snap = await getDocs(collection(ref, "transcript"));
      const batch: Promise<void>[] = [];
      for (const d of snap.docs) {
        batch.push(deleteDoc(d.ref));
      }
      await Promise.all(batch);
      setLines([]);
    } catch (err) {
      console.warn("[transcript] delete failed", err);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = lines.filter((l) => {
    if (lang !== "bi" && l.lang !== lang) return false;
    if (search && !l.text.toLowerCase().includes(search.toLowerCase()) && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
        {lines.length > 0 && (
          <button
            type="button"
            className="ghost-btn"
            onClick={handleDeleteTranscript}
            disabled={deleting}
            style={{ color: "var(--gc-red, #d93025)", fontSize: 12, gap: 4 }}
          >
            <Trash size={13} /> {deleting ? "Deleting…" : "Delete transcript"}
          </button>
        )}
      </div>
      <div className="ft-body">
        {loading && (
          <div className="ft-line" style={{ color: "var(--text-3)", textAlign: "center", padding: "32px 16px" }}>
            Loading transcript…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="ft-line" style={{ color: "var(--text-3)", textAlign: "center", padding: "32px 16px" }}>
            {lines.length === 0 ? "No transcript recorded for this meeting." : "No lines match your filter."}
          </div>
        )}
        {filtered.map((line) => (
          <div key={line.id} className="ft-line">
            <span className="ft-time mono">{line.t}</span>
            <span className={`ft-speaker ${line.speaker === "rep" ? "ft-rep" : "ft-client"}`}>
              {line.name}
            </span>
            <span className="ft-text">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
