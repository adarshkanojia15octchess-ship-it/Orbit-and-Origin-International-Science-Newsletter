import Link from "next/link";
import { signInAdmin, signInWithGoogle } from "./actions";

export const metadata = { title: "Founder Sign In", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="page-shell" style={{ maxWidth: 620 }}>
      <span className="kicker">Founder-only workspace / Restricted access</span>
      <h1>Founder workspace.</h1>
      <p className="muted">Sign in with the single authorised founder account to manage editions, articles and publication settings.</p>
      {error && <p role="alert" className="muted">{error === "configuration" ? "Administrator sign-in is not configured. The production deployment needs ADMIN_EMAIL. Google sign-in also requires the Google provider and production callback URL in Supabase Auth." :
         error === "unauthorised" ? "This account is not authorised. In Supabase Auth, the configured founder account must have the trusted app_metadata claim role = admin and its email must exactly match ADMIN_EMAIL." :
         error === "oauth" ? "Google sign-in could not be completed. Confirm the Google provider is enabled in Supabase Auth and the production callback URL is allowed." :
         "Sign-in failed. Check the administrator email and password, or use Google with the authorised founder account."}</p>}
      <form action={signInWithGoogle} style={{ marginTop: 32 }}>
        <button type="submit">Continue with Google</button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
        <span style={{ height: 1, background: "var(--line)", flex: 1 }} />
        <span className="muted">or use administrator password</span>
        <span style={{ height: 1, background: "var(--line)", flex: 1 }} />
      </div>
      <form action={signInAdmin}>
        <label className="form-field">Administrator email<input type="email" name="email" autoComplete="username" required maxLength={254}/></label>
        <label className="form-field">Password<input type="password" name="password" autoComplete="current-password" required maxLength={256}/></label>
        <button type="submit">Sign in with email</button>
      </form>
      <p className="muted" style={{ marginTop: 24 }}>Google authentication does not grant publishing access by itself. The signed-in Google account must also have the trusted admin role in Supabase and match the configured administrator email.</p>
    <p className="muted" style={{marginTop:24}}>Reader access is separate. <Link href="/account">Open the public reader sign-in ↗</Link></p>
    </main>
  );
}
