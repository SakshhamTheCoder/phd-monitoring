import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { customFetch } from '../api/base';
import { baseURL } from '../api/urls';

/**
 * The scholar whose record is open, when a page is being read on someone
 * else's behalf: /students/102203689/forms/... rather than /forms/...
 *
 * Returns null on a page about your own record, so a caller can render the
 * "you are reading someone else's" line only where it is true.
 */
const useScholarInPath = () => {
  const { pathname } = useLocation();
  const rollNo = pathname.match(/^\/students\/(\d+)\b/)?.[1] ?? null;
  const [name, setName] = useState(null);

  useEffect(() => {
    if (!rollNo) {
      setName(null);
      return;
    }

    let cancelled = false;
    // Quietly: a missing name leaves the roll number on its own, which still
    // says whose record this is.
    customFetch(`${baseURL}/students/${rollNo}`, 'GET', {}, false)
      .then((response) => {
        if (cancelled) return;
        setName(response.success ? response.response?.profile?.name ?? null : null);
      });

    return () => { cancelled = true; };
  }, [rollNo]);

  if (!rollNo) return null;

  return {
    rollNo,
    name,
    label: name ? `${name} (${rollNo})` : rollNo,
  };
};

export default useScholarInPath;
