import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./OverviewDashboard.css";
import Page from "../page/Page";
import Panel from "../panel/Panel";
import { useAccess } from "../../context/CapabilitiesContext";
import { getRoleName } from "../../utils/roleName";
import { currentRole } from "../../auth/access";

const PALETTE = ["#B22626", "#2F6F8F", "#C98A1B", "#4C8C5A", "#7A5195", "#8A8F98", "#D0643F", "#3E7C9A"];

const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const fmt = (v) => (num(v) === null ? "-" : num(v).toLocaleString("en-IN"));
const pretty = (s) => String(s ?? "Not recorded").replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const storedName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user")) || {};
    return (u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "").trim();
  } catch {
    return "";
  }
};

const timeAgo = (iso) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const Empty = () => <p className="ov-empty">No data yet.</p>;

/** A small floating readout that follows whichever mark is hovered or focused. */
const useTip = () => {
  const [tip, setTip] = useState(null);
  const bind = (text) => ({
    onMouseEnter: () => setTip(text),
    onMouseLeave: () => setTip(null),
    onFocus: () => setTip(text),
    onBlur: () => setTip(null),
    tabIndex: 0,
    "aria-label": text,
  });
  return [tip, bind];
};

const BarList = ({ rows, label = (r) => r.label, color = PALETTE[0] }) => {
  const [tip, bind] = useTip();
  const data = arr(rows);
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((r) => r.count), 1);
  return (
    <div className="ov-bars">
      {data.map((r, i) => (
        <div className="ov-bar-row" key={`${r.label}-${i}`} {...bind(`${label(r)}: ${fmt(r.count)}`)}>
          <span className="ov-bar-label" title={label(r)}>{label(r)}</span>
          <span className="ov-bar-track">
            <span className="ov-bar-fill" style={{ width: `${(r.count / max) * 100}%`, background: color }} />
          </span>
          <span className="ov-bar-value">{fmt(r.count)}</span>
        </div>
      ))}
      <div className="ov-tip" aria-live="polite">{tip || " "}</div>
    </div>
  );
};

const Columns = ({ rows, color = PALETTE[0] }) => {
  const [tip, bind] = useTip();
  const data = arr(rows);
  if (!data.length) return <Empty />;
  const W = 360, H = 160, pad = 24;
  const max = Math.max(...data.map((r) => r.count), 1);
  const slot = (W - pad) / data.length;
  const bw = Math.min(34, slot * 0.6);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="ov-svg" role="img" aria-label="Column chart">
        <line x1={pad} y1={H} x2={W} y2={H} stroke="var(--border-subtle)" />
        {data.map((r, i) => {
          const h = (r.count / max) * (H - 24);
          const x = pad + i * slot + (slot - bw) / 2;
          return (
            <g key={`${r.label}-${i}`} className="ov-col" {...bind(`${r.label}: ${fmt(r.count)}`)}>
              <rect x={x} y={H - h} width={bw} height={Math.max(h, 1)} rx="3" fill={color} />
              <text x={x + bw / 2} y={H - h - 4} textAnchor="middle" className="ov-svg-val">{r.count}</text>
              <text x={x + bw / 2} y={H + 14} textAnchor="middle" className="ov-svg-lab">{r.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="ov-tip" aria-live="polite">{tip || " "}</div>
    </div>
  );
};

const Donut = ({ rows }) => {
  const [tip, bind] = useTip();
  const data = arr(rows).filter((r) => r.count > 0);
  const total = data.reduce((a, r) => a + r.count, 0);
  if (!total) return <Empty />;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="ov-donut">
      <svg viewBox="0 0 140 140" className="ov-donut-svg" role="img" aria-label="Donut chart">
        <g transform="rotate(-90 70 70)">
          {data.map((r, i) => {
            const len = (r.count / total) * C;
            const el = (
              <circle
                key={`${r.label}-${i}`}
                cx="70" cy="70" r={R} fill="none" strokeWidth="20"
                stroke={PALETTE[i % PALETTE.length]}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                className="ov-arc"
                {...bind(`${pretty(r.label)}: ${fmt(r.count)} (${Math.round((r.count / total) * 100)}%)`)}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="70" y="68" textAnchor="middle" className="ov-donut-total">{fmt(total)}</text>
        <text x="70" y="84" textAnchor="middle" className="ov-svg-lab">total</text>
      </svg>
      <div className="ov-donut-side">
        <ul className="ov-legend">
          {data.map((r, i) => (
            <li key={`${r.label}-${i}`}>
              <i style={{ background: PALETTE[i % PALETTE.length] }} />
              <span>{pretty(r.label)}</span>
              <b>{fmt(r.count)}</b>
            </li>
          ))}
        </ul>
        <div className="ov-tip" aria-live="polite">{tip || " "}</div>
      </div>
    </div>
  );
};

const Line = ({ rows }) => {
  const [tip, bind] = useTip();
  const data = arr(rows);
  if (!data.length) return <Empty />;
  const W = 360, H = 150, pad = 24;
  const max = Math.max(...data.map((r) => r.count), 1);
  const step = data.length > 1 ? (W - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((r, i) => [pad + (data.length > 1 ? i * step : (W - pad * 2) / 2), H - 12 - (r.count / max) * (H - 36)]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="ov-svg" role="img" aria-label="Line chart">
        <line x1={pad} y1={H - 12} x2={W - pad} y2={H - 12} stroke="var(--border-subtle)" />
        {pts.length > 1 && <path d={path} fill="none" stroke={PALETTE[0]} strokeWidth="2" />}
        {pts.map((p, i) => (
          <g key={`${data[i].label}-${i}`} className="ov-col" {...bind(`${data[i].label}: ${fmt(data[i].count)}`)}>
            <circle cx={p[0]} cy={p[1]} r="4.5" fill={PALETTE[0]} />
            <text x={p[0]} y={p[1] - 9} textAnchor="middle" className="ov-svg-val">{data[i].count}</text>
            <text x={p[0]} y={H + 8} textAnchor="middle" className="ov-svg-lab">{data[i].label}</text>
          </g>
        ))}
      </svg>
      <div className="ov-tip" aria-live="polite">{tip || " "}</div>
    </div>
  );
};

const Kpi = ({ icon, label, value, hint }) => (
  <div className="ov-kpi">
    <span className="ov-kpi-icon" aria-hidden="true"><i className={`fa fa-${icon}`} /></span>
    <div>
      <div className="ov-kpi-value">{value}</div>
      <div className="ov-kpi-label">{label}</div>
      {hint && <div className="ov-kpi-hint">{hint}</div>}
    </div>
  </div>
);

const OverviewDashboard = ({ data }) => {
  const { tiles } = useAccess();
  const d = data || {};
  const t = d.totals || {};
  const progress = d.progress || null;
  const role = d.role || currentRole() || "dordc";
  const name = d.name || storedName() || "there";
  const quick = arr(tiles);

  return (
    <Page
      title={`Welcome back, ${name}`}
      description={`Signed in as ${getRoleName(role)}. Here is where the programme stands today.`}
    >
      <div className="ov-kpis">
        <Kpi icon="graduation-cap" label="Scholars" value={fmt(t.scholars)} />
        <Kpi icon="user" label="Faculty" value={fmt(t.faculty)} hint={t.supervisors != null ? `${fmt(t.supervisors)} supervising` : null} />
        <Kpi icon="building" label="Departments" value={fmt(t.departments)} />
        <Kpi icon="folder-open" label="Projects" value={fmt(t.projects)} />
        <Kpi icon="flask" label="URF applications" value={fmt(t.urf_applications)} />
        <Kpi icon="hourglass-half" label="Forms in progress" value={fmt(t.forms_pending)} />
        <Kpi icon="line-chart" label="Average progress" value={progress?.average != null ? `${progress.average}%` : "-"} />
        <Kpi icon="book" label="Publications" value={fmt(t.publications)} />
      </div>

      <div className="ov-grid">
        <Panel title="Scholars by department"><BarList rows={d.scholars_by_department} label={(r) => r.code || r.label} /></Panel>
        <Panel title="Scholars by status"><Donut rows={d.scholars_by_status} /></Panel>
        <Panel title="Scholars by admission year"><Columns rows={d.scholars_by_admission_year} /></Panel>
        <Panel title="Qualification at admission"><Donut rows={d.scholars_by_qualification} /></Panel>
        <Panel title="Progress distribution" description={progress?.average != null ? `Average ${progress.average}% across scholars` : undefined}>
          <Columns rows={progress?.buckets} color={PALETTE[1]} />
        </Panel>
        <Panel title="Forms waiting, by step"><BarList rows={arr(d.forms_pending_by_stage).map((r) => ({ ...r, label: pretty(r.label) }))} color={PALETTE[2]} /></Panel>
        <Panel title="URF applications"><Donut rows={d.urf_by_status} /></Panel>
        <Panel title="Projects by status"><Donut rows={d.projects_by_status} /></Panel>
        <Panel title="Publications per year"><Line rows={d.publications_by_year} /></Panel>
        <Panel title="Recent activity" description="Latest form movement" flush>
          {arr(d.recent_activity).length ? (
            <table className="ov-table">
              <thead><tr><th>Scholar</th><th>Form</th><th>Waiting on</th><th>Updated</th></tr></thead>
              <tbody>
                {arr(d.recent_activity).map((a) => (
                  <tr key={a.id}>
                    <td>{a.student || a.roll_no}</td>
                    <td>{pretty(a.form)}</td>
                    <td><span className="ov-chip">{pretty(a.stage)}</span></td>
                    <td>{timeAgo(a.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="ov-pad"><Empty /></div>}
        </Panel>
      </div>

      {quick.length > 0 && (
        <Panel title="Quick access">
          <ul className="adminhome-tiles">
            {quick.map((q) => (
              <li key={q.path}>
                <Link to={q.path} className="adminhome-tile">
                  <span className="adminhome-tile-icon" aria-hidden="true"><i className={`fa fa-${q.icon}`} /></span>
                  <span className="adminhome-tile-label">{q.label}</span>
                  <i className="fa fa-angle-right adminhome-tile-go" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </Page>
  );
};

export default OverviewDashboard;
