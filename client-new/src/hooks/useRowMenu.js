import { useEffect, useRef, useState } from 'react';
import usePresence from './usePresence';

// Space the menu needs below its trigger before it opens upward instead.
const ROOM_BELOW = 220;

/**
 * The open row-actions menu of a table, one at a time.
 *
 * The menu is fixed to the viewport at its trigger rather than absolute inside
 * the row, because the table card scrolls sideways and would clip it. Being
 * fixed, it would drift from its row on scroll, so scrolling closes it, as do
 * an outside click and Escape.
 */
export const useRowMenu = () => {
  const [openMenu, setOpenMenu] = useState(null);
  const [menuStyle, setMenuStyle] = useState(null);

  useEffect(() => {
    if (openMenu === null) return undefined;
    const close = () => setOpenMenu(null);
    const onKey = (event) => event.key === 'Escape' && close();
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);

  const toggleMenu = (key, event) => {
    event.stopPropagation();
    if (openMenu === key) {
      setOpenMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    // It grows from the corner at its trigger, whichever way it opens.
    setMenuStyle(window.innerHeight - rect.bottom < ROOM_BELOW
      ? { right, bottom: window.innerHeight - rect.top + 4, transformOrigin: 'bottom right' }
      : { right, top: rect.bottom + 4, transformOrigin: 'top right' });
    setOpenMenu(key);
  };

  // `shownMenu` is the menu to draw: the open one, or the one just closed
  // while it fades out (`menuClosing`).
  const lastOpen = useRef(null);
  if (openMenu !== null) lastOpen.current = openMenu;
  const { mounted, closing: menuClosing } = usePresence(openMenu !== null, 100);
  const shownMenu = mounted ? (openMenu ?? lastOpen.current) : null;

  return { openMenu, shownMenu, menuClosing, menuStyle, toggleMenu, closeMenu: () => setOpenMenu(null) };
};
