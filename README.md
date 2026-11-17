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

   \`\`\`bash
   npm ci
   \`\`\`

2. Copy \`.env.example\` to \`.env.local\` and configure the public Supabase project URL and anon key.

3. Apply migrations in order from \`supabase/migrations/\` using the Supabase SQL editor or Supabase CLI.

4. Start the application:

   \`\`\`bash
   npm run dev
   \`\`\`

5. Run the current quality checks:

   \`\`\`bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   \`\`\`

## Science Observatory

The public \`/observatory\` section provides a server-mediated interface to:

- NASA Astronomy Picture of the Day through the current Science website WordPress endpoint.
- NASA DONKI coronal mass ejection and solar-flare event records.
- NASA Exoplanet Archive Planetary Systems Composite Parameters through TAP/ADQL.
- arXiv research preprints, with Crossref title-search candidates for publication metadata.

Provider API calls are made in server routes under \`app/api/science/\`; provider keys are not sent to browser code. NASA_API_KEY is optional for local use but recommended for a deployed service. CROSSREF_MAILTO is optional; when omitted, the configured public contact email is used for Crossref's polite access pool.

The Observatory shows the provider, source links, retrieval time and record type. arXiv results remain labelled as preprints unless a journal reference is supplied. Crossref title matches are candidates and must be checked against the DOI record before citation. Catalogue measurements are not editorial conclusions.

The NASA APOD implementation uses \`https://science.nasa.gov/wp-json/wp/v2/apod-basic/\`, not the legacy APOD endpoint. The NASA Exoplanet Archive query is bounded and uses the \`pscomppars\` table. arXiv requests are limited to 20 results and a three-second in-process request spacing queue; caching reduces repeated provider calls. Serverless instances do not share that in-memory queue, so the provider's published limits should still be monitored.

No Gaia, Euclid, ADS, USGS or NASA GIBS integration is included in this first implementation phase.

## Supabase setup

Create a Supabase project and configure:

- \`NEXT_PUBLIC_SUPABASE_URL\`
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`
- \`ADMIN_EMAIL\` (the one authorised administrator email)
- \`SUPABASE_SERVICE_ROLE_KEY\` (server-only; required by subscription endpoints)
- \`RESEND_API_KEY\` and \`EMAIL_FROM\` (Resend must have a verified sender domain)
- \`UNSUBSCRIBE_SECRET\` and \`SUBSCRIPTION_RATE_LIMIT_SECRET\` (use independent, high-entropy secrets)
- \`NEXT_PUBLIC_SITE_URL\` (the canonical deployed site URL)

Apply migrations \`001\` through \`005\` in numeric order. Migration \`005_atomic_issue_publish_claims.sql\` adds expiring, row-locked claims for scheduled issue publication; apply it before enabling the cron worker.

### Provision the administrator

1. Create the administrator user through Supabase Authentication.
2. In a trusted Supabase administration interface, set that user's **app_metadata** claim to \`{"role":"admin"}\`. Do not set this in user-editable \`user_metadata\`.
3. Set \`ADMIN_EMAIL\` to the same account email in the deployment environment.
4. Sign in at \`/admin/login\`.

The dashboard checks both the trusted app-metadata role and the configured administrator email. Database and Storage RLS policies independently enforce the administrator role.

### Issue asset handling

- Draft PDFs and cover images are uploaded to the private \`issue-drafts\` bucket.
- The server validates file type signatures and enforces 25 MB PDF / 8 MB cover limits.
- Publishing copies approved assets into the public, read-only \`issue-public\` bucket and only then changes the issue status to published.
- Public archive queries only return published issue records.

## Current platform scope

Implemented on the Phase 2 feature branch:

- Editorial homepage and responsive site shell.
- Public archive backed by Supabase.
- Department landing pages, About, Editorial Standards, Contact and Privacy pages.
- Latest issue redirect and issue-specific reading route.
- Browser-native embedded PDF reader with open/download fallback.
- Protected administrator login using Supabase Auth, trusted \`app_metadata.role\`, and an \`ADMIN_EMAIL\` allow-list.
- Issue draft creation, PDF/cover validation and upload, issue metadata editing, scheduling, cancellation, immediate publishing and unpublishing with assets returned to private storage.
- Structured editorial article drafts with headline, author, department, Markdown body, HTTPS images/captions, source references, issue association, publishing, scheduling, unpublishing and archiving.
- Public article archive with title search and department filtering; public article reading pages.
- Issue archive search by title with department and year filters.
- Authenticated scheduled publication endpoint for due issues and articles, called by Vercel Cron every five minutes.
- Private draft storage separated from public published assets.
- Double opt-in subscription request, confirmation email, expiring confirmation token, duplicate handling, IP-keyed database rate limiting and unsubscribe confirmation.
- Administrator sign-in, role/email checks, issue draft creation, PDF/cover upload, draft listing and immediate publication.
- Private draft storage and public published-asset storage policies.
- GitHub Actions workflow for TypeScript, ESLint and Next.js production build.

## Environment variables

See \`.env.example\`. Never commit real credentials.

- Supabase anon key is used by the browser-safe server client.
- Supabase service-role keys, if added for later server-only tasks, must never be exposed to client bundles.
- Resend credentials must remain server-side.
- \`NEXT_PUBLIC_CONTACT_EMAIL\` controls the public editorial contact address.

## Security notes

- Admin role must be assigned through trusted Supabase Auth app metadata.
- Draft assets are private; published assets are public.
- Never grant public access to subscriber, campaign or delivery tables.
- The Privacy page is a publication template and must be reviewed against the actual production providers and retention practices before launch.

## Deployment

The application is intended for Vercel or another Next.js-compatible host. Configure all required environment variables in the host, apply all five migrations to the production Supabase project, provision the administrator, configure Resend DNS and verify the production domain before accepting real subscribers. The subscription endpoint uses a server-only service-role key and Resend API key; never expose either to the browser.

Scheduled publication requires \`CRON_SECRET\` in the deployment environment and a host that supports the configured cron schedule. Apply migrations 004 and 005 before using article, scheduling or atomic issue-publication claim features. External provider configuration and a live deployment have not yet been verified.
