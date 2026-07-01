# CalcYourGPA (GradeCalculator)

A subscription web app for GPA tracking with hybrid AI syllabus parsing.

## Tech Stack

- **Backend**: C# / ASP.NET Core 8 (JWT auth, Google Sign-In)
- **Frontend**: Vanilla HTML/CSS/JS, chunky neobrutalist design system
- **Database**: MySQL (Railway) via Pomelo EF Core
- **Payments**: Stripe subscriptions (7-day free trial, monthly/yearly plans)
- **AI**: OpenAI gpt-4o-mini — LLM is a *fallback*; most syllabi parse deterministically at zero token cost

## Project Structure

```
GradeCalculator/
├── backend/GradeCalculator.API/
│   ├── Controllers/        # Auth, Classes, Categories, Grades, Semesters, Syllabus, GradeAdvisor, Payments
│   ├── Filters/            # RequireActiveSubscription (402 paywall gate)
│   ├── Models/             # Entities (User carries Stripe subscription state)
│   ├── Services/           # Business logic, SubscriptionService, DeterministicSyllabusParser
│   └── Configuration/      # JwtSettings, OpenAiSettings, StripeSettings
└── frontend/
    ├── css/                # chunky-theme.css re-skins the whole app to the landing design
    └── js/                 # pages/paywall.js + services/subscriptionService.js handle billing
```

## Required environment variables (Railway)

| Variable | Purpose |
|----------|---------|
| `MYSQL_URL` (or `ConnectionStrings__DefaultConnection`) | MySQL connection |
| `Jwt__Secret` | Long random string — **app refuses to boot in production without it** |
| `Google__ClientSecret` | Google OAuth |
| `OpenAi__ApiKey` | Syllabus-parser LLM fallback |
| `Stripe__SecretKey` | Stripe secret key (sk_...) |
| `Stripe__PublishableKey` | Stripe publishable key (pk_...) |
| `Stripe__WebhookSecret` | Webhook signing secret (whsec_...) |
| `Stripe__MonthlyPriceId` / `Stripe__YearlyPriceId` | Price IDs from your Stripe dashboard |
| `Stripe__FrontendUrl` | e.g. `https://calcyourgpa.com` (checkout redirects) |

Stripe setup: create a product with monthly ($4.99) and yearly ($29.99) prices, then add a
webhook endpoint pointing to `POST /api/payments/webhook` subscribed to
`checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`.

> **Database note:** the app uses `EnsureCreated()`, which does not migrate existing tables.
> The new `User` billing columns require a fresh database (or manual `ALTER TABLE`).

## Subscription model

Every new account gets a 7-day trial (no card). After that, all data endpoints return
**402 Payment Required** and the frontend routes to the paywall. Webhooks keep
`User.SubscriptionStatus` in sync; access persists until period end after cancellation.

## Syllabus parsing (hybrid, token-conscious)

1. **Deterministic pass** — regex extraction of categories (percent or points), grade scale,
   course name, credits. If weights reconcile to 100%, done: zero tokens.
2. **LLM fallback** — only the grading-relevant lines (max ~6k chars) are sent, strict JSON
   mode, temperature 0, 600-token cap, server-side validation that weights sum to 100,
   one retry with error feedback. Deterministic findings override LLM guesses.

## Local development

```bash
cd backend/GradeCalculator.API && dotnet run     # API on :5000
cd frontend && npx serve .                        # UI on :3000/:5500
```

`ASPNETCORE_ENVIRONMENT=Development` enables `/api/auth/dev-login`; a "Dev login" button
appears automatically when the frontend runs on localhost.

## API Endpoints

| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | /api/auth/google | Google ID-token login |
| GET | /api/payments/subscription | Access snapshot for the UI |
| POST | /api/payments/checkout | Start Stripe Checkout (`{plan: "monthly"\|"yearly"}`) |
| POST | /api/payments/portal | Stripe billing portal |
| POST | /api/payments/webhook | Stripe events (signature-verified) |
| CRUD | /api/classes, /api/categories, /api/grades, /api/semesters | Paywalled |
| POST | /api/syllabus/parse | Paywalled, hybrid parser |

## License

MIT
