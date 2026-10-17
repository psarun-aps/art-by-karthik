# Cloudflare feature setup

The gallery is now backed by a Cloudflare Worker, D1, and a private R2 bucket. Uploads are made **from your laptop to R2**; they are not saved to the laptop running the website. The existing 40 gallery entries are included in the first D1 migration.

## Create resources

1. Install the dependencies and authenticate Wrangler:

   ```bash
   npm install
   npx wrangler login
   ```

2. Create the D1 database and R2 bucket:

   ```bash
   npx wrangler d1 create art-by-karthik
   npx wrangler r2 bucket create art-by-karthik-artworks
   ```

   Copy the D1 `database_id` into `wrangler.jsonc`. The all-zero ID in that file is a local-development placeholder, not a production database ID.

3. Apply the initial schema and gallery seed:

   ```bash
   npx wrangler d1 migrations apply art-by-karthik --remote
   ```

   For a local database, use `--local` instead. Do not apply the migration twice to the same database.

4. Create a Cloudflare Turnstile widget for the public website. Add its **site key** as `VITE_TURNSTILE_SITE_KEY` in the build environment (or a local `.env` file). Add the matching **secret key** to the Worker:

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

   Allow the live site's hostname in the Turnstile widget settings.

## Admin authentication

Create a Cloudflare Access self-hosted application for the site's hostname and protect both `/admin*` and `/api/admin*`. Its only allow policy should include `artistkarthik23@gmail.com` and `psarun27@gmail.com`. Use a one-time PIN or an identity provider with MFA. Restricting the site paths at Access prevents the admin page from being served to other visitors; the Worker also verifies the signed Access JWT, its audience, issuer, expiry, and email against the `ADMIN_EMAILS` allowlist before returning the page or accepting admin API requests.

`wrangler.jsonc` contains the Access team domain and application audience/tag. These are non-secret Worker settings and are included automatically on every `npm run deploy`; keep them set to the values for the same Access tenant and application. The Worker fails closed if either value is missing or left as a placeholder.

## Email delivery

Create a Resend account, verify `artbykarthik.com`, and configure the DNS records Resend provides. The default sender in `wrangler.jsonc` is `Art by Karthik <artwork@artbykarthik.com>`; use a verified sender address if Resend requires a different one.

Add the Resend API key as a Worker secret:

```bash
npx wrangler secret put RESEND_API_KEY
```

New comments are stored as pending, then emailed to `artistkarthik23@gmail.com`; only approved comments appear publicly. If delivery fails, the comment remains pending and the visitor sees an explicit notice. The contact form sends a private email and is not published on the site. Never put the Resend API key or Turnstile secret in a `VITE_` variable or frontend code.

## Deploy

Connect `artbykarthik.com` to the Cloudflare Worker as a custom domain, then deploy:

```bash
npm run deploy
```

The production site needs the D1 and R2 bindings and Access settings in `wrangler.jsonc`, the two Worker secrets, and `VITE_TURNSTILE_SITE_KEY` available when Vite builds the static assets. If the domain's DNS is not already on Cloudflare, follow Cloudflare's custom-domain setup first.

## Local development

Copy `.dev.vars.example` to `.dev.vars`, set local values, and create `.env` from `.env.example`. Apply the migration locally and start the Worker:

```bash
npx wrangler d1 migrations apply art-by-karthik --local
npm run dev:worker
```

The React dev server alone (`npm run dev`) does not run the Worker APIs. Local email delivery requires a valid Resend key; forms also require Turnstile test keys configured for the local hostname. Do not commit `.dev.vars` or `.env`.

Reactions use an anonymous browser-generated ID in local storage to let a visitor toggle one like and one heart per artwork. This is lightweight and does not require an account, but it is not a strong identity or anti-vote-manipulation system.
