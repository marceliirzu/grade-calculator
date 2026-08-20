import { CONFIG } from '../config.js';
import { Storage, STORAGE_KEYS } from '../core/storage.js';

/**
 * Authentication.
 *
 * Clerk owns every credential. This module never sees a password, never stores a token, and
 * never persists a session — it asks Clerk for a short-lived JWT immediately before each
 * request. That is deliberate: Clerk session tokens expire in about a minute, so caching one in
 * localStorage would produce an app that works for sixty seconds and then 401s, and would hand
 * any XSS a reusable credential.
 *
 * Guest mode is the second, entirely separate path. A guest has no Clerk session at all; their
 * data lives in localStorage and is served by LocalBackend. The two never mix.
 */

let clerk = null;
let loadPromise = null;

const listeners = new Set();

/** Snapshot handed to subscribers so they do not have to re-query on every change. */
function currentState() {
  return {
    isSignedIn: Boolean(clerk?.user),
    isGuest: AuthService.isGuest(),
    user: AuthService.getUser(),
  };
}

function notify() {
  for (const listener of listeners) {
    try {
      listener(currentState());
    } catch (error) {
      // One bad subscriber must not stop the others from seeing the change.
      console.error('Auth listener failed:', error);
    }
  }
}

export const AuthService = {
  /**
   * Loads Clerk once. Safe to call repeatedly; concurrent callers share one load.
   * Resolves even when Clerk is unavailable so guest mode still works offline.
   */
  async init() {
    if (!CONFIG.AUTH_ENABLED) return null;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        // Dynamically imported so the Clerk SDK becomes its own chunk. It is roughly 3 MB
        // uncompressed and dominates the bundle; guest mode never touches it, and even for
        // signed-in users it should not block first paint of the marketing page.
        const { Clerk } = await import('@clerk/clerk-js');

        clerk = new Clerk(CONFIG.CLERK_PUBLISHABLE_KEY);
        await clerk.load({ afterSignOutUrl: window.location.origin });

        // Re-render the app whenever Clerk's session changes — including a sign-out that
        // happened in another tab.
        clerk.addListener(() => notify());

        return clerk;
      } catch (error) {
        console.error('Clerk failed to load; continuing in guest-only mode.', error);
        clerk = null;
        return null;
      }
    })();

    return loadPromise;
  },

  get isReady() {
    return clerk !== null;
  },

  isSignedIn() {
    return Boolean(clerk?.user);
  },

  isGuest() {
    return Storage.get(STORAGE_KEYS.GUEST_MODE, false) === true;
  },

  /** True when the app has data to show, by either route. */
  isAuthenticated() {
    return this.isSignedIn() || this.isGuest();
  },

  getUser() {
    if (this.isGuest()) return { id: 0, name: 'Guest', email: '', isGuest: true };
    if (!clerk?.user) return null;

    return {
      id: clerk.user.id,
      name: clerk.user.fullName ?? clerk.user.firstName ?? 'Student',
      email: clerk.user.primaryEmailAddress?.emailAddress ?? '',
      imageUrl: clerk.user.imageUrl ?? null,
      isGuest: false,
    };
  },

  /**
   * A fresh JWT for the current session, or null when there is none.
   *
   * Called before every API request rather than cached: Clerk refreshes the underlying token
   * continuously, and asking each time is what keeps a long-lived tab authenticated.
   */
  async getToken() {
    if (!clerk?.session) return null;

    try {
      return await clerk.session.getToken();
    } catch (error) {
      console.error('Could not obtain a session token:', error);
      return null;
    }
  },

  openSignIn(options = {}) {
    if (!clerk) {
      throw new Error('Sign-in is unavailable because Clerk is not configured.');
    }

    clerk.openSignIn(options);
  },

  openSignUp(options = {}) {
    if (!clerk) {
      throw new Error('Sign-up is unavailable because Clerk is not configured.');
    }

    clerk.openSignUp(options);
  },

  /** Renders Clerk's account widget into a container the app owns. */
  mountUserButton(element) {
    if (!clerk || !element) return;

    clerk.mountUserButton(element, {
      afterSignOutUrl: window.location.origin,
      showName: false,
    });
  },

  unmountUserButton(element) {
    if (!clerk || !element) return;

    try {
      clerk.unmountUserButton(element);
    } catch {
      // Already unmounted — nothing to undo.
    }
  },

  enterGuestMode() {
    Storage.set(STORAGE_KEYS.GUEST_MODE, true);
    notify();
  },

  exitGuestMode() {
    Storage.remove(STORAGE_KEYS.GUEST_MODE);
    notify();
  },

  async signOut() {
    if (this.isGuest()) {
      // The guest's classes (gc_guest_db) are intentionally kept, so returning to the site
      // still finds their work. Only the mode flag is cleared.
      this.exitGuestMode();
      return;
    }

    if (clerk) await clerk.signOut();
    notify();
  },

  /** Subscribe to auth changes. Returns an unsubscribe function. */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
