import { CLOUDFLARE_SITE_KEY } from '../../api/urls';

// Only the login, signup and forgot password pages show the captcha, so the
// script is fetched when one of them first needs it instead of on every route.
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const loadScript = () => {
  if (window.turnstile || document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const script = document.createElement('script');
  script.src = SCRIPT_SRC;
  script.async = true;
  document.head.appendChild(script);
};

/**
 * Renders the widget into #turnstile-container once the script has arrived,
 * polling until then. Returns the cleanup for the calling effect.
 */
export const mountTurnstile = (onToken) => {
  loadScript();
  let widgetId = null;
  // Each retry schedules a new timer, so cleanup must clear the latest one or
  // a script that never loads keeps the poll running after unmount.
  let timer = null;

  const renderWidget = () => {
    if (!window.turnstile) {
      timer = setTimeout(renderWidget, 100);
      return;
    }
    const container = document.getElementById('turnstile-container');
    if (container && !container.hasChildNodes()) {
      try {
        widgetId = window.turnstile.render('#turnstile-container', {
          sitekey: CLOUDFLARE_SITE_KEY,
          theme: 'light',
          callback: onToken,
          // A token expires after a few minutes; submitting it fails server-side.
          'expired-callback': () => onToken(null),
        });
      } catch (error) {
        console.error('Turnstile render error:', error);
      }
    }
  };

  timer = setTimeout(renderWidget, 100);

  return () => {
    clearTimeout(timer);
    if (widgetId !== null && window.turnstile) {
      try {
        window.turnstile.remove(widgetId);
      } catch (error) {
        console.error('Turnstile cleanup error:', error);
      }
    }
  };
};
