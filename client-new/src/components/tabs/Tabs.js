import React from 'react';

// The one tab bar. Styles live in styles/ui.css.
//
// items accepts either a plain string, when the value and the label are the
// same, or { value, label } when they differ or the value is an index.
//
//   <Tabs items={['All', 'Applied']} value={tab} onChange={setTab} />
//   <Tabs items={[{ value: 0, label: 'Action Required' }]} value={i} onChange={setI} />
const Tabs = ({ items, value, onChange, className = '' }) => (
  <div className={`tabs ${className}`.trim()} role="tablist">
    {items.map((item) => {
      const option = typeof item === 'object' ? item : { value: item, label: item };
      const isActive = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          className={`tab ${isActive ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default Tabs;
