import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signInReader, signInReaderWithGoogle, signOutReader, signUpReader } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Reader Account",
  description: "Create an ORBIT & ORIGIN reader account or sign in.",
  robots: { index: false, follow: false },
};

export default async function ReaderAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; welcome?: string; "check-email"?: string }>;
}) {
  const [supabase, params] = await Promise.all([createClient(), searchParams]);
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <main className="page-shell oo-account-page">
      <span className="kicker">ORBIT &amp; ORIGIN / READER ACCESS</span>
      <h1>Your place in the readership.</h1>
      <p className="muted oo-account-intro">Sign in to keep a reader profile. The publication remains open to everyone; an account does not unlock editorial or administrator tools.</p>
      {params.error && <p className="oo-account-notice" role="alert">
        {params.error === "signup" ? "We could not create that account. Check that the email is valid and try again." :
         params.error === "oauth" ? "Google sign-in could not be completed. Check the Google provider configuration and try again." :
         "Those sign-in details could not be verified. Please try again."}
      </p>}
      {params["check-email"] && <p className="oo-account-notice" role="status">Check your inbox for the confirmation email, then follow its link to finish creating your reader account.</p>}
      {params.welcome && <p className="oo-account-notice" role="status">You are signed in to your reader account.</p>}

      {user ? (
        <section className="story-card oo-account-card">
          <span className="kicker">READER SESSION</span>
          <h2>Welcome to the readership.</h2>
          <p className="muted">Signed in as {user.email || "reader"}.</p>
          <form action={signOutReader}><button type="submit">Sign out</button></form>
        </section>
      ) : (
        <div className="oo-account-grid">
          <section className="story-card oo-account-card">
            <span className="kicker">EXISTING READERS</span>
            <h2>Sign in.</h2>
            <form action={signInReader}>
              <label className="form-field">Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
              <label className="form-field">Password<input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={256} required/></label>
              <button type="submit">Sign in to your account</button>
            </form>
            <div className="oo-account-divider"><span>or</span></div>
            <form action={signInReaderWithGoogle}><button type="submit">Continue with Google</button></form>
          </section>
          <section className="story-card oo-account-card">
            <span className="kicker">NEW READERS</span>
            <h2>Create an account.</h2>
            <form action={signUpReader}>
              <label className="form-field">Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
              <label className="form-field">Create a password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required/></label>
              <p className="muted">Use at least 8 characters. Email confirmation may be required.</p>
              <button type="submit">Create reader account</button>
            </form>
          </section>
        </div>
      )}
      <p className="muted oo-account-footnote">Reader accounts cannot create, edit, schedule or publish articles or issues. <Link href="/issues">Continue reading without signing in ↗</Link></p>
    </main>
  );
}
