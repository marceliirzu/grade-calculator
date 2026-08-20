// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The rotating status shown while the server parses a syllabus.
 *
 * Two things are worth guarding. The rotation itself, because a frozen spinner is what people
 * abandon — and the teardown, because an interval that outlives the dialog ticks against
 * detached nodes for the rest of the session.
 */

vi.mock('@clerk/clerk-js', () => ({ Clerk: vi.fn(() => ({ load: vi.fn() })) }));

const { Modal } = await import('../src/components/modal.js');

const INTERVAL = 6000;
const FADE = 220;

/** Advances past one rotation, including the nested fade timeout. */
function advanceOneRotation() {
  vi.advanceTimersByTime(INTERVAL);
  vi.advanceTimersByTime(FADE);
}

const currentMessage = () => document.getElementById('syllabusProgress')?.textContent?.trim();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.invalid/api');

  document.body.innerHTML = '<div id="modalContainer"></div>';
  Modal.init();

  // The loading panel replaces the dialog body, so a host must already exist.
  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-backdrop"><div class="modal"><div id="syllabusModalBody"></div>' +
    '<div class="modal-footer"></div></div></div>';
});

afterEach(() => {
  Modal.hide();
  vi.useRealTimers();
});

describe('syllabus progress messages', () => {
  it('shows the first message immediately', () => {
    Modal._renderServerAttempt();

    expect(currentMessage()).toBe('Reading your syllabus...');
  });

  it('does not change before the interval elapses', () => {
    Modal._renderServerAttempt();

    vi.advanceTimersByTime(INTERVAL - 100);

    // A request that finishes quickly should never show a second message at all.
    expect(currentMessage()).toBe('Reading your syllabus...');
  });

  it('advances to the next message after six seconds', () => {
    Modal._renderServerAttempt();

    advanceOneRotation();

    expect(currentMessage()).toBe('This one needs a closer look — asking AI...');
  });

  it('keeps advancing through the sequence', () => {
    Modal._renderServerAttempt();

    const seen = [currentMessage()];

    for (let i = 0; i < 3; i += 1) {
      advanceOneRotation();
      seen.push(currentMessage());
    }

    expect(new Set(seen).size, 'each rotation should show a distinct message').toBe(seen.length);
  });

  it('holds on the last message instead of looping', () => {
    Modal._renderServerAttempt();

    // Well past the end of the list.
    for (let i = 0; i < 12; i += 1) advanceOneRotation();

    const last = Modal._progressMessages[Modal._progressMessages.length - 1];

    // Looping back to "Reading your syllabus..." would imply the work restarted.
    expect(currentMessage()).toBe(last);
  });

  it('stops the timer when the dialog is hidden', () => {
    Modal._renderServerAttempt();
    expect(Modal._progressTimer).not.toBeNull();

    Modal.hide();

    expect(Modal._progressTimer, 'interval leaked past hide()').toBeNull();
    expect(vi.getTimerCount(), 'no timers should survive the dialog').toBe(0);
  });

  it('stops itself if the panel disappears without hide()', () => {
    Modal._renderServerAttempt();

    // Simulate the body being replaced by something else mid-request.
    document.getElementById('modalContainer').innerHTML = '';

    advanceOneRotation();

    expect(Modal._progressTimer, 'timer should self-cancel when its target is gone').toBeNull();
  });

  it('does not start a second timer if rendered twice', () => {
    Modal._renderServerAttempt();
    const first = Modal._progressTimer;

    Modal._renderServerAttempt();

    expect(Modal._progressTimer).not.toBe(first);
    expect(vi.getTimerCount(), 'the previous interval should have been cleared').toBe(1);
  });
});
