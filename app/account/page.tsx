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
    <main className="oo-account-experience">
      <div className="oo-account-shell">
        <section className="oo-account-visual" aria-labelledby="oo-account-heading">
          <div className="oo-account-visual-top">
            <span>ORBIT &amp; ORIGIN</span>
            <span>READER ACCESS · EST. 2026</span>
          </div>
          <div className="oo-account-orbit-art" aria-hidden="true"><span /><span /><span /></div>
          <div className="oo-account-visual-copy">
            <span className="oo-account-eyebrow">A PLACE FOR CURIOSITY</span>
            <h1 id="oo-account-heading">A universe of ideas.<br /><em>Room to keep exploring.</em></h1>
            <p>Follow the questions that take us from our own planetary neighbourhood to the distant structures of the cosmos.</p>
            <div className="oo-account-principles" aria-label="Publication principles">
              <span><b>01</b> Curiosity</span><span><b>02</b> Evidence</span><span><b>03</b> Perspective</span>
            </div>
          </div>
          <div className="oo-account-visual-foot">
            <span>THE UNIVERSE IS OPEN TO EVERYONE.</span>
            <a href="https://svs.gsfc.nasa.gov/vis/a010000/a013800/a013846/13846_NEBULA_WIDE_THUMB.jpg" target="_blank" rel="noopener noreferrer">Visual: NASA&apos;s Goddard Space Flight Center ↗</a>
          </div>
        </section>

        <section className="oo-account-access" aria-labelledby="oo-account-access-title">
          <div className="oo-account-access-heading">
            <span className="oo-account-eyebrow">YOUR READER PROFILE</span>
            <h2 id="oo-account-access-title">Your place in the readership.</h2>
            <p>Sign in or create an optional reader profile. Every article and edition remains open to everyone; an account does not unlock editorial or administrator tools.</p>
          </div>

          {params.error && (
            <p className="oo-account-notice" role="alert">
              {params.error === "signup"
                ? "We could not create that account. Check that the email is valid and try again."
                : params.error === "oauth"
                  ? "Google sign-in could not be completed. Please try again or use email and password."
                  : "Those sign-in details could not be verified. Please check them and try again."}
            </p>
          )}
          {params["check-email"] && <p className="oo-account-notice" role="status">Check your inbox for the confirmation email, then follow its link to finish creating your reader account.</p>}
          {params.welcome && <p className="oo-account-notice" role="status">You are signed in to your reader account.</p>}

          {user ? (
            <section className="oo-account-card oo-account-session">
              <span className="oo-account-card-kicker">ACTIVE READER SESSION</span>
              <h3>Welcome back.</h3>
              <p className="oo-account-card-copy">Your reader profile is signed in as <strong>{user.email || "reader"}</strong>.</p>
              <form action={signOutReader}>
                <button className="oo-account-submit" type="submit">Sign out of your account <span aria-hidden="true">↗</span></button>
              </form>
            </section>
          ) : (
            <div className="oo-account-grid">
              <section className="oo-account-card" aria-labelledby="oo-account-signin-title">
                <div className="oo-account-card-heading">
                  <span className="oo-account-card-kicker">01 / EXISTING READERS</span>
                  <h3 id="oo-account-signin-title">Sign in.</h3>
                  <p className="oo-account-card-copy">Return to your reader profile.</p>
                </div>
                <form className="oo-account-form" action={signInReader}>
                  <label className="oo-account-field" htmlFor="reader-signin-email">
                    <span>Email address</span>
                    <input id="reader-signin-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} />
                  </label>
                  <label className="oo-account-field" htmlFor="reader-signin-password">
                    <span>Password</span>
                    <input id="reader-signin-password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={256} required />
                  </label>
                  <button className="oo-account-submit" type="submit">Sign in <span aria-hidden="true">↗</span></button>
                </form>
                <div className="oo-account-divider"><span>OR</span></div>
                <form action={signInReaderWithGoogle}>
                  <button className="oo-account-google" type="submit"><span className="oo-account-google-mark" aria-hidden="true">G</span>Continue with Google</button>
                </form>
              </section>

              <section className="oo-account-card oo-account-create" aria-labelledby="oo-account-signup-title">
                <div className="oo-account-card-heading">
                  <span className="oo-account-card-kicker">02 / NEW READERS</span>
                  <h3 id="oo-account-signup-title">Create an account.</h3>
                  <p className="oo-account-card-copy">A simple profile for your place in the readership.</p>
                </div>
                <form className="oo-account-form" action={signUpReader}>
                  <label className="oo-account-field" htmlFor="reader-signup-email">
                    <span>Email address</span>
                    <input id="reader-signup-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} />
                  </label>
                  <label className="oo-account-field" htmlFor="reader-signup-password">
                    <span>Create a password</span>
                    <input id="reader-signup-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required />
                  </label>
                  <p className="oo-account-password-note">Use at least 8 characters. Email confirmation may be required.</p>
                  <button className="oo-account-submit" type="submit">Create reader account <span aria-hidden="true">↗</span></button>
                </form>
              </section>
            </div>
          )}

          <div className="oo-account-open-reading">
            <span className="oo-account-open-mark" aria-hidden="true">↗</span>
            <p>Prefer to explore without an account? <Link href="/issues">Continue reading as a guest.</Link>
              <span>Reader accounts cannot create, edit, schedule or publish articles or issues.</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
