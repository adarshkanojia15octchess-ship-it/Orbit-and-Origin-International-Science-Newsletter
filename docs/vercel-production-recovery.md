# Vercel production deployment and domain recovery

This repository is connected to Vercel, but a successful GitHub deployment status does not prove that every remembered `*.vercel.app` hostname is assigned to the production project. A Vercel `404: DEPLOYMENT_NOT_FOUND` means the requested deployment/hostname could not be resolved by Vercel; it is not an application-level Next.js 404.

## Canonical URL recorded by this repository

The existing production configuration documentation records:

`https://orbit-and-origin-international-scie.vercel.app`

The longer hostname `orbit-and-origin-international-science-newsletter.vercel.app` is a different address and must not be assumed to be an alias. Confirm the actual assigned domains in the Vercel project before sharing a URL.

## Vercel project checklist

In the Vercel dashboard, open the project connected to this GitHub repository and verify:

1. The Git repository is `adarshkanojia15octchess-ship-it/Orbit-and-Origin-International-Science-Newsletter`.
2. The production branch is `main`.
3. The Root Directory is the repository root (unless the project has deliberately been configured otherwise).
4. The latest production deployment was created from the current `main` commit and has Ready status.
5. The intended hostname appears under Settings → Domains and is assigned to this project.
6. The hostname's DNS/alias status is valid. Remove stale or conflicting assignments only after confirming which project should own the domain.
7. The Production environment contains `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ADMIN_EMAIL`. Configure Google OAuth and Supabase redirect URLs separately using [publisher-portal-google-auth.md](./publisher-portal-google-auth.md).
8. Redeploy after changing environment variables or domain assignments.

Do not add secrets to GitHub files, commit environment files, or expose service-role keys in browser variables.

## Smoke-test routes

After Vercel reports Ready and the domain is assigned, verify these paths on the exact assigned hostname:

- `/` — public homepage
- `/publisher` — unauthenticated visitors should receive the sign-in page (HTTP 200); an authorised administrator should see the dashboard
- `/publisher/health` — administrator-only diagnostics page
- `/issues` — public issue archive
- `/articles` — public article index
- `/api/publisher/overview` — must return HTTP 401 when called without an administrator session
- `/api/publisher/health` — must return HTTP 401 when called without an administrator session

The GitHub Actions production smoke-test workflow checks the public routes after pushes to `main`. Set the repository variable `PRODUCTION_URL` to the exact Vercel domain if it differs from the documented fallback. A failed smoke test is a deployment/domain alert, not a reason to weaken authentication.

## What GitHub can and cannot change

Repository changes can improve the application, CI checks, route diagnostics, and deployment documentation. They cannot assign a Vercel project domain, edit Vercel project settings, configure DNS, or create Supabase/Google credentials. Those actions require access to the corresponding provider dashboard.
