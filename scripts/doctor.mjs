#!/usr/bin/env node
/**
 * Preflight check for CalcYourGPA.
 *
 * Every check either passes, or prints the exact command / file / value that fixes it. The
 * point is that a misconfiguration fails here, loudly and with a remedy, instead of surfacing
 * later as a blank page or an opaque CORS error.
 *
 *   node scripts/doctor.mjs            # local development
 *   node scripts/doctor.mjs --deploy   # also check what production needs
 *
 * Exit code 0 = ready to run. 1 = something blocking. Warnings never fail the run.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEPLOY = process.argv.includes('--deploy');

const C = {
  reset: '[0m', red: '[31m', green: '[32m',
  yellow: '[33m', dim: '[2m', bold: '[1m',
};

let failures = 0;
let warnings = 0;

const pass = (msg) => console.log(`  ${C.green}✓${C.reset} ${msg}`);

const fail = (msg, ...fix) => {
  failures += 1;
  console.log(`  ${C.red}✗${C.reset} ${msg}`);
  for (const line of fix) console.log(`      ${C.dim}${line}${C.reset}`);
};

const warn = (msg, ...fix) => {
  warnings += 1;
  console.log(`  ${C.yellow}!${C.reset} ${msg}`);
  for (const line of fix) console.log(`      ${C.dim}${line}${C.reset}`);
};

const section = (title) => console.log(`\n${C.bold}${title}${C.reset}`);

const read = (path) => {
  try {
    return readFileSync(join(ROOT, path), 'utf8');
  } catch {
    return null;
  }
};

/** Opens a TCP socket, so "is MySQL up" does not require a MySQL client to be installed. */
function canConnect(host, port, timeout = 2500) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;

    // Resolve only once the handle is fully closed. Resolving from inside the 'connect'
    // callback and then exiting races libuv's teardown, which trips an assertion on Windows.
    const done = (result) => {
      if (settled) return;
      settled = true;
      socket.once('close', () => resolve(result));
      socket.destroy();
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function httpStatus(url, timeout = 2500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    return response.status;
  } catch {
    return null;
  }
}

function commandVersion(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

console.log(`${C.bold}CalcYourGPA preflight${C.reset}`);

// ---- Toolchain -------------------------------------------------------------

section('Toolchain');

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 20) pass(`Node ${process.versions.node}`);
else fail(`Node ${process.versions.node} is too old (need 20+)`, 'Install Node 20 LTS or newer: https://nodejs.org');

const dotnet = commandVersion('dotnet', ['--version']);
if (!dotnet) {
  fail('The .NET SDK was not found on PATH', 'Install the .NET 8 SDK: https://dotnet.microsoft.com/download');
} else {
  const major = Number(dotnet.split('.')[0]);
  // SDK 9/10 build net8.0 projects fine; only an older SDK is a hard blocker.
  if (major >= 8) pass(`.NET SDK ${dotnet}`);
  else fail(`.NET SDK ${dotnet} is too old (need 8+)`, 'Install the .NET 8 SDK: https://dotnet.microsoft.com/download');
}

// ---- Repository integrity --------------------------------------------------

section('Grading contract');

const spec = read('shared/GRADING_SPEC.md');
const vectorsRaw = read('shared/grade-vectors.json');

if (!spec) fail('shared/GRADING_SPEC.md is missing', 'This file is the normative grading spec. Restore it from git.');
else pass('shared/GRADING_SPEC.md present');

if (!vectorsRaw) {
  fail('shared/grade-vectors.json is missing', 'Both test suites read this file. Restore it from git; tests cannot run without it.');
} else {
  try {
    const vectors = JSON.parse(vectorsRaw);
    const total = vectors.classCases.length + vectors.gpaCases.length + vectors.targetCases.length;

    pass(`shared/grade-vectors.json v${vectors.version} — ${total} vectors`);
  } catch (error) {
    fail('shared/grade-vectors.json is not valid JSON', String(error.message));
  }
}

// ---- Backend ---------------------------------------------------------------

section('Backend');

const devSettingsPath = 'backend/GradeCalculator.API/appsettings.Development.json';
const devSettingsRaw = read(devSettingsPath);

let connectionString = null;

if (!devSettingsRaw) {
  fail(`${devSettingsPath} is missing`,
    'The backend needs a local MySQL connection string to start.',
    'Create it (it is gitignored) with at least:',
    '{ "ConnectionStrings": { "DefaultConnection":',
    '  "Server=localhost;Port=3306;Database=gradecalculator;Uid=root;Pwd=YOUR_PASSWORD;" } }');
} else {
  try {
    const devSettings = JSON.parse(devSettingsRaw);
    connectionString = devSettings.ConnectionStrings?.DefaultConnection ?? '';

    if (!connectionString || connectionString.includes('SET_') || connectionString.includes('YOUR_PASSWORD')) {
      fail(`${devSettingsPath} still has a placeholder connection string`,
        'Replace Pwd=YOUR_PASSWORD with your real local MySQL password.');
    } else {
      pass('appsettings.Development.json has a real connection string');
    }

    const clerkAuthority = devSettings.Clerk?.Authority ?? '';
    if (clerkAuthority) pass(`Clerk authority set for local dev (${clerkAuthority})`);
    else warn('Clerk is not configured locally — sign-in is disabled, guest mode still works',
      'That is fine for local work. To test real sign-in, set Clerk.Authority here',
      'and VITE_CLERK_PUBLISHABLE_KEY in frontend/.env.local.');

    const llmKey = devSettings.Llm?.ApiKey ?? '';
    if (llmKey) pass('LLM key present — AI syllabus fallback and advisor enabled');
    else warn('No LLM key locally — the deterministic syllabus parser still works',
      'Set Llm.ApiKey in appsettings.Development.json to enable the AI fallback.');
  } catch (error) {
    fail(`${devSettingsPath} is not valid JSON`, String(error.message));
  }
}

// MySQL reachability, parsed out of whatever connection string was configured.
if (connectionString) {
  const host = /Server=([^;]+)/i.exec(connectionString)?.[1] ?? 'localhost';
  const port = Number(/Port=(\d+)/i.exec(connectionString)?.[1] ?? 3306);
  const database = /Database=([^;]+)/i.exec(connectionString)?.[1] ?? 'gradecalculator';

  if (await canConnect(host, port)) {
    pass(`MySQL reachable at ${host}:${port}`);
    console.log(`      ${C.dim}Database "${database}" is created by migrations on first run.${C.reset}`);
  } else {
    fail(`Cannot reach MySQL at ${host}:${port}`,
      'Start the MySQL service, then create the database once:',
      `  CREATE DATABASE ${database} CHARACTER SET utf8mb4;`,
      'The schema itself is applied automatically by EF migrations at startup.');
  }
}

const health = await httpStatus('http://localhost:5000/health');

if (health === 200) {
  pass('API is running on http://localhost:5000');

  const ready = await httpStatus('http://localhost:5000/health/ready');
  if (ready === 200) pass('API readiness probe passes (database connected)');
  else fail('API is up but not ready — the database check is failing',
    'Check the API console output for the migration or connection error.');

  // Endpoints must reject anonymous callers. A 200 here would mean the app is wide open.
  const anon = await httpStatus('http://localhost:5000/api/classes');
  if (anon === 401) pass('API rejects unauthenticated requests (401)');
  else fail(`API returned ${anon} for an unauthenticated request — expected 401`,
    'Authentication is not being enforced. Do not deploy in this state.');
} else {
  warn('API is not running on port 5000',
    'Start it with:  cd backend/GradeCalculator.API && dotnet run',
    'or run start.bat to launch both halves.');
}

// ---- Frontend --------------------------------------------------------------

section('Frontend');

if (existsSync(join(ROOT, 'frontend/node_modules'))) pass('frontend dependencies installed');
else fail('frontend/node_modules is missing', 'Run:  cd frontend && npm install');

// A leftover from the pre-Vite build. Editing it has no effect, which is confusing enough to
// be worth calling out explicitly.
if (existsSync(join(ROOT, 'frontend/env.js'))) {
  warn('frontend/env.js still exists but is no longer used',
    'Configuration moved to frontend/.env.local (see frontend/.env.example).',
    'Delete frontend/env.js so nobody edits it expecting an effect.');
}

const envLocal = read('frontend/.env.local');

if (!envLocal) {
  warn('frontend/.env.local does not exist',
    'Not required for local guest-mode work — the Vite dev server proxies /api to port 5000.',
    'Create it only to test Clerk sign-in:',
    '  VITE_CLERK_PUBLISHABLE_KEY=pk_test_...');
} else {
  const key = /^VITE_CLERK_PUBLISHABLE_KEY=(.*)$/m.exec(envLocal)?.[1]?.trim() ?? '';

  if (!key) {
    warn('frontend/.env.local has no VITE_CLERK_PUBLISHABLE_KEY', 'Sign-in will be hidden; guest mode still works.');
  } else if (!/^pk_(test|live)_/.test(key)) {
    fail('VITE_CLERK_PUBLISHABLE_KEY does not look like a Clerk publishable key',
      'It must start with pk_test_ or pk_live_.',
      'If it starts with sk_, that is the SECRET key — never put it in the frontend.');
  } else {
    pass(`Clerk publishable key present (${key.slice(0, 8)}...)`);
  }

  if (/sk_(test|live)_/.test(envLocal)) {
    fail('frontend/.env.local contains what looks like a Clerk SECRET key',
      'Everything VITE_* is inlined into the public bundle and readable by anyone.',
      'Remove it and rotate that key in the Clerk dashboard immediately.');
  }
}

// ---- Deployment ------------------------------------------------------------

if (DEPLOY) {
  section('Deployment (manual verification)');

  console.log(`  ${C.dim}These cannot be checked from here — confirm each in the dashboards.${C.reset}\n`);

  const checklist = [
    ['Railway', 'Service → Settings → Build → Root Directory = backend/GradeCalculator.API'],
    ['Railway', 'Variable Clerk__Authority = your Clerk Frontend API URL (required; API refuses to boot without it)'],
    ['Railway', 'Variable Clerk__AuthorizedParties__0 = https://your-site-domain'],
    ['Railway', 'Variable Cors__AllowedOrigins__0 = https://your-site-domain'],
    ['Railway', 'MySQL plugin attached (supplies MYSQL_URL) or ConnectionStrings__DefaultConnection set'],
    ['Railway', 'Optional: Llm__ApiKey for AI syllabus parsing and the grade advisor'],
    ['GitHub', 'Actions → Variables → VITE_API_BASE_URL = https://<app>.up.railway.app/api  (note the /api suffix)'],
    ['GitHub', 'Actions → Variables → VITE_CLERK_PUBLISHABLE_KEY = pk_live_...'],
    ['GitHub', 'Actions → Variables → VITE_BASE = "/" for a custom domain, "/<repo>/" for a project site'],
    ['GitHub', 'Settings → Pages → Source = GitHub Actions'],
    ['Clerk', 'Add your production domain to the allowed origins'],
  ];

  for (const [where, what] of checklist) {
    console.log(`  ${C.dim}[ ]${C.reset} ${C.bold}${where}${C.reset}  ${what}`);
  }

  console.log(`\n  ${C.yellow}!${C.reset} The two GitHub VITE_* values are repository ${C.bold}Variables${C.reset}, not Secrets.`);
  console.log(`      ${C.dim}Both are public by design and are inlined into the bundle. Marking them${C.reset}`);
  console.log(`      ${C.dim}secret only redacts build logs while changing nothing about exposure.${C.reset}`);
}

// ---- Summary ---------------------------------------------------------------

console.log(`\n${'─'.repeat(60)}`);

if (failures > 0) {
  console.log(`${C.red}${C.bold}${failures} blocking issue${failures === 1 ? '' : 's'}${C.reset}` +
    (warnings > 0 ? `, ${warnings} warning${warnings === 1 ? '' : 's'}` : '') +
    '. Fix the ✗ items above.');

  // exitCode rather than exit(): lets pending handles close cleanly first.
  process.exitCode = 1;
}

else {
  console.log(`${C.green}${C.bold}Ready to run.${C.reset}` +
    (warnings > 0 ? ` ${warnings} warning${warnings === 1 ? '' : 's'} — optional features only.` : ''));
}

if (!DEPLOY) console.log(`${C.dim}Run with --deploy for the production checklist.${C.reset}`);
