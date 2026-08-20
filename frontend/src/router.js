/**
 * Minimal view router.
 *
 * Deliberately not URL-based. The app was built as a single screen with in-memory navigation,
 * and GitHub Pages serves static files with no rewrite rules — so a real path-based router
 * would 404 on refresh for every route except the root. Kept as-is rather than shipping deep
 * links that break the moment someone reloads or shares one.
 *
 * Lives in its own module because every page navigates, and having pages import each other
 * directly would make the graph circular.
 */

const routes = new Map();

let currentPage = null;
let currentParams = {};
let onNavigate = null;

/** Registers the page modules. Called once from main.js. */
export function registerRoutes(pages) {
  for (const [name, page] of Object.entries(pages)) {
    routes.set(name, page);
  }
}

/** Called after every navigation so the shell can refresh chrome (header, widgets). */
export function setNavigationHandler(handler) {
  onNavigate = handler;
}

export function getCurrentPage() {
  return currentPage;
}

export function getCurrentParams() {
  return { ...currentParams };
}

export function navigate(page, params = {}) {
  const target = routes.has(page) ? page : 'landing';

  currentPage = target;
  currentParams = params;

  const view = routes.get(target);

  if (!view) {
    console.error(`No view registered for '${page}'.`);
    return;
  }

  // Pages may be async; a rejection must not leave the user staring at a stale screen with no
  // explanation, so it is surfaced rather than swallowed.
  Promise.resolve(view.init(params)).catch((error) => {
    console.error(`Failed to render '${target}':`, error);
  });

  onNavigate?.(target, params);
}

/** Re-runs the current view, e.g. after the A+ scale toggle changes. */
export function refresh() {
  if (currentPage) navigate(currentPage, currentParams);
}
