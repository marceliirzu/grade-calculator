import { Storage, STORAGE_KEYS } from './storage.js';

/**
 * User preferences that are device-local rather than account-scoped.
 *
 * The A+ value (4.0 or 4.33) is stored per browser rather than per class. That is a
 * simplification the original UI already made — one toggle in the header applies everywhere —
 * and it is preserved here so the interface behaves identically.
 *
 * Note the asymmetry it creates: the *server* stores `aPlusGpaValue` per class, because two
 * schools can disagree, and the engine reads it from the class scale. This preference is what
 * the header toggle writes into that per-class scale when it changes.
 */

const VALID_APLUS_VALUES = [4.0, 4.33];

export function getAPlusValue() {
  const stored = Number(Storage.get(STORAGE_KEYS.APLUS_VALUE, 4.0));

  // Anything unrecognised falls back rather than propagating a bad multiplier into every GPA.
  return VALID_APLUS_VALUES.includes(stored) ? stored : 4.0;
}

export function setAPlusValue(value) {
  const next = VALID_APLUS_VALUES.includes(Number(value)) ? Number(value) : 4.0;
  Storage.set(STORAGE_KEYS.APLUS_VALUE, next);

  return next;
}

export function toggleAPlusValue() {
  return setAPlusValue(getAPlusValue() === 4.0 ? 4.33 : 4.0);
}
