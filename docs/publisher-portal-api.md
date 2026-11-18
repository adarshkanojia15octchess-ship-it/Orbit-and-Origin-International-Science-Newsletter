# Publisher Portal API

All endpoints in this document are private editorial APIs. They require an authenticated Supabase session that passes the same trusted administrator checks as the publishing pages:

- `user.app_metadata.role === "admin"`
- The signed-in email matches `ADMIN_EMAIL` (case-insensitive)

Unauthorised requests receive HTTP 401. Responses containing editorial data use `Cache-Control: private, no-store`. Do not call these endpoints from public pages or expose service-role credentials in a browser.

## Read endpoints

### `GET /api/publisher/overview`

Returns dashboard totals, counts by status, and the five most recently updated issues and articles.

Example response shape:

```json
{
  "totals": { "issues": 3, "articles": 12 },
  "byStatus": {
    "draft": { "issues": 1, "articles": 2 },
    "scheduled": { "issues": 1, "articles": 1 },
    "published": { "issues": 1, "articles": 9 },
    "archived": { "issues": 0, "articles": 0 }
  },
  "recentIssues": [],
  "recentArticles": [],
  "generatedAt": "2026-11-18T00:00:00.000Z"
}
```

The numbers above are illustrative, not live publication data.

### `GET /api/publisher/content`

Query parameters:

- `type`: required, `issues` or `articles`
- `status`: optional, `draft`, `scheduled`, `published`, or `archived`
- `limit`: optional integer from 1 to 100; defaults to 25
- `offset`: optional integer from 0 to 10000; defaults to 0

Returns a paginated list and total count. Article bodies and private storage paths are intentionally excluded.

### `GET /api/publisher/calendar`

Required query parameters:

- `from`: ISO-8601 timestamp with timezone
- `to`: ISO-8601 timestamp with timezone

Returns scheduled issues and articles in the requested interval. The interval must be positive and no longer than 366 days.

## Write operations

Publishing mutations deliberately continue to use the existing authenticated Next.js Server Actions rather than adding a second REST write path:

- Issue actions: `app/admin/actions.ts` — create/upload draft, edit metadata, publish, schedule, cancel schedule, unpublish.
- Article actions: `app/admin/articles/actions.ts` — create, edit, publish, schedule, unpublish, archive.

These actions already perform administrator checks, input validation, storage handling, publication state transitions, and cache revalidation. Reusing them avoids two competing implementations of editorial permissions and publication logic.

## External services and migrations

The dashboard/read APIs use the existing Supabase issues and articles tables and require no new migration or third-party API key. Google OAuth remains separately configured as described in [publisher-portal-google-auth.md](./publisher-portal-google-auth.md).

The following are not part of this API yet: media-library management, an editorial audit log, PDF-to-article extraction, newsletter email campaign delivery, and multi-editor review assignments. They require explicit product decisions and, where applicable, new database tables/storage policies.
