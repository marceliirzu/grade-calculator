/**
 * localStorage wrapper.
 *
 * Every method swallows failures and returns a neutral value. localStorage throws in more
 * situations than people expect — Safari private browsing, a full quota, cookies blocked — and
 * an unguarded write in a render path takes the whole page down. Losing a preference is
 * recoverable; a blank screen is not.
 */

export const STORAGE_KEYS = Object.freeze({
  APLUS_VALUE: 'gc_aplus_value',
  GUEST_MODE: 'gc_guest_mode',
  GUEST_DB: 'gc_guest_db',
  CURRENT_SEMESTER: 'gc_current_semester',
});

export const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      // Includes malformed JSON left by an older build, not just quota errors.
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
