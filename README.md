# CalcYourGPA

GPA and grade calculator for college students. Paste a syllabus, it reads the grading
breakdown, and it tracks every class, category and assignment with a live GPA.

| Piece | Stack | Hosted on |
|---|---|---|
| Frontend | Vite + vanilla ES modules | GitHub Pages |
| Backend | ASP.NET Core 8 (LTS) + EF Core | Railway |
| Database | MySQL 8 | Railway |
| Auth | Clerk | — |

---

## The one thing to read first

The grading rules live in **[`shared/GRADING_SPEC.md`](shared/GRADING_SPEC.md)**, and they are
implemented **twice**:

| Implementation | Location | Serves |
|---|---|---|
| C# | `backend/GradeCalculator.API/Grading/` | Signed-in users |
| JavaScript | `frontend/src/core/grading/` | Guest mode (no account, browser-only) |

Two implementations exist because guest mode has no server to call. They are kept honest by
**[`shared/grade-vectors.json`](shared/grade-vectors.json)** — a set of golden test vectors that
*both* test suites run against. Neither suite copies the file; both read it from `shared/`.

**If you change grading behaviour, change all four together:** the spec, the vectors, the C#
engine, and the JS engine. A change to one alone will fail CI, which is the point.

```bash
cd backend  && dotnet test        # 32 tests
cd frontend && npm test           # 66 tests
```

---

## Running locally

**Start here:**

```bash
cd frontend && npm install && npm run doctor
```

The preflight checks your toolchain, the database, the backend config and the frontend config,
and prints the exact fix for anything missing. It exits non-zero only on genuinely blocking
problems — missing Clerk or LLM keys are reported as warnings, because the app runs without
them in guest mode.

`npm run doctor:deploy` adds the production checklist.

Prerequisites: .NET 8 SDK (or 9, which builds net8.0 fine), Node 20+, MySQL 8.

**1. Database.** Create an empty database; migrations build the schema on first run.

```sql
CREATE DATABASE gradecalculator CHARACTER SET utf8mb4;
```

**2. Backend config.** Create `backend/GradeCalculator.API/appsettings.Development.json`
(gitignored — it holds a real password):

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Port=3306;Database=gradecalculator;Uid=root;Pwd=YOUR_PASSWORD;"
  },
  "Clerk": { "Authority": "", "AuthorizedParties": [] },
  "Cors": { "AllowedOrigins": ["http://localhost:5173"] },
  "Llm": { "ApiKey": "" }
}
```

Leaving `Clerk.Authority` empty is fine in development: the API then rejects every token, and
you work in guest mode, which needs no auth at all. Leaving `Llm.ApiKey` empty disables the AI
fallback; the deterministic syllabus parser still works.

**3. Frontend config.** Create `frontend/.env.local` (see `.env.example`):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

`VITE_API_BASE_URL` can be omitted locally — the Vite dev server proxies `/api` to port 5000.

**4. Run.** `start.bat`, or by hand:

```bash
cd backend/GradeCalculator.API && dotnet run     # http://localhost:5000
cd frontend && npm install && npm run dev        # http://localhost:5173
```

---

## Keys you need to supply

Nothing secret is committed. `appsettings.json` ships `SET_*` placeholders, and the API
**refuses to start in production** if `Clerk__Authority` is still unset — a deliberate fail-fast,
because an API nobody can authenticate against should not accept traffic.

### Clerk

1. Create an application at [clerk.com](https://clerk.com).
2. **API Keys** gives you two values:
   - *Publishable key* (`pk_live_...`) — public, goes in the frontend build.
   - *Frontend API URL* (e.g. `https://clerk.yourdomain.com`) — this is the JWT **issuer**.

The backend never needs your Clerk *secret* key. It validates tokens against Clerk's public
JWKS, discovered from the authority URL, so signing keys rotate with no deploy.

### Railway (backend service variables)

| Variable | Value | Required |
|---|---|---|
| `Clerk__Authority` | Your Clerk Frontend API URL | **yes** |
| `Clerk__AuthorizedParties__0` | `https://calcyourgpa.com` (your site origin) | strongly recommended |
| `Cors__AllowedOrigins__0` | `https://calcyourgpa.com` | **yes** |
| `MYSQL_URL` *or* `ConnectionStrings__DefaultConnection` | From the attached MySQL plugin | **yes** |
| `Llm__ApiKey` | Anthropic key (`sk-ant-...`) | optional |
| `Llm__DailyTokenLimitPerUser` | Defaults to 40000 | optional |

`AuthorizedParties` is not optional in spirit: Clerk session tokens carry no `aud` claim, so the
`azp` check is what stops a token minted for another site on the same Clerk instance being
replayed against this API. Leaving it empty disables that check.

**Railway build setting:** set the service's **Root Directory** to
`backend/GradeCalculator.API` so it picks up the Dockerfile.

### GitHub Pages (repository *variables*, not secrets)

Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-app.up.railway.app/api` |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `VITE_BASE` | `/` for a custom domain, `/<repo-name>/` for a `github.io` project site |
| `CUSTOM_DOMAIN` | `calcyourgpa.com` (optional; writes the CNAME file) |

These are variables rather than secrets on purpose. Both are inlined into the public bundle and
readable by anyone with devtools; marking them secret would redact them from build logs while
changing nothing about their exposure, and would falsely imply the site keeps them private.

---

## How the AI stays cheap

The model is **Claude Sonnet 5** (`claude-sonnet-5`) via the official Anthropic SDK. Sonnet
rather than Opus because syllabus extraction is a mechanical task, not a reasoning one, and the
request runs at `effort: low` with adaptive thinking — Claude spends more only on a genuinely
messy syllabus.

Output is constrained by a **JSON Schema** (`output_config.format`), so a malformed shape cannot
come back at all. Note that `temperature` is not sent: sampling parameters were removed on
Sonnet 5 and are rejected with a 400. Determinism comes from the schema instead.

There is **one shared flow** in the UI — no "smart vs AI" choice. The app escalates on the
user's behalf, cheapest first, and reports which path produced the result:

1. **Deterministic regex pass** — zero tokens. When the weights it finds reconcile to 100%, no
   model is involved at all. This handles most real syllabi, because a grading table is
   structured data.
2. **Shared parse cache** — zero tokens, keyed by a SHA-256 of the *normalised* text. Students in
   one course upload the same document; the second one through is free. Only the extracted
   structure is stored, never the syllabus itself.
3. **Claude on a trimmed excerpt** — the grading-relevant lines only, hard-capped at
   `Llm:MaxInputChars`, schema-constrained, with one corrective retry.
4. **Partial deterministic output** — so a failed parse still gives something to correct.

The grade advisor makes exactly **one** call per question. It computes the student's grades
server-side with the same engine that renders the UI, packs them into a compact snapshot, and
sends that — instead of giving a model tools and letting it loop.

Every tier is measured. `LlmUsage` records tokens spent *and* tokens avoided, so
`GET /api/account/llm-quota` reports real numbers rather than estimates, and the daily per-user
cap is enforced against the provider's own usage figures.

---

## Layout

```
backend/
  GradeCalculator.API/
    Grading/         pure grading engine — no EF, no ASP.NET, no I/O
    Auth/            Clerk token handling and lazy user provisioning
    Services/        read paths, syllabus parsing, LLM client, usage metering
    Data/Migrations/ EF migrations (schema is versioned, not auto-created)
  GradeCalculator.Tests/
frontend/
  src/core/grading/  the browser engine — peer of the C# one
  src/services/      API client, Clerk auth, guest-mode backend
  src/pages/         one module per screen
  tests/
shared/
  GRADING_SPEC.md    normative grading rules
  grade-vectors.json golden vectors, read by both test suites
```
