// A deploy writes the routes as freshly hashed chunk files and removes the
// ones it replaced. A tab that was open before it still holds the old index,
// so the first route it loads asks for a file that is no longer there and the
// page fails with "Failed to fetch dynamically imported module". The route
// itself is fine; the tab is holding yesterday's filenames. Loading the page
// again picks up the new ones, which is why refreshing by hand fixes it.
//
// One reload per distinct failure. A chunk that fails again after the reload
// is genuinely missing, and then the error belongs on screen rather than in a
// tab that reloads on every click.
const TRIED_KEY = 'stale-chunk-reload';

const installStaleChunkReload = () => {
  window.addEventListener('vite:preloadError', (event) => {
    const failure = String(event.payload?.message ?? event.payload ?? '');
    if (sessionStorage.getItem(TRIED_KEY) === failure) return;

    sessionStorage.setItem(TRIED_KEY, failure);
    // Vite re-throws what it dispatched unless the event is cancelled.
    event.preventDefault();
    window.location.reload();
  });
};

export default installStaleChunkReload;
