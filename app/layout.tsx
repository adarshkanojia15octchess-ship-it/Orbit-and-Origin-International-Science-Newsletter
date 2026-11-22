import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ORBIT & ORIGIN — Exploring the Universe",
    template: "%s | ORBIT & ORIGIN",
  },
  description: "An independent science and astronomy publication.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://orbit-and-origin-international-scie.vercel.app"),
};

const publicNav = [
  ["Issues", "/issues"],
  ["Science Observatory", "/observatory"],
  ["Sky Explorer", "/sky-explorer"],
  ["Articles", "/articles"],
  ["Tapestry of Worlds", "/departments/tapestry-of-worlds"],
  ["Frontier Tech", "/departments/frontier-tech"],
  ["The Universal Record", "/departments/universal-record"],
  ["About", "/about"],
];

async function getNavigationAccess() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const isAdmin = Boolean(
      user &&
      user.app_metadata?.role === "admin" &&
      configuredAdminEmail &&
      user.email?.toLowerCase() === configuredAdminEmail
    );
    return { isAdmin, isReader: Boolean(user && !isAdmin) };
  } catch {
    return { isAdmin: false, isReader: false };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isReader } = await getNavigationAccess();
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "adarshkanojia15octchess@gmail.com";
  const nav = isReader
    ? [["Issues", "/issues"]]
    : isAdmin
      ? [...publicNav, ["Founder Workspace", "/founder/portal"]]
      : publicNav;

  return (
    <html lang="en">
      <body>
        <header className={"site-header" + (isReader ? " reader-mode-header" : "")}>
          <Link className="wordmark" href={isReader ? "/issues" : "/"}>ORBIT <span>&amp;</span> ORIGIN</Link>
          <nav aria-label="Main navigation">
            {nav.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <div className="header-actions">
            {isReader
              ? <Link className="reader-link" href="/account">Reader account</Link>
              : <Link className="reader-link" href="/account">Reader sign in</Link>}
            {!isReader && <Link className="subscribe-link" href="/subscribe">Subscribe ↗</Link>}
          </div>
        </header>
        {children}
        <footer className={"site-footer" + (isReader ? " reader-mode-footer" : "")}>
          <div>
            <Link className="wordmark" href={isReader ? "/issues" : "/"}>ORBIT <span>&amp;</span> ORIGIN</Link>
            <p>Exploring the Universe, Understanding Our Place.</p>
            <p className="footer-book-credit">“Cosmic Neighbourhood” is inspired by <cite>Tapestry of Worlds: Beyond Solar System and Universe</cite>, written by Adarsh Kanojia (author) and Rishi K. Pal (co-author).</p>
            {!isReader && <p className="footer-contact"><a href={"mailto:" + contactEmail}>{contactEmail}</a></p>}
          </div>
          <div className="footer-links">
            {isReader ? (
              <>
                <Link href="/issues">Issue archive</Link>
                <Link href="/account">Reader account</Link>
                <Link href="/privacy">Privacy</Link>
              </>
            ) : (
              <>
                <Link href="/about">About</Link>
                <Link href="/editorial-standards">Editorial Standards</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/subscribe">Subscribe</Link>
                <Link href="/account">Reader sign in</Link>
                {isAdmin && <Link href="/founder/portal">Founder Workspace</Link>}
              </>
            )}
          </div>
          <small>© 2026 Adarsh Kanojia. All rights reserved.<span>Independent science publishing. Accuracy before sensationalism.</span></small>
        </footer>
      </body>
    </html>
  );
}
