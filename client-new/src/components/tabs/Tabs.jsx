import React from 'react';

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
    <div className={`tabs ${className}`.trim()} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
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
    </div>
  );
};

export default Tabs;
