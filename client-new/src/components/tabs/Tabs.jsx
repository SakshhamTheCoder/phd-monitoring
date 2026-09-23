import React, { useLayoutEffect, useRef, useState } from 'react';

// The one tab bar. Styles live in styles/ui.css.
//
// items accepts either a plain string, when the value and the label are the
// same, or { value, label } when they differ or the value is an index.
//
//   <Tabs items={['All', 'Applied']} value={tab} onChange={setTab} />
//   <Tabs items={[{ value: 0, label: 'Action Required' }]} value={i} onChange={setI} />
// One tab stop for the bar; the arrow keys move between tabs, as a tab list
// is expected to behave.
const Tabs = ({ items, value, onChange, className = '', label }) => {
  const options = items.map((item) => (typeof item === 'object' ? item : { value: item, label: item }));
  const barRef = useRef(null);
  // One underline that slides to the chosen tab, so the eye follows the move.
  // null until measured; it only starts to animate after its first placement,
  // or it would slide in from the left edge on every page load.
  const [underline, setUnderline] = useState(null);
  const activeIndex = options.findIndex((option) => option.value === value);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    const place = () => {
      const tab = bar.querySelectorAll('[role="tab"]')[activeIndex];
      setUnderline((previous) => (tab
        ? { left: tab.offsetLeft, width: tab.offsetWidth, placed: previous !== null }
        : null));
    };
    place();
    // Labels change width when the web font arrives or the window resizes.
    const observer = new ResizeObserver(place);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [activeIndex, options.length]);

  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const current = options.findIndex((option) => option.value === value);
    const next = options[(current + step + options.length) % options.length];
    onChange(next.value);
    // The re-render moves tabIndex; focus follows the selection.
    const buttons = event.currentTarget.querySelectorAll('[role="tab"]');
    buttons[options.indexOf(next)]?.focus();
  };

  return (
    <div ref={barRef} className={`tabs ${className}`.trim()} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
      {underline && (
        <span
          className={`tabs-underline${underline.placed ? ' tabs-underline--moves' : ''}`}
          style={{ transform: `translateX(${underline.left}px) scaleX(${underline.width})` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default Tabs;
