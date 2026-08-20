// Styles. Import order matters — variables first, then the base sheet, then components and
// pages, then the theme layer that overrides them.
import './styles/variables.css';
import './styles/main.css';
import './styles/components/buttons.css';
import './styles/components/cards.css';
import './styles/components/modals.css';
import './styles/components/forms.css';
import './styles/components/grade-scale.css';
import './styles/components/grade-advisor.css';
import './styles/pages/landing.css';
import './styles/pages/class-setup.css';
import './styles/pages/class-detail.css';
import './styles/pages/category-editor.css';
import './styles/pages/semester.css';
import './styles/chunky-theme.css';
import './styles/app.css';

import { AuthService } from './services/auth.js';
import { SemesterService } from './services/dataServices.js';
import { Modal } from './components/modal.js';
import { GradeAdvisor } from './components/gradeAdvisor.js';
import { getAPlusValue, toggleAPlusValue } from './core/preferences.js';
import { navigate, registerRoutes, setNavigationHandler, getCurrentPage, refresh } from './router.js';

import { LandingPage } from './pages/landing.js';
import { ClassSetupPage } from './pages/classSetup.js';
import { ClassDetailPage } from './pages/classDetail.js';
import { CategoryEditorPage } from './pages/categoryEditor.js';
import { SemesterListPage } from './pages/semesterList.js';
import { SemesterHistoryPage } from './pages/semesterHistory.js';

/**
 * Application shell: boots Clerk, renders the header, and hands control to the router.
 */
const App = {
  async init() {
    Modal.init();

    registerRoutes({
      landing: LandingPage,
      classSetup: ClassSetupPage,
      class: ClassDetailPage,
      category: CategoryEditorPage,
      semesterList: SemesterListPage,
      semesterHistory: SemesterHistoryPage,
    });

    setNavigationHandler(() => this.updateChrome());

    // Clerk must finish loading before the first render, otherwise a returning user would see
    // the marketing page flash before their session resolves.
    await AuthService.init();

    // Re-render whenever the session changes, including a sign-out in another tab.
    AuthService.subscribe(() => this.onAuthChanged());

    this.renderHeader();

    navigate(AuthService.isAuthenticated() ? 'semesterList' : 'landing');

    document.body.classList.add('loaded');
  },

  onAuthChanged() {
    this.renderHeader();

    if (!AuthService.isAuthenticated()) {
      navigate('landing');
      return;
    }

    // Signing in from the marketing page should land on the app, not re-render the marketing.
    if (getCurrentPage() === 'landing' && !AuthService.isGuest()) navigate('semesterList');
    else refresh();
  },

  renderHeader() {
    const menu = document.getElementById('userMenu');
    if (!menu) return;

    const authenticated = AuthService.isAuthenticated();
    const isGuest = AuthService.isGuest();
    const aPlus = getAPlusValue();

    menu.innerHTML = `
      <button class="aplus-toggle" id="aplusToggle" title="Toggle the A+ value used for GPA"
              aria-label="A+ scale, currently ${aPlus === 4.33 ? '4.33' : '4.0'}">
        <span class="toggle-label">A+ scale</span>
        <span class="toggle-value">${aPlus === 4.33 ? '4.33' : '4.0'}</span>
      </button>
      ${authenticated ? `
        <button class="btn btn-secondary btn-sm" id="semestersBtn">Semesters</button>
        <button class="btn btn-secondary btn-sm" id="historyBtn">History</button>
        ${isGuest
          ? '<button class="btn btn-secondary btn-sm" id="exitGuestBtn">Exit guest</button>'
          : '<div id="clerkUserButton" class="clerk-user-button"></div>'}
      ` : ''}
    `;

    this.bindHeader();
    this.renderGuestBanner();

    // The advisor is signed-in only; init() removes the widget itself for guests.
    GradeAdvisor.init(SemesterService.getCurrentSemesterId());
  },

  bindHeader() {
    document.getElementById('aplusToggle')?.addEventListener('click', () => {
      toggleAPlusValue();
      this.renderHeader();
      refresh();
    });

    document.getElementById('semestersBtn')?.addEventListener('click', () => navigate('semesterList'));
    document.getElementById('historyBtn')?.addEventListener('click', () => navigate('semesterHistory'));

    document.getElementById('exitGuestBtn')?.addEventListener('click', async () => {
      await AuthService.signOut();
      navigate('landing');
    });

    // Clerk renders its own account menu (profile, sign out, session management).
    const userButton = document.getElementById('clerkUserButton');
    if (userButton) AuthService.mountUserButton(userButton);

    document.getElementById('logoContainer')?.addEventListener('click', () => {
      navigate(AuthService.isAuthenticated() ? 'semesterList' : 'landing');
    });
  },

  renderGuestBanner() {
    const host = document.getElementById('trialBannerHost');
    if (!host) return;

    // Guests need to know their data is device-local before they invest an evening in it.
    host.innerHTML = AuthService.isGuest()
      ? `<div class="trial-banner" style="background:var(--chunk-emerald);">
           <span>Guest mode — your data is saved in this browser only.</span>
         </div>`
      : '';
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.init().catch((error) => {
    console.error('Failed to start the app:', error);

    // A blank page with a console error is not an acceptable failure mode for users.
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state">
        <h3 class="empty-state-title">Something went wrong starting the app</h3>
        <p class="empty-state-text">Please refresh the page. If it keeps happening, clear your browser storage for this site.</p>
      </div>
    `;

    document.body.classList.add('loaded');
  });
});
