# Environment Setup

This project keeps Stripe secrets out of committed source files. Use real Stripe test values only in your local environment or ignored local `.env` files.

## Backend

Required local environment variables:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CURRENCY=eur
```

Optional timeout variables:

```env
STRIPE_CONNECT_TIMEOUT_MS=5000
STRIPE_READ_TIMEOUT_MS=15000
```

PowerShell example:

```powershell
cd D:\pfe\PFE-Project\UnTamed-backend
$env:STRIPE_SECRET_KEY="sk_test_xxx"
$env:STRIPE_WEBHOOK_SECRET="whsec_xxx"
$env:STRIPE_CURRENCY="eur"
.\mvnw.cmd spring-boot:run
```

The backend maps these values through `application.properties`:

```properties
stripe.secret-key=${STRIPE_SECRET_KEY:}
stripe.webhook-secret=${STRIPE_WEBHOOK_SECRET:}
stripe.currency=${STRIPE_CURRENCY:eur}
```

Startup logs print whether the Stripe secret and webhook secret are configured, but never print the secret values.

## Frontend

Create `UnTamed-frontend/.env` from `UnTamed-frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

Run Vite:

```powershell
cd D:\pfe\PFE-Project\UnTamed-frontend
npm run dev
```

Restart the Vite dev server after changing `.env`; Vite reads environment values at startup.

## Stripe Webhook

Run the Stripe CLI listener while testing local payments:

```powershell
stripe listen --forward-to localhost:8080/api/payments/stripe/webhook
```

Copy the `whsec_...` value printed by Stripe CLI into `STRIPE_WEBHOOK_SECRET`.

## Safety Rules

- Backend uses `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- Frontend uses only `VITE_STRIPE_PUBLISHABLE_KEY`.
- Never put `sk_test_...`, `sk_live_...`, or `whsec_...` in committed files.
- Rotate any Stripe secret that was pasted into chat, screenshots, commits, or shared logs.
