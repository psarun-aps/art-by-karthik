<<<<<<< HEAD
# Art by Karthik — Phase 1

A minimalist, gallery-first React + TypeScript website for artbykarthik.com.

## Run locally

Install Node.js 20.19+ or 22.12+ (supported by Vite 6), then:

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (usually http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Included
- Gallery-first home page with responsive artwork cards
- Gallery filtering by category
- Individual artwork detail pages and next/previous navigation
- About page with editable draft biography
- Feedback form **UI only** (does not send/store messages)
- Six original **sample SVG placeholders**, not Karthik's actual drawings

## Edit sample content
- `src/data.ts` — artwork titles, categories, descriptions, and image paths
- `public/artworks/` — placeholder artwork images
- `src/main.tsx` — page copy and components
- `src/style.css` — visual design

## Deployment notes
This is a frontend-only phase. A Cloudflare Pages project can use build command `npm run build` and output directory `dist`. SPA route fallback must be configured for direct links; the default Pages SPA handling can work when no top-level `404.html` exists. Before going live, replace placeholder images and the draft biography.

## Upcoming phases
Phase 2: Cloudflare R2 + D1 + Pages Functions public gallery API.
Phase 3: Private admin subdomain protected by Cloudflare Access; CRUD and image uploads.
Phase 4: Moderated feedback with Turnstile.
Phase 5: DNS configuration for Squarespace-registered domain, deployment, backups and security review.

## Privacy
Do not publish Karthik's personal address, school, age, or direct contact details. Visitor messages should remain private until moderated.
=======
# art-by-karthik
Website to display Karthik's artwork
>>>>>>> 958f71fac5039383f616dabe39a915031c3e6d3d
