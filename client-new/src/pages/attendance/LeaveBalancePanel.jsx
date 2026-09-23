import React from 'react';
import { overageOf, formatDays } from '../../utils/leaveBalance';
import AttendanceSummary from './AttendanceSummary';

const TYPES = [
  { key: 'casual', label: 'Casual leave' },
  { key: 'academic', label: 'Academic leave' },
];

/**
 * The scholar's own leave balance for the current quota year: used/quota per
 * type, plus how far over quota they are when they've gone past it, drawn
 * as the same summary panel as the attendance figures.
 */
const LeaveBalancePanel = ({ balance }) => {
  if (!balance) return null;

  return (
    <AttendanceSummary
      title="Leave balance"
      caption={balance.window ? `Quota year: ${balance.window.start} to ${balance.window.end}` : undefined}
      stats={TYPES.map(({ key, label }) => {
        const forType = balance[key] || { quota: 0, used: 0, remaining: 0 };
        const over = overageOf(forType);
        return {
          label,
          value: `${formatDays(forType.used)} / ${formatDays(forType.quota)}`,
          note: (
            <span className={`badge ${over > 0 ? 'badge--danger' : 'badge--neutral'}`}>
              {over > 0
                ? `${formatDays(over)} over quota`
                : `${formatDays(forType.remaining)} remaining`}
            </span>
          ),
        };
      })}
    />
  );
};

export default LeaveBalancePanel;
