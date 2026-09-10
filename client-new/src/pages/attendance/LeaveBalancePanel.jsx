import React from 'react';
import { overageOf, formatDays } from '../../utils/leaveBalance';

const TYPES = [
  { key: 'casual', label: 'Casual Leave' },
  { key: 'academic', label: 'Academic Leave' },
];

/**
 * The scholar's own leave balance for the current quota year — used/quota per
 * type, plus how far over quota they are when they've gone past it. Reuses
 * the same .attendance-summary-* cards the Monthly/Sessions tabs already
 * render with (see AttendancePage.css), so no new CSS is introduced here.
 */
const LeaveBalancePanel = ({ balance }) => {
  if (!balance) return null;

  return (
    <div className="attendance-summary-cards">
      {TYPES.map(({ key, label }) => {
        const forType = balance[key] || { quota: 0, used: 0, remaining: 0 };
        const over = overageOf(forType);
        return (
          <div className="attendance-summary-card" key={key}>
            <span className="attendance-summary-label">{label}</span>
            <span className="attendance-summary-value">
              {formatDays(forType.used)} / {formatDays(forType.quota)}
            </span>
            <span className={`badge ${over > 0 ? 'badge--danger' : 'badge--neutral'}`}>
              {over > 0
                ? `${formatDays(over)} over quota`
                : `${formatDays(forType.remaining)} remaining`}
            </span>
          </div>
        );
      })}
      {balance.window && (
        <p className="attendance-summary-caption">
          Quota year: {balance.window.start} to {balance.window.end}
        </p>
      )}
    </div>
  );
};

export default LeaveBalancePanel;
