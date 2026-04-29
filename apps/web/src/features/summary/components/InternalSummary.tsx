import type { MeetingSummary } from "@scoach/types";
import { Alert, Trend } from "@scoach/ui/icons";

export function InternalSummary({ summary }: { summary: MeetingSummary }) {
  const s = summary.internal;
  return (
    <div className="sum-grid">
      <main className="sum-main">
        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">At a glance</h3>
            <span className="sum-meta mono">Confidence {Math.round(s.confidence * 100)}%</span>
          </div>
          <div className="glance-row">
            <div className="glance-tile">
              <div className="glance-label">Score</div>
              <div className="glance-val" style={{ color: "var(--gc-green)" }}>
                {s.score}
                <span>/100</span>
              </div>
              <div className="glance-foot">
                <Trend size={12} /> Above your average (78)
              </div>
            </div>
            <div className="glance-tile">
              <div className="glance-label">Deal health</div>
              <div className="glance-val" style={{ color: "var(--gc-yellow)" }}>
                {s.health[0]?.toUpperCase()}{s.health.slice(1)}
              </div>
              <div className="glance-foot">
                {s.topMoments[0] ? `${s.topMoments[0].type} at ${s.topMoments[0].t}` : "Buying signal at 22:34"}
              </div>
            </div>
            <div className="glance-tile">
              <div className="glance-label">Hints surfaced</div>
              <div className="glance-val">
                14<span> · 9 used</span>
              </div>
              <div className="glance-foot">64% acted-on rate</div>
            </div>
            <div className="glance-tile">
              <div className="glance-label">Sentiment arc</div>
              <div className="glance-val">
                <Trend size={20} /> +24
              </div>
              <div className="glance-foot">Started cool, ended engaged</div>
            </div>
          </div>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <span className="dot" style={{ background: "var(--gc-green)" }} /> What went well
            </h3>
          </div>
          <ul className="sum-list">
            {s.wentWell.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <span className="dot" style={{ background: "var(--gc-yellow)" }} /> Where to push deeper
            </h3>
          </div>
          <ul className="sum-list">
            {s.couldImprove.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">Stated vs. actual needs</h3>
          </div>
          <div className="needs-row">
            <div className="needs-col">
              <div className="needs-kicker">CLIENT STATED</div>
              {s.needs.stated.map((n, i) => (
                <div key={i} className="needs-item needs-stated">
                  {n}
                </div>
              ))}
            </div>
            <div className="needs-arrow">›</div>
            <div className="needs-col">
              <div className="needs-kicker" style={{ color: "var(--gc-blue)" }}>COACH INFERRED</div>
              {s.needs.actual.map((n, i) => (
                <div key={i} className="needs-item needs-actual">
                  {n}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">Action items</h3>
            <span className="sum-meta">{s.actionItems.length} items</span>
          </div>
          <ul className="action-list">
            {s.actionItems.map((a, i) => (
              <li key={a.id ?? i}>
                <input type="checkbox" defaultChecked={i === 0} />
                <div className="action-who">{a.who}</div>
                <div className="action-what">{a.what}</div>
                <div className="action-due mono">{a.due}</div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <aside className="sum-aside">
        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <Trend size={14} /> Upsell opportunities
            </h3>
          </div>
          {s.upsell.map((u, i) => (
            <div key={i} className="upsell-item">
              <div className="upsell-name">{u.name}</div>
              <div className="upsell-reason">{u.reason}</div>
            </div>
          ))}
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <Alert size={14} /> Risks
            </h3>
          </div>
          <ul className="risk-list">
            {s.risks.map((r, i) => (
              <li key={i}>
                <span className="risk-dot" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">Top moments</h3>
          </div>
          <ol className="moment-list">
            {s.topMoments.length === 0 && (
              <>
                <li><span className="mono">22:34</span><div><b>Buying signal</b> — "board is pushing for Q2"</div></li>
                <li><span className="mono">11:02</span><div><b>Cost reveal</b> — $38K/mo on Bedrock</div></li>
                <li><span className="mono">04:18</span><div><b>Latency pain</b> — 1.8–2.2s p95</div></li>
                <li><span className="mono">29:41</span><div><b>Versioning friction</b> — risk vs. research</div></li>
              </>
            )}
            {s.topMoments.map((m, i) => (
              <li key={i}>
                <span className="mono">{m.t}</span>
                <div>
                  <b>{m.type}</b> — {m.quote}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
