/**
 * Build-time configuration.
 *
 * Vite inlines `import.meta.env.VITE_*` at build time, so these are baked into the bundle.
 * That is fine for both values here — a Clerk *publishable* key and an API URL are public by
 * design. No secret may ever be referenced from this file; anything in the bundle is readable
 * by anyone who opens devtools.
 */

const env = import.meta.env ?? {};

/** Trims a trailing slash so callers can always concatenate `/path` safely. */
function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, '');
}

function resolveApiBaseUrl() {
  if (env.VITE_API_BASE_URL) return normalizeBaseUrl(env.VITE_API_BASE_URL);

  // In `npm run dev` the Vite proxy forwards /api to localhost:5000, so a relative base keeps
  // the browser on a single origin and exercises the same-origin path.
  if (env.DEV) return '/api';

  // A production build with no API URL configured is a deployment mistake, not a default to
  // paper over: guessing a host here would surface as an opaque CORS error at runtime.
  throw new Error(
    'VITE_API_BASE_URL is not set. Configure it in the build environment ' +
      '(see frontend/.env.example) before deploying.',
  );
}

export const CONFIG = {
  API_BASE_URL: resolveApiBaseUrl(),

  /** Clerk publishable key. Absent means auth is unavailable and only guest mode works. */
  CLERK_PUBLISHABLE_KEY: env.VITE_CLERK_PUBLISHABLE_KEY ?? '',

  get AUTH_ENABLED() {
    return Boolean(this.CLERK_PUBLISHABLE_KEY);
  },

  /** Default categories offered when a class is created by hand. */
  DEFAULT_CATEGORIES: [
    { name: 'Assignments', weight: 30 },
    { name: 'Quizzes', weight: 20 },
    { name: 'Exams', weight: 50 },
  ],

  RULE_TYPES: {
    DROP_LOWEST: 'DropLowest',
    COUNT_HIGHEST: 'CountHighest',
    WEIGHT_BY_SCORE: 'WeightByScore',
  },
};
