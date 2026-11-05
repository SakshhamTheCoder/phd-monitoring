import React, { useMemo, useState } from "react";
import { formatDate } from "../../utils/timeParse";
import "./ProgressChart.css";

// Cumulative progress after each evaluation, with the scholar's key dates.
//
// The x axis is the evaluation, evenly spaced and named by its period, not the
// calendar. A calendar axis stretched to reach a thesis date years away, which
// squeezed the evaluations together and pushed a lone one to the edge. Key
// dates (IRB, synopsis, ...) are drawn on the axis only where they fall inside
// the evaluations, and always listed below with their dates.
//
// Inline SVG rather than a charting library; one series, so no legend.

const WIDTH = 720;
const HEIGHT = 280;
const PADDING = { top: 24, right: 32, bottom: 44, left: 52 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
const GRID_LINES = [0, 25, 50, 75, 100];

const asTime = (date) => new Date(date).getTime();
const round = (n) => Math.round(n * 10) / 10;
const clamp = (n) => Math.min(Math.max(n, 0), 100);
const periodOf = (p) => p.semester || formatDate(p.date);
const changeText = (p) =>
  p.start ? "Starting point" : `${p.delta >= 0 ? "+" : ""}${round(p.delta)} pts since previous`;

// Every scholar starts at zero, so the line begins there rather than at the
// first evaluation's value.
const START = { start: true, semester: "Start", date: null, progress: 0 };

// Where a calendar date falls along the evenly spaced evaluations, as a
// fractional index; null when it is outside the first and last evaluation.
const indexOfDate = (times, date) => {
  const t = asTime(date);
  if (!Number.isFinite(t) || t < times[0] || t > times[times.length - 1]) return null;
  for (let i = 0; i < times.length - 1; i++) {
    if (t <= times[i + 1]) {
      const span = times[i + 1] - times[i] || 1;
      return i + (t - times[i]) / span;
    }
  }
  return times.length - 1;
};

const KeyDates = ({ milestones }) =>
  milestones.length ? (
    <ul className="progress-chart-dates" aria-label="Key dates">
      {milestones.map((m) => (
        <li key={m.label}>
          <span className="progress-chart-dates-label">{m.label}</span>
          <span className="progress-chart-dates-value">{formatDate(m.date)}</span>
        </li>
      ))}
    </ul>
  ) : null;

const ProgressChart = ({ points = [], milestones = [] }) => {
  const [activeKey, setActiveKey] = useState(null);

  const geometry = useMemo(() => {
    if (!points.length) return null;
    const series = [START, ...points];
    const count = series.length;
    const x = (index) => PADDING.left + (index / (count - 1)) * PLOT_WIDTH;
    const y = (progress) => PADDING.top + (1 - clamp(progress) / 100) * PLOT_HEIGHT;

    const pts = series.map((p, i) => ({
      ...p,
      key: `${p.date}-${i}`,
      x: x(i),
      y: y(p.progress),
      delta: i === 0 ? null : p.progress - series[i - 1].progress,
    }));

    const times = points.map((p) => asTime(p.date));
    const marks = points.length < 2 ? [] : milestones
      .map((m) => ({ ...m, index: indexOfDate(times, m.date) === null ? null : indexOfDate(times, m.date) + 1 }))
      .filter((m) => m.index !== null)
      .map((m) => ({ ...m, at: x(m.index) }));

    // Name every evaluation when there is room, every other one when not.
    const step = count > 8 ? Math.ceil(count / 8) : 1;
    const labelled = pts.filter((_, i) => i % step === 0 || i === count - 1);
    // Never print the last label over the one before it.
    const labels = labelled.filter((p, i, arr) => i === arr.length - 1 || arr[arr.length - 1].x - p.x > 70 || i === 0);

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const baseY = PADDING.top + PLOT_HEIGHT;
    const area = `${line} L ${pts[count - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;
    return { points: pts, marks, labels, line, area, baseY };
  }, [points, milestones]);

  if (!points.length) {
    return (
      <p className="progress-chart-empty">
        No evaluations recorded yet. The chart appears once the first progress
        monitoring is approved.
      </p>
    );
  }

  const dated = milestones.filter((m) => Number.isFinite(asTime(m.date)));

  const active = geometry.points.find((p) => p.key === activeKey) || null;
  const latest = geometry.points[geometry.points.length - 1];
  const flip = active && active.x > WIDTH * 0.6;

  return (
    <figure className="progress-chart">
      <div className="progress-chart-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="progress-chart-svg"
          role="group"
          aria-label={`Progress over time. ${points.length} evaluations, latest ${latest.progress} percent.`}
        >
          <defs>
            <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B22626" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#B22626" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {GRID_LINES.map((value) => {
            const gy = PADDING.top + (1 - value / 100) * PLOT_HEIGHT;
            return (
              <g key={value}>
                <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={gy} y2={gy} className="progress-chart-grid" />
                <text x={PADDING.left - 10} y={gy + 4} className="progress-chart-tick" textAnchor="end">
                  {value}%
                </text>
              </g>
            );
          })}

          {geometry.marks.map((m) => (
            <g key={m.label}>
              <line x1={m.at} x2={m.at} y1={PADDING.top} y2={geometry.baseY} className="progress-chart-milestone" />
              <text x={m.at} y={PADDING.top - 8} className="progress-chart-milestone-label" textAnchor="middle">
                {m.label}
              </text>
            </g>
          ))}

          <path d={geometry.area} fill="url(#pc-fill)" className="progress-chart-area" />
          <path d={geometry.line} className="progress-chart-line" fill="none" />

          {geometry.labels.map((p) => (
            <text
              key={p.key}
              x={p.x}
              y={geometry.baseY + 22}
              className="progress-chart-tick"
              textAnchor={p.x <= PADDING.left + 4 ? "start" : p.x >= WIDTH - PADDING.right - 4 ? "end" : "middle"}
            >
              {periodOf(p)}
            </text>
          ))}

          {active && (
            <line x1={active.x} x2={active.x} y1={PADDING.top} y2={geometry.baseY} className="progress-chart-guide" />
          )}

          {geometry.points.map((p) => {
            const on = active?.key === p.key;
            const isLatest = p === latest;
            return (
              <g key={p.key}>
                {on && <circle cx={p.x} cy={p.y} r={10} className="progress-chart-halo" />}
                <circle cx={p.x} cy={p.y} r={on ? 6 : 4.5} className="progress-chart-point" />
                {isLatest && !on && (
                  <text
                    x={p.x}
                    y={p.y > PADDING.top + 20 ? p.y - 12 : p.y + 22}
                    className="progress-chart-latest"
                    textAnchor="end"
                  >
                    {round(p.progress)}%
                  </text>
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={16}
                  className="progress-chart-hit"
                  tabIndex={0}
                  role="img"
                  aria-label={`${periodOf(p)}: ${round(p.progress)} percent. ${changeText(p)}`}
                  onMouseEnter={() => setActiveKey(p.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(p.key)}
                  onBlur={() => setActiveKey(null)}
                />
              </g>
            );
          })}
        </svg>

        {active && (
          <div
            className={`progress-chart-tooltip${flip ? " is-flipped" : ""}`}
            style={{ left: `${(active.x / WIDTH) * 100}%`, top: `${(active.y / HEIGHT) * 100}%` }}
            role="presentation"
          >
            <div className="progress-chart-tooltip-title">{periodOf(active)}</div>
            <div className="progress-chart-tooltip-value">{round(active.progress)}%</div>
            {!active.start && <div className="progress-chart-tooltip-row">{formatDate(active.date)}</div>}
            <div className="progress-chart-tooltip-row">{changeText(active)}</div>
          </div>
        )}
      </div>

      <KeyDates milestones={dated} />
    </figure>
  );
};

export default ProgressChart;
