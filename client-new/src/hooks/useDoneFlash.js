import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A short "done" moment for a button whose action finished in place, where
 * nothing else on screen changes to say it worked.
 *
 *   const [saved, flashSaved] = useDoneFlash();
 *   if (res.success) flashSaved();
 *   <CustomButton text="Save" done={saved} ... />
 *
 * Call it only on a confirmed success, never on a failure or a local-only
 * change, or the check becomes a false promise.
 */
const useDoneFlash = (ms = 1600) => {
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback(() => {
    clearTimeout(timer.current);
    setDone(true);
    timer.current = setTimeout(() => setDone(false), ms);
  }, [ms]);

  return [done, flash];
};

export default useDoneFlash;
