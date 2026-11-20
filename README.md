# ORBIT & ORIGIN

**OPEN TO CURIOSITY. COMMITTED TO EVIDENCE.**

An independent international science and astronomy publication.

## Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL, Auth and Storage
- Resend (planned for the newsletter delivery phase)

## Local development

Requirements: Node.js 20.9+ and npm.

1. Clone the repository and install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and configure the public Supabase project URL and anon key.

3. Apply migrations in order from `supabase/migrations/` using the Supabase SQL editor or Supabase CLI.

4. Start the application:

   ```bash
   npm run dev
   ```

5. Run the current quality checks:

   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```

## Science Observatory

The public `/observatory` section provides server-mediated research tools for:

- ORBIT & ORIGIN's **Cosmic Frame**, a daily rotating discovery and searchable image/video/audio browser powered by NASA's Image and Video Library, now paired with a full-resolution **NASA APOD Spotlight**.
- NASA Astronomy Picture of the Day through the current APOD Basic JSON endpoint and APOD Basic RSS feed, with original-image rendering and publication-time provenance.
- NASA DONKI coronal mass ejection and solar-flare event records.
- NASA Exoplanet Archive Planetary Systems Composite Parameters through TAP/ADQL.
- arXiv research preprints, with optional Crossref publication-metadata candidates.
- ESA Gaia DR3 astrometry through its public TAP+ service.
- ESA Euclid public observation metadata through its anonymous TAP+ interface.
- USGS ComCat earthquake summary feeds in GeoJSON format.
- NASA/JPL CNEOS small-body close-approach records.
- NASA GIBS MODIS Terra global true-colour imagery through WMS.

Provider requests run through server-side routes under `app/api/science/`. Provider keys are not sent to browser code. `NASA_API_KEY` is used by the DONKI integration (the NASA demo key is the fallback); `CROSSREF_MAILTO` is optional and falls back to the configured public contact email.

The Observatory displays source links and retrieval times. arXiv records are labelled as preprints. Crossref title matches are candidates and must be compared with the DOI record before citation. Exoplanet measurements are shown as supplied by the archive; missing values are not estimated.

The Observatory browser automatically rechecks the active panel every 15 minutes while visible and when the reader returns to the tab; readers can also request a manual check. Server-side provider caching limits redundant upstream traffic: USGS 60 seconds, NASA DONKI 5 minutes, arXiv 15 minutes, APOD and JPL close approaches 1 hour, Gaia and the Exoplanet Archive 6 hours, Euclid metadata 12 hours, and NASA GIBS imagery 6 hours. These intervals are refresh policies, not promises that every scientific catalogue changes that frequently. Gaia DR3 is a fixed data release, Euclid records appear as the archive releases them, and observation dates must not be confused with the time ORBIT & ORIGIN checked the provider. The interface labels its own check time separately and links to source records for authoritative timestamps.

Cosmic Frame combines two complementary NASA experiences. Its **APOD Spotlight** uses `https://science.nasa.gov/wp-json/wp/v2/apod-basic` for the latest Astronomy Picture of the Day and `https://science.nasa.gov/feed/apod-basic/` for the matching RSS publication timestamp (`pubDate`). When NASA supplies `hdurl`, the viewer loads that full-size image directly with Next.js image optimization disabled, preserves the source aspect ratio with `object-fit: contain`, and displays the browser-reported native pixel dimensions. This is a full-resolution rendering path, not a promise that every APOD is 4K; the image's actual dimensions are shown after loading. The APOD calendar date, RSS publication timestamp, and archive retrieval time are displayed separately. APOD's current structured feed does not provide an image exposure/capture timestamp, so the interface does not invent one. Video/iframe entries link to the original NASA APOD page. Check each APOD record's credits and copyright notice before republication; NASA's APOD FAQ notes that many images are copyrighted and may require permission for uses beyond personal/non-commercial fair use. Cosmic Frame's separate **NASA Media Library** discovery feature uses `https://images-api.nasa.gov/search`, rotates a daily topic, and automatically selects one archive record; this is a discovery prompt, not a human-curated or editorially endorsed selection. Readers can search by media type. Video and audio results link to their NASA records, and a playable embedded preview is not guaranteed. Verify each item's record-level credit and rights information before republication. The Exoplanet Atlas uses a bounded query of `pscomppars`. arXiv searches return at most 20 records and use a three-second in-process spacing queue; serverless instances do not share in-memory state, so provider usage still requires monitoring.

The Stellar Census makes a bounded Gaia DR3 query for high-signal-to-noise positive parallaxes. Its displayed distance is the simple inverse-parallax value and is explicitly labelled as an approximation. The Euclid panel queries the public `ivoa.obscore` metadata table; it does not download large science products. The Earth Monitor uses USGS' documented GeoJSON summary feeds and NASA GIBS WMS imagery. The asteroid panel requests at most 20 JPL close-approach records within 0.05 au over 60 days and caches the response for one hour. JPL asks clients to avoid excessive or redundant requests and to cache results.

All new provider calls are server-mediated. Gaia and Euclid TAP queries are bounded synchronous queries; larger analyses should use the archives' asynchronous interfaces or their science portals. NASA ADS is not enabled in this phase because it requires a separately provisioned private API token; arXiv and Crossref remain the public literature services.

## Supabase setup

Create a Supabase project and configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_EMAIL` (the one authorised administrator email)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required by subscription endpoints)
- `RESEND_API_KEY` and `EMAIL_FROM` (Resend must have a verified sender domain)
- `UNSUBSCRIBE_SECRET` and `SUBSCRIPTION_RATE_LIMIT_SECRET` (use independent, high-entropy secrets)
- `NEXT_PUBLIC_SITE_URL` (the canonical deployed site URL)

Apply migrations `001` through `005` in numeric order. Migration `005_atomic_issue_publish_claims.sql` adds expiring, row-locked claims for scheduled issue publication; apply it before enabling the cron worker.

### Provision the administrator

1. Create the administrator user through Supabase Authentication.
2. In a trusted Supabase administration interface, set that user's **app_metadata** claim to `{"role":"admin"}`. Do not set this in user-editable `user_metadata`.
3. Set `ADMIN_EMAIL` to the same account email in the deployment environment.
4. Sign in at `/admin/login`.

The dashboard checks both the trusted app-metadata role and the configured administrator email. Database and Storage RLS policies independently enforce the administrator role.

### Issue asset handling

- Draft PDFs and cover images are uploaded to the private `issue-drafts` bucket.
- The server validates file type signatures and enforces 25 MB PDF / 8 MB cover limits.
- Publishing copies approved assets into the public, read-only `issue-public` bucket and only then changes the issue status to published.
- Public archive queries only return published issue records.

## Current platform scope

Implemented on the Phase 2 feature branch:

- Editorial homepage and responsive site shell.
- Public archive backed by Supabase.
- Department landing pages, About, Editorial Standards, Contact and Privacy pages.
- Latest issue redirect and issue-specific reading route.
- PDF.js-powered issue reader with page navigation, progress scrubbing, fit modes, zoom, rotation, fullscreen, keyboard controls and always-visible original-PDF open/download fallbacks.
- Protected administrator login using Supabase Auth, trusted `app_metadata.role`, and an `ADMIN_EMAIL` allow-list.
- Issue draft creation, PDF/cover validation and upload, issue metadata editing, scheduling, cancellation, immediate publishing and unpublishing with assets returned to private storage.
- Back-catalogue batch importer for up to eight PDFs per session, with per-issue metadata, optional separate covers, first-page cover previews, duplicate-number checks and private-draft-only saves.
- Structured editorial article drafts with headline, author, department, Markdown body, HTTPS images/captions, source references, issue association, publishing, scheduling, unpublishing and archiving.
- Public article archive with title search and department filtering; public article reading pages.
- Issue archive search by title with department and year filters.
- Authenticated scheduled publication endpoint for due issues and articles, called by Vercel Cron every five minutes.
- Private draft storage separated from public published assets.
- Double opt-in subscription request, confirmation email, expiring confirmation token, duplicate handling, IP-keyed database rate limiting and unsubscribe confirmation.
- Administrator sign-in, role/email checks, issue draft creation, PDF/cover upload, draft listing and immediate publication.
- Private draft storage and public published-asset storage policies.
- GitHub Actions workflow for TypeScript, ESLint and Next.js production build.

Not yet implemented or not yet verified:

- Subscriber management dashboard and subscriber export/deletion controls.
- Resend campaign delivery, test sends, webhooks, bounce handling, retries and idempotent background queue.
- Complete article-level visual Markdown editor and reviewed PDF-to-HTML conversion. The current article body is stored as Markdown and displayed as readable preformatted text, not rendered rich Markdown.
- Resend campaign delivery, test sends, webhooks, bounce handling, retries and idempotent background queue.
- Full publication audit history and robust scheduled-publication retry monitoring.
- Production-grade abuse prevention beyond the current honeypot and database rate limiter (e.g. Turnstile), and security review of all public endpoints.
- Searchable article archive and filters.
- Automated end-to-end tests and production deployment verification.

Do not use this repository for real subscriber campaigns until the missing consent, unsubscribe, email-delivery and operational safeguards are implemented and tested.

## Environment variables

See `.env.example`. Never commit real credentials.

- Supabase anon key is used by the browser-safe server client.
- Supabase service-role keys, if added for later server-only tasks, must never be exposed to client bundles.
- Resend credentials must remain server-side.
- `NEXT_PUBLIC_CONTACT_EMAIL` controls the public editorial contact address.

## Security notes

- Admin role must be assigned through trusted Supabase Auth app metadata.
- Draft assets are private; published assets are public.
- Never grant public access to subscriber, campaign or delivery tables.
- The Privacy page is a publication template and must be reviewed against the actual production providers and retention practices before launch.

## Deployment

The application is intended for Vercel or another Next.js-compatible host. Configure all required environment variables in the host, apply all five migrations to the production Supabase project, provision the administrator, configure Resend DNS and verify the production domain before accepting real subscribers. The subscription endpoint uses a server-only service-role key and Resend API key; never expose either to the browser.

Scheduled publication requires `CRON_SECRET` in the deployment environment and a host that supports the configured cron schedule. Apply migrations 004 and 005 before using article, scheduling or atomic issue-publication claim features. External provider configuration and a live deployment have not yet been verified.
