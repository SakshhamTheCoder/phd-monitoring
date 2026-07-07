export const parseDateTime= (isoString)=> {
    const date = new Date(isoString);

    // Format the date and time
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false, // Set to true for 12-hour format
    };

    return date.toLocaleString('en-US', options);
}

// Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago",
// falling back to a short date for anything older than a week.
export function timeAgo(isoString) {
    if (!isoString) return "";
    const then = new Date(isoString).getTime();
    if (Number.isNaN(then)) return "";
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 45) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

// utils/dateFormatter.js
export function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}
