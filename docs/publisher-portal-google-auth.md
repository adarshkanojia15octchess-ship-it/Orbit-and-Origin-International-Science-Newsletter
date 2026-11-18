# Publisher portal and Google sign-in setup

The unified publishing entry point is `/publisher`. It links to the existing issue manager, article studio, public issue archive and public article archive.

## Required deployment settings

Keep these server/deployment environment variables configured:

- `NEXT_PUBLIC_SITE_URL=https://orbit-and-origin-international-scie.vercel.app`
- `ADMIN_EMAIL` set to the one authorised administrator email
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not put passwords, Google client secrets, or Supabase service-role keys in source control or any `NEXT_PUBLIC_*` variable.

## Enable Google OAuth in Supabase

1. In the Supabase project, open Authentication → Providers → Google and enable Google.
2. Create or select a Google OAuth client in Google Cloud Console.
3. Add the Supabase project's OAuth callback URL shown by Supabase to the Google OAuth client's authorised redirect URIs. It has the form `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Copy the Google OAuth client ID and client secret into the Supabase Google provider settings (not into this repository).
5. In Supabase Authentication → URL Configuration, add `https://orbit-and-origin-international-scie.vercel.app/auth/callback` to the allowed redirect URLs.
6. Confirm the production site URL is configured as `NEXT_PUBLIC_SITE_URL` in Vercel and redeploy after environment changes.

## Authorise the administrator

The callback deliberately checks BOTH the exact `ADMIN_EMAIL` value and the trusted `app_metadata.role = admin` claim. Google login alone never grants publishing rights.

- Ensure the authorised user exists in Supabase Authentication.
- In a trusted Supabase administration interface, assign `app_metadata` as `{"role":"admin"}` for that user.
- Set `ADMIN_EMAIL` to the same email address in Vercel.
- Do not place the role in user-editable `user_metadata`.

After deployment, open `/publisher`, choose secure sign-in, and use the authorised Google account. The OAuth callback is `/auth/callback`.

## Publishing workflow

- **Issues:** use the issue manager to upload each edition PDF and its cover, complete the issue number/title/date/description/departments, save as a draft, preview the public route after publishing.
- **Articles:** use the Article Studio to create one article record per distinct story. Add the original headline and body, select its department, associate the source issue, add image URLs and source references, save as draft, proofread, then publish or schedule.
- Publishing an issue PDF does not automatically create or publish its individual articles. Each article is a separately reviewed editorial record.
- Existing article entry accepts Markdown text; it is not a PDF-to-article converter. Do not assume that uploading an issue PDF automatically extracts or creates article pages.

## Security behaviour

- Both password and Google sign-in use Supabase Auth.
- The OAuth callback rejects users without the trusted admin claim or with an email that does not match `ADMIN_EMAIL`.
- Unauthorised OAuth sessions are signed out.
- Never commit a password, Google client secret, Supabase service-role key, or other credential.
