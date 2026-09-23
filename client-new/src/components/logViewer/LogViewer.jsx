import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './LogViewer.css';

const POLL_MS = 5000;
const SCROLL_BUFFER = 100;
// Lines held at once, about three of the server's 64 KB chunks. Left open, the
// poll and scroll-back grew the list, and the page, for as long as it stayed up.
const MAX_LINES = 3000;
const encoder = new TextEncoder();

const parseLine = (line) => {
  const match = line.match(/^\[(.*?)\]\s+(.*?)\.(.*?):\s+(.*)$/);
  if (!match) return { raw: line };

  const [, timestamp, , level, messageRaw] = match;
  const jsonStart = messageRaw.indexOf('{');
  if (jsonStart === -1) return { timestamp, level, message: messageRaw };

  try {
    return {
      timestamp,
      level,
      message: messageRaw.substring(0, jsonStart).trim(),
      json: JSON.stringify(JSON.parse(messageRaw.substring(jsonStart)), null, 2),
    };
  } catch (e) {
    return { timestamp, level, message: messageRaw };
  }
};

// Parsed once on arrival rather than on every render. Each line is keyed by its
// byte offset in the file, which stays put however the list is added to.
const toEntries = (text, start) => {
  const entries = [];
  let offset = start;
  for (const line of text.split('\n')) {
    if (line.trim() !== '') entries.push({ offset, ...parseLine(line) });
    offset += encoder.encode(line).length + 1;
  }
  return entries;
};

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  // The same list, readable from the poll, which only ever sees the first render.
  const held = useRef([]);
  const [loading, setLoading] = useState(true);
  const [atStart, setAtStart] = useState(false);
  // No logs after a failed read says nothing about the file, so it is not
  // reported as empty.
  const [failed, setFailed] = useState(false);

  // Byte offsets of the window we hold. Refs, not state: the poll below is set
  // up once and would otherwise keep reading the first render's values, which
  // is how every poll ended up asking for offset 0 again.
  const from = useRef(null);
  const to = useRef(null);
  const isFetching = useRef(false);
  const failing = useRef(false);
  const pinnedToBottom = useRef(true);
  const containerRef = useRef(null);

  const fetchLogs = useCallback(async (direction) => {
    const show = (next) => {
      held.current = next;
      setLogs(next);
    };

    if (isFetching.current) return;
    if (direction === 'backward' && (from.current === null || from.current <= 0)) return;
    isFetching.current = true;

    const container = containerRef.current;

    const offset = direction === 'backward' ? from.current : to.current;
    const query = direction === 'tail' ? 'direction=tail' : `direction=${direction}&offset=${offset}`;

    try {
      // Toast the first failure only. The poll retries every few seconds, and
      // an outage would otherwise stack up one toast per poll.
      const { success, response } = await customFetch(
        `${baseURL}/admin/logs?${query}`, 'GET', {}, !failing.current,
      );
      failing.current = !success;
      setFailed(!success);
      if (!success || !response) return;

      // A rotated or truncated file leaves our offsets past the end.
      if (to.current !== null && response.size < to.current) {
        from.current = null;
        to.current = null;
        isFetching.current = false;
        fetchLogs('tail');
        return;
      }

      const entries = toEntries(response.logs || '', response.from);

      if (direction === 'backward') {
        from.current = response.from;
        if (response.from <= 0) setAtStart(true);
        if (entries.length) {
          // Held in place by the row that was on top, not by the list height:
          // over the cap the newest rows go too, which changes the height.
          const anchor = container && container.querySelector('.log-line, .log-entry');
          const anchorTop = anchor ? anchor.getBoundingClientRect().top : 0;
          const merged = [...entries, ...held.current];
          // Dropping the newest rows means the poll has to read them again.
          if (merged.length > MAX_LINES) to.current = merged[MAX_LINES].offset;
          show(merged.slice(0, MAX_LINES));
          requestAnimationFrame(() => {
            if (!container || !anchor) return;
            container.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
          });
        }
        return;
      }

      if (direction === 'tail') {
        const kept = entries.slice(-MAX_LINES);
        from.current = kept.length < entries.length ? kept[0].offset : response.from;
        setAtStart(from.current <= 0);
        show(kept);
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight;
        });
      } else if (entries.length) {
        const merged = [...held.current, ...entries];
        const kept = merged.slice(-MAX_LINES);
        if (kept.length < merged.length) {
          // Scrolling back has to fetch the dropped rows again.
          from.current = kept[0].offset;
          setAtStart(false);
        }
        show(kept);
        if (pinnedToBottom.current) {
          requestAnimationFrame(() => {
            if (container) container.scrollTop = container.scrollHeight;
          });
        }
      }
      to.current = response.to;
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, []);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    pinnedToBottom.current =
      container.scrollHeight - container.scrollTop - container.clientHeight <= SCROLL_BUFFER;

    if (container.scrollTop <= SCROLL_BUFFER) fetchLogs('backward');
  };

  useEffect(() => {
    fetchLogs('tail');

    // Only ever asks for bytes appended since the last read, and only while the
    // tab is visible and the reader is still at the bottom.
    const interval = setInterval(() => {
      if (document.hidden || !pinnedToBottom.current || to.current === null) return;
      fetchLogs('forward');
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <div className="log-terminal" ref={containerRef} onScroll={handleScroll}>
      {loading && <div className="log-empty">Loading the most recent entries...</div>}
      {!loading && !failed && logs.length === 0 && <div className="log-empty">The log file is empty.</div>}
      {atStart && logs.length > 0 && <div className="log-boundary">Start of log file</div>}

      {logs.map((entry) => {
        if (entry.raw !== undefined) {
          return <div key={entry.offset} className="log-line">{entry.raw}</div>;
        }
        return (
          <div key={entry.offset} className="log-entry">
            <div className="log-meta">
              <span className="log-time">{entry.timestamp}</span>
              <span className={`log-level log-${entry.level.toLowerCase()}`}>{entry.level}</span>
            </div>
            <div className="log-message">{entry.message}</div>
            {entry.json && <pre className="log-json">{entry.json}</pre>}
          </div>
        );
      })}
    </div>
  );
};

export default LogViewer;
