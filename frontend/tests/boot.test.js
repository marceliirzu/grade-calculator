// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Boots the real application shell in jsdom.
 *
 * This exists because a missing method on the App object — `setNavigationHandler` calling a
 * `this.updateChrome()` that was never defined — shipped to production and broke the site for
 * every visitor. Nothing caught it: the grading suites never import main.js, and checking the
 * built HTML with curl only proves the bundle was served, not that it runs.
 *
 * The assertion is deliberately blunt: does the app start, and does it render a real page
 * instead of the error fallback? Any TypeError from a missing method or bad wiring fails here.
 */

// Clerk is mocked so the test never touches the network. `load()` resolving with no user is
// the signed-out case, which is what a first-time visitor gets.
const clerkInstance = {
  user: null,
  session: null,
  load: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn(),
  openSignIn: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  mountUserButton: vi.fn(),
  unmountUserButton: vi.fn(),
};

vi.mock('@clerk/clerk-js', () => ({
  Clerk: vi.fn(() => clerkInstance),
}));

/** The markup index.html provides. The shell reads these ids, so they must be present. */
function mountShell() {
  document.body.innerHTML = `
    <div id="app">
      <header class="header">
        <div class="header-content">
          <div class="logo-container" id="logoContainer"></div>
          <div class="user-menu" id="userMenu"></div>
        </div>
      </header>
      <div id="trialBannerHost"></div>
      <main class="main-content" id="mainContent"></main>
      <div id="modalContainer"></div>
    </div>
  `;
}

/** Imports main.js fresh and fires the event it waits for, then lets promises settle. */
async function boot() {
  vi.resetModules();
  await import('../src/main.js');

  document.dispatchEvent(new Event('DOMContentLoaded'));

  // Two macrotask turns: init() awaits the dynamic Clerk import, then renders.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.invalid/api');
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_Y2xlcmsudGVzdC5pbnZhbGlkJA');

  localStorage.clear();
  mountShell();
});

describe('application boot', () => {
  it('starts without hitting the error fallback', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await boot();

    const failure = document.querySelector('.startup-error');

    // Surface the real reason in the assertion message rather than just "expected null".
    expect(failure?.textContent ?? null, `App.init() threw: ${failure?.textContent}`).toBeNull();
    expect(consoleError).not.toHaveBeenCalledWith('Failed to start the app:', expect.anything());

    consoleError.mockRestore();
  });

  it('renders the marketing page for a signed-out visitor', async () => {
    await boot();

    expect(document.querySelector('#lp'), 'landing page did not render').not.toBeNull();
    expect(document.body.textContent).toContain('Know your grade');
  });

  it('marks the body loaded so the page becomes visible', async () => {
    await boot();

    // body starts at opacity 0; without this class the app renders but stays invisible.
    expect(document.body.classList.contains('loaded')).toBe(true);
  });

  it('hides the app header on the signed-out marketing page', async () => {
    await boot();

    expect(document.querySelector('.header').classList.contains('hidden')).toBe(true);
  });

  it('shows the app header and guest banner once guest mode is entered', async () => {
    localStorage.setItem('gc_guest_mode', 'true');

    await boot();

    expect(document.querySelector('.header').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('trialBannerHost').textContent).toContain('Guest mode');
  });

  it('renders the A+ toggle in the header', async () => {
    await boot();

    expect(document.getElementById('aplusToggle'), 'A+ toggle missing').not.toBeNull();
  });
});
