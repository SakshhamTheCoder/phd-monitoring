import React, { useMemo, useState } from "react";
import { formatDate } from "../../utils/timeParse";
import "./ProgressChart.css";

// Cumulative progress against the date it was recorded, with the scholar's
// milestones marked on the same axis.
//
// Inline SVG rather than a charting library: this is one line, a handful of
// points and five reference marks, and the smallest library that draws it is
// larger than the whole of this file. There is no chart library in the app
// today and one chart is not a reason to start.
//
// One series, so no legend: the heading names it. That is the rule, not an
// omission.

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 32, left: 40 };

const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const GRID_LINES = [0, 25, 50, 75, 100];

const asTime = (date) => new Date(date).getTime();

const ProgressChart = ({ points = [], milestones = [] }) => {
  const [hovered, setHovered] = useState(null);

  const scale = useMemo(() => {
    if (!points.length) return null;

    const times = [
      ...points.map((point) => asTime(point.date)),
      ...milestones.map((milestone) => asTime(milestone.date)),
    ].filter((time) => Number.isFinite(time));

    const first = Math.min(...times);
    const last = Math.max(...times);
    // A single evaluation has no span to scale across, so give it one day and
    // it lands in the middle rather than dividing by zero.
    const span = last - first || 86400000;

    return {
      x: (date) => PADDING.left + ((asTime(date) - first) / span) * PLOT_WIDTH,
      y: (progress) => PADDING.top + (1 - Math.min(progress, 100) / 100) * PLOT_HEIGHT,
      first,
      last,
    };
  }, [points, milestones]);

  if (!points.length) {
    return (
      <p className="progress-chart-empty">
        No evaluations recorded yet. The chart appears once the first progress
        monitoring is approved.
      </p>
    );
  }

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scale.x(point.date)} ${scale.y(point.progress)}`)
    .join(" ");

  // Two milestones weeks apart would print their labels on top of each other.
  // The line is still drawn for every one of them, because it is the date that
  // matters; only the label is dropped, and only when there is no room for it.
  const MIN_LABEL_GAP = 60;
  let lastLabelAt = -Infinity;
  const placed = milestones
    .filter((milestone) => Number.isFinite(asTime(milestone.date)))
    .map((milestone) => {
      const at = scale.x(milestone.date);
      const showLabel = at - lastLabelAt >= MIN_LABEL_GAP;
      if (showLabel) lastLabelAt = at;
      return { ...milestone, at, showLabel };
    });

  return (
    <figure className="progress-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="progress-chart-svg"
        // A group, not an image: an image hides its children, and the points
        // below are focusable and named.
        role="group"
        aria-label={`Progress over time. ${points.length} evaluations, latest ${points[points.length - 1].progress} percent.`}
      >
        {/* Grid and axis, recessive: they locate the data, they are not the data. */}
        {GRID_LINES.map((value) => (
          <g key={value}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={scale.y(value)}
              y2={scale.y(value)}
              className="progress-chart-grid"
            />
            <text x={PADDING.left - 8} y={scale.y(value) + 4} className="progress-chart-tick" textAnchor="end">
              {value}
            </text>
          </g>
        ))}

        {placed.map((milestone) => (
          <g key={milestone.label}>
            <line
              x1={milestone.at}
              x2={milestone.at}
              y1={PADDING.top}
              y2={PADDING.top + PLOT_HEIGHT}
              className="progress-chart-milestone"
            >
              <title>{`${milestone.label}: ${formatDate(milestone.date)}`}</title>
            </line>
            {milestone.showLabel && (
              <text
                x={milestone.at}
                y={HEIGHT - 10}
                className="progress-chart-milestone-label"
                textAnchor="middle"
              >
                {milestone.label}
              </text>
            )}
          </g>
        ))}

        <path d={line} className="progress-chart-line" fill="none" />

        {points.map((point) => (
          <circle
            key={`${point.date}-${point.semester}`}
            cx={scale.x(point.date)}
            cy={scale.y(point.progress)}
            r={hovered === point ? 7 : 5}
            className="progress-chart-point"
            onMouseEnter={() => setHovered(point)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(point)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            role="img"
            aria-label={`${point.semester || formatDate(point.date)}: ${point.progress} percent`}
          />
        ))}
      </svg>

      <figcaption className="progress-chart-caption" aria-live="polite">
        {hovered ? (
          <>
            <strong>{hovered.progress}%</strong>
            {" after "}
            {hovered.semester || formatDate(hovered.date)}
            {hovered.semester ? ` (${formatDate(hovered.date)})` : ""}
          </>
        ) : (
          `${points.length} evaluation${points.length === 1 ? "" : "s"}, latest ${points[points.length - 1].progress}%. `
          + `Marked: ${placed.map((milestone) => `${milestone.label} ${formatDate(milestone.date)}`).join(", ") || "no milestones recorded"}.`
        )}
      </figcaption>
    </figure>
  );
};

export default ProgressChart;
