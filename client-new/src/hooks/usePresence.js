import { useEffect, useState } from 'react';

/**
 * Keeps something on screen for its exit animation after it is closed.
 * `mounted` says whether to render it, `closing` whether it is on its way out
 * (for the exit class, and to stop it taking clicks meanwhile).
 *
 * `exitMs` must match the CSS exit animation. Under reduced motion the
 * animation ends at once and the element sits invisible for the rest.
 */
const usePresence = (open, exitMs = 150) => {
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setShown(true);
      return undefined;
    }
    const timer = setTimeout(() => setShown(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted: open || shown, closing: !open && shown };
};

export default usePresence;
