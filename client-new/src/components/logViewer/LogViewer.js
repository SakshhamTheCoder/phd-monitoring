import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './LogViewer.css';

const POLL_MS = 5000;
const SCROLL_BUFFER = 100;

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
      json: JSON.parse(messageRaw.substring(jsonStart)),
    };
  } catch (e) {
    return { timestamp, level, message: messageRaw };
  }
};

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [atStart, setAtStart] = useState(false);

  // Byte offsets of the window we hold. Refs, not state: the poll below is set
  // up once and would otherwise keep reading the first render's values, which
  // is how every poll ended up asking for offset 0 again.
  const from = useRef(null);
  const to = useRef(null);
  const isFetching = useRef(false);
  const pinnedToBottom = useRef(true);
  const containerRef = useRef(null);

  const fetchLogs = useCallback(async (direction) => {
    if (isFetching.current) return;
    if (direction === 'backward' && (from.current === null || from.current <= 0)) return;
    isFetching.current = true;

    const container = containerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    const offset = direction === 'backward' ? from.current : to.current;
    const query = direction === 'tail' ? 'direction=tail' : `direction=${direction}&offset=${offset}`;

    try {
      const { success, response } = await customFetch(
        `${baseURL}/admin/logs?${query}`, 'GET', {}, false, false, false,
      );
      if (!success || !response) return;

      // A rotated or truncated file leaves our offsets past the end.
      if (to.current !== null && response.size < to.current) {
        from.current = null;
        to.current = null;
        isFetching.current = false;
        fetchLogs('tail');
        return;
      }

      const lines = (response.logs || '').split('\n').filter((line) => line.trim() !== '');

      if (direction === 'backward') {
        from.current = response.from;
        if (response.from <= 0) setAtStart(true);
        if (lines.length) {
          setLogs((prev) => [...lines, ...prev]);
          requestAnimationFrame(() => {
            if (!container) return;
            container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
          });
        }
        return;
      }

      if (direction === 'tail') {
        from.current = response.from;
        if (response.from <= 0) setAtStart(true);
        setLogs(lines);
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight;
        });
      } else if (lines.length) {
        setLogs((prev) => [...prev, ...lines]);
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
      {!loading && logs.length === 0 && <div className="log-empty">The log file is empty.</div>}
      {atStart && logs.length > 0 && <div className="log-boundary">Start of log file</div>}

      {logs.map((line, idx) => {
        const entry = parseLine(line);
        if (entry.raw !== undefined) {
          return <div key={idx} className="log-line">{entry.raw}</div>;
        }
        return (
          <div key={idx} className="log-entry">
            <div className="log-meta">
              <span className="log-time">{entry.timestamp}</span>
              <span className={`log-level log-${entry.level.toLowerCase()}`}>{entry.level}</span>
            </div>
            <div className="log-message">{entry.message}</div>
            {entry.json && <pre className="log-json">{JSON.stringify(entry.json, null, 2)}</pre>}
          </div>
        );
      })}
    </div>
  );
};

export default LogViewer;
