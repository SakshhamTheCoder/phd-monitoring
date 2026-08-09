import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import React, { useEffect, useRef, useState } from 'react';
import './LogViewer.css';

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [offsetTop, setOffsetTop] = useState(0);      // For backward fetch
  const [offsetBottom, setOffsetBottom] = useState(0); // For forward fetch
  const logSize = useRef(0);
  const logContainerRef = useRef(null);
  const isFetching = useRef(false);
  const pinnedToBottom = useRef(true);
  const scrollBuffer = 100;

  const fetchLogs = async (direction = 'forward') => {
    if (isFetching.current) return;
    isFetching.current = true;

    const isBackward = direction === 'backward';
    const offset = isBackward ? offsetTop : offsetBottom;

    try {
      const container = logContainerRef.current;
      const prevScrollHeight = container?.scrollHeight || 0;
      const prevScrollTop = container?.scrollTop || 0;

      const response = await customFetch(
        `${baseURL}/admin/logs?offset=${offset}&direction=${direction}`,
        'GET',
        null
      );
      const data = response.response;

      const newLines = data.logs.split('\n').filter(line => line.trim() !== '');
      if (newLines.length === 0) {
        isFetching.current = false;
        return;
      }

      logSize.current = data.size;
      if (isBackward) {
        setOffsetTop(data.offset); // update top backward offset
      } else {
        setOffsetBottom(data.offset); // update bottom forward offset
      }

      setLogs(prevLogs => {
        const combined = isBackward
          ? [...newLines, ...prevLogs]
          : [...prevLogs, ...newLines];
        return Array.from(new Set(combined));
      });

      if (isBackward && container) {
        // preserve scroll position after prepending
        setTimeout(() => {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        }, 0);
      } else if (!isBackward && container && pinnedToBottom.current) {
        // The newest line is the last one, so follow it unless the reader has
        // scrolled up to look at something.
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 0);
      }

    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      isFetching.current = false;
    }
  };

  const handleScroll = () => {
    const container = logContainerRef.current;
    if (!container) return;

    const nearTop = container.scrollTop <= scrollBuffer;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <= scrollBuffer;

    pinnedToBottom.current = nearBottom;

    if (nearTop) fetchLogs('backward');
    else if (nearBottom) fetchLogs('forward');
  };

  useEffect(() => {
    // Initial load: load bottom
    fetchLogs('forward');

    const interval = setInterval(() => {
      const container = logContainerRef.current;
      if (
        container &&
        container.scrollHeight - container.scrollTop - container.clientHeight <= scrollBuffer
      ) {
        fetchLogs('forward'); // auto-fetch only if user is near bottom
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="log-terminal" ref={logContainerRef} onScroll={handleScroll}>
      {logs.length === 0 && <div className="log-empty">Waiting for log output...</div>}
      {logs.map((line, idx) => {
        const logMatch = line.match(/^\[(.*?)\]\s+(.*?)\.(.*?):\s+(.*)$/);
        if (!logMatch) {
          return <div key={idx} className="log-line">{line}</div>;
        }

        const [, timestamp, env, level, messageRaw] = logMatch;
        let message = messageRaw;
        let jsonPayload = null;

        try {
          const jsonStart = messageRaw.indexOf('{');
          if (jsonStart !== -1) {
            jsonPayload = JSON.parse(messageRaw.substring(jsonStart));
            message = messageRaw.substring(0, jsonStart).trim();
          }
        } catch (e) {
          // ignore JSON parse error
        }

        return (
          <div key={idx} className="log-entry">
            <div className="log-meta">
              <span className="log-time">{timestamp}</span>
              <span className={`log-level log-${level.toLowerCase()}`}>[{level}]</span>
            </div>
            <div className="log-message">{message}</div>
            {jsonPayload && (
              <pre className="log-json">{JSON.stringify(jsonPayload, null, 2)}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LogViewer;
