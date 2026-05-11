import type { AdminMeetingView, AdminUser } from "@scoach/types";
import { Chev, User as UserIcon } from "@scoach/ui/icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuthStore } from "../../auth/store.ts";
import { DashHeader } from "../../dashboard/components/DashHeader.tsx";
import { adminApi } from "../api.ts";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const headerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 100px 100px 140px 30px",
  alignItems: "center",
  padding: "10px 16px",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  color: "var(--text-4)",
  fontWeight: 600,
  background: "var(--surface-2)",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 100px 100px 140px 30px",
  alignItems: "center",
  padding: "12px 16px",
  borderTop: "1px solid var(--border-soft)",
  cursor: "pointer",
  transition: "background .15s",
};

function UserMeetings({ uid }: { uid: string }) {
  const nav = useNavigate();
  const [meetings, setMeetings] = useState<AdminMeetingView[] | null>(null);

  useEffect(() => {
    adminApi.fetchUserMeetings(uid).then(setMeetings).catch(() => setMeetings([]));
  }, [uid]);

  if (!meetings) return <div style={{ padding: "12px 20px", color: "var(--text-4)" }}>Loading…</div>;
  if (meetings.length === 0) return <div style={{ padding: "12px 20px", color: "var(--text-4)" }}>No meetings found.</div>;

  return (
    <div style={{ padding: "8px 20px 16px", background: "var(--surface-2)" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 1fr 80px 80px 60px 80px 80px",
        gap: 0,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: ".06em",
        color: "var(--text-4)",
        padding: "6px 8px",
        borderBottom: "1px solid var(--border-soft)",
      }}>
        <div>Date</div>
        <div>Client</div>
        <div>Title</div>
        <div>Stage</div>
        <div>Status</div>
        <div>Dur.</div>
        <div>Actions</div>
        <div>Summary</div>
      </div>
      {meetings.map((m) => (
        <div
          key={m.id}
          style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 1fr 80px 80px 60px 80px 80px",
            gap: 0,
            padding: "8px",
            borderTop: "1px solid var(--border-soft)",
            cursor: "pointer",
            fontSize: 13,
          }}
          onClick={() => nav({ to: "/meetings/$id/summary", params: { id: m.id } })}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{formatDate(m.createdAt)}</div>
          <div style={{ fontWeight: 600 }}>{m.client}</div>
          <div>
            {m.title}
            {m.meetingType === "simulation" && (
              <span style={{
                marginLeft: 6, padding: "1px 5px", borderRadius: 4, fontSize: 10,
                fontWeight: 600, background: "var(--gc-purple-50, #f3e8fd)", color: "var(--gc-purple, #7627bb)",
              }}>SIM</span>
            )}
          </div>
          <div><span className={`stage-pill stage-${m.stage.toLowerCase()}`}>{m.stage}</span></div>
          <div style={{ fontSize: 12 }}>{m.status ?? "—"}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{m.duration}</div>
          <div style={{ fontSize: 12 }}>{m.summaryHighlights?.actionItemCount ?? "—"}</div>
          <div style={{ fontSize: 12 }}>
            {m.summaryHighlights?.wentWell ? (
              <span style={{ color: "var(--gc-green, #1e8e3e)" }} title={m.summaryHighlights.wentWell.join("; ")}>
                {m.summaryHighlights.wentWell.length} highlights
              </span>
            ) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminScreen() {
  const nav = useNavigate();
  const email = useAuthStore((s) => s.email);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  useEffect(() => {
    if (email !== "moshem@google.com") {
      nav({ to: "/dashboard" });
      return;
    }
    adminApi.fetchUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [email, nav]);

  if (email !== "moshem@google.com") return null;

  return (
    <div className="dash">
      <DashHeader onStartNew={() => nav({ to: "/dashboard" })} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "22px 28px 60px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
          Admin — All Users
        </h1>

        <section style={{
          background: "var(--surface)", border: "1px solid var(--border-soft)",
          borderRadius: "var(--r-lg)", boxShadow: "var(--sh-1)", overflow: "hidden",
        }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>No users found.</div>
          ) : (
            <div>
              <div style={headerStyle}>
                <div>User</div>
                <div>Email</div>
                <div style={{ textAlign: "center" }}>Meetings</div>
                <div style={{ textAlign: "center" }}>Simulations</div>
                <div>Last Active</div>
                <div></div>
              </div>
              {users.map((u) => {
                const isExpanded = expandedUid === u.uid;
                return (
                  <div key={u.uid}>
                    <div
                      style={{ ...rowStyle, background: isExpanded ? "var(--surface-2)" : "transparent" }}
                      onClick={() => setExpandedUid(isExpanded ? null : u.uid)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: "#5F6368",
                          color: "white", fontWeight: 600, fontSize: 13,
                          display: "grid", placeItems: "center", flexShrink: 0,
                        }}>
                          <UserIcon size={16} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
                          {u.name || u.email.split("@")[0]}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>{u.email}</div>
                      <div style={{ textAlign: "center", fontWeight: 600, fontSize: 14 }}>{u.meetingCount}</div>
                      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>{u.simulationCount}</div>
                      <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                        {formatDate(u.lastMeetingDate ?? "")}
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>
                        <Chev size={14} />
                      </div>
                    </div>
                    {isExpanded && <UserMeetings uid={u.uid} />}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
