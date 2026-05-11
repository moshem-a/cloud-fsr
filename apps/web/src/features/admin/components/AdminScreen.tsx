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

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function UserMeetings({ uid }: { uid: string }) {
  const nav = useNavigate();
  const [meetings, setMeetings] = useState<AdminMeetingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.fetchUserMeetings(uid)
      .then(setMeetings)
      .catch((err) => {
        setError((err as Error).message);
        setMeetings([]);
      });
  }, [uid]);

  if (error) return <div style={{ padding: "12px 20px", color: "var(--gc-red)" }}>Error: {error}</div>;
  if (!meetings) return <div style={{ padding: "12px 20px", color: "var(--text-4)" }}>Loading…</div>;
  if (meetings.length === 0) return <div style={{ padding: "12px 20px", color: "var(--text-4)" }}>No meetings found.</div>;

  return (
    <div style={{ padding: "8px 16px 16px", background: "var(--surface-2)" }}>
      {meetings.map((m) => (
        <div
          key={m.id}
          onClick={() => nav({ to: "/meetings/$id/summary", params: { id: m.id } })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-3)", minWidth: 80 }}>
            {formatDate(m.createdAt)}
          </span>
          <span style={{ fontWeight: 600, minWidth: 100 }}>{m.client || "—"}</span>
          <span style={{ flex: 1, color: "var(--text-2)" }}>
            {m.title}
            {m.meetingType === "simulation" && (
              <span style={{
                marginLeft: 6, padding: "1px 5px", borderRadius: 4, fontSize: 10,
                fontWeight: 600, background: "#f3e8fd", color: "#7627bb",
              }}>SIM</span>
            )}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-3)", minWidth: 50 }}>{m.duration}</span>
          <span style={{ fontSize: 12, color: "var(--text-3)", minWidth: 70 }}>{m.status ?? "—"}</span>
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
  const [error, setError] = useState<string | null>(null);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  useEffect(() => {
    if (email !== "moshem@google.com") {
      nav({ to: "/dashboard" });
      return;
    }
    adminApi.fetchUsers()
      .then(setUsers)
      .catch((err) => {
        console.error("[admin] fetchUsers failed:", err);
        setError((err as Error).message);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [email, nav]);

  if (email !== "moshem@google.com") return null;

  const totalMeetings = users.reduce((s, u) => s + u.meetingCount, 0);
  const totalTime = users.reduce((s, u) => s + u.totalMinutes, 0);

  return (
    <div className="dash">
      <DashHeader onStartNew={() => nav({ to: "/dashboard" })} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 28px 60px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          Admin Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20 }}>
          All users and their system usage
        </p>

        {/* Stats bar */}
        {!loading && users.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {[
              { label: "Total users", value: users.length },
              { label: "Total meetings", value: totalMeetings },
              { label: "Total time", value: formatMinutes(totalTime) },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1,
                background: "var(--surface)",
                border: "1px solid var(--border-soft)",
                borderRadius: 10,
                padding: "14px 18px",
              }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-4)", marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{
            padding: "12px 16px", marginBottom: 16, borderRadius: 8,
            background: "#fce8e6", color: "#d93025", fontSize: 13,
          }}>
            Error loading users: {error}
          </div>
        )}

        <section style={{
          background: "var(--surface)", border: "1px solid var(--border-soft)",
          borderRadius: 12, boxShadow: "var(--sh-1)", overflow: "hidden",
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading users…</div>
          ) : users.length === 0 && !error ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>No users found.</div>
          ) : (
            <>
              {/* Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 90px 90px 90px 140px 30px",
                alignItems: "center",
                padding: "10px 16px",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                color: "var(--text-4)",
                fontWeight: 600,
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--border-soft)",
              }}>
                <div>User</div>
                <div>Email</div>
                <div style={{ textAlign: "center" }}>Meetings</div>
                <div style={{ textAlign: "center" }}>Sims</div>
                <div style={{ textAlign: "center" }}>Time</div>
                <div>Last Active</div>
                <div></div>
              </div>

              {/* Rows */}
              {users.map((u) => {
                const isExpanded = expandedUid === u.uid;
                return (
                  <div key={u.uid} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <div
                      onClick={() => setExpandedUid(isExpanded ? null : u.uid)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 90px 90px 90px 140px 30px",
                        alignItems: "center",
                        padding: "12px 16px",
                        cursor: "pointer",
                        background: isExpanded ? "var(--surface-2)" : "transparent",
                        transition: "background .15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: "#4285F4",
                          color: "white", fontWeight: 600, fontSize: 13,
                          display: "grid", placeItems: "center", flexShrink: 0,
                        }}>
                          {(u.name || u.email)?.[0]?.toUpperCase() || <UserIcon size={16} />}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
                          {u.name || u.email.split("@")[0]}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>{u.email}</div>
                      <div style={{ textAlign: "center", fontWeight: 600, fontSize: 15 }}>{u.meetingCount}</div>
                      <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>{u.simulationCount}</div>
                      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
                        {formatMinutes(u.totalMinutes)}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                        {formatDate(u.lastMeetingDate ?? "")}
                      </div>
                      <div style={{
                        display: "flex", justifyContent: "center",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                        transition: "transform .2s",
                      }}>
                        <Chev size={14} />
                      </div>
                    </div>
                    {isExpanded && <UserMeetings uid={u.uid} />}
                  </div>
                );
              })}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
