// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards against re-rendering the page while someone is typing in it.
 *
 * The class-setup wizard used to call a full rerender() on every keystroke in a weight field,
 * and the grade editor re-fetched and rebuilt the whole page on every field blur. Both replace
 * the DOM node the user is interacting with, which reads as the page reloading under them,
 * drops focus so tabbing between fields stops working, and on mobile closes the keyboard.
 *
 * The assertion is deliberately structural rather than visual: hold a reference to a live input,
 * interact, and require that the *same* element is still on the page afterwards. Any return to
 * innerHTML-based re-rendering fails this, however it is written.
 */

vi.mock('@clerk/clerk-js', () => ({ Clerk: vi.fn(() => ({ load: vi.fn() })) }));

const { ClassSetupPage } = await import('../src/pages/classSetup.js');

function mountShell() {
  document.body.innerHTML = `
    <main id="mainContent"></main>
    <div id="modalContainer"></div>
  `;
}

/** Drives the wizard to the categories step, where the weight inputs live. */
function openCategoriesStep() {
  ClassSetupPage.init({});

  document.getElementById('className').value = 'Test Class';
  document.getElementById('creditHours').value = '3';
  document.getElementById('nextBtn').click();
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.invalid/api');
  localStorage.clear();
  mountShell();
});

describe('class setup: typing a weight', () => {
  it('does not replace the input being typed in', () => {
    openCategoriesStep();

    const input = document.querySelector('.category-weight[data-index="0"]');
    expect(input, 'weight input should exist on the categories step').not.toBeNull();

    input.value = '45';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // The exact same node must still be in the document. If the step re-rendered, the original
    // element is detached and this fails even though a lookalike exists at the same selector.
    expect(input.isConnected, 'the input was replaced — the page re-rendered while typing').toBe(true);
    expect(document.querySelector('.category-weight[data-index="0"]')).toBe(input);
  });

  it('still updates the running total live', () => {
    openCategoriesStep();

    const input = document.querySelector('.category-weight[data-index="0"]');
    const before = document.getElementById('weightTotalValue').textContent;

    input.value = '5';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const after = document.getElementById('weightTotalValue').textContent;

    expect(after, 'the total should react to typing').not.toBe(before);
  });

  it('enables Next exactly when the weights reach 100', () => {
    openCategoriesStep();

    const inputs = [...document.querySelectorAll('.category-weight')];

    // Defaults are 30/20/50. Break the total first.
    inputs[0].value = '10';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('nextBtn').disabled).toBe(true);

    // Restore it.
    inputs[0].value = '30';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('nextBtn').disabled).toBe(false);
  });

  it('keeps focus in the field across several keystrokes', () => {
    openCategoriesStep();

    const input = document.querySelector('.category-weight[data-index="0"]');
    input.focus();

    for (const value of ['3', '35', '350']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    expect(document.activeElement, 'focus left the field mid-typing').toBe(input);
  });

  it('does not disturb a sibling name field while a weight is edited', () => {
    openCategoriesStep();

    const name = document.querySelector('.category-name[data-index="1"]');
    name.value = 'Half-typed name';

    const weight = document.querySelector('.category-weight[data-index="0"]');
    weight.value = '31';
    weight.dispatchEvent(new Event('input', { bubbles: true }));

    // A re-render would rebuild this input from formData and discard the uncommitted text,
    // since the name is only read on blur.
    expect(name.isConnected).toBe(true);
    expect(name.value).toBe('Half-typed name');
  });
});
