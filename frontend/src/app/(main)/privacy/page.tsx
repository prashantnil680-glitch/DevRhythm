import React from 'react';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import { 
  FiShield, FiLock, FiEye, FiDatabase, 
  FiGithub, FiTrendingUp, FiHeart 
} from 'react-icons/fi';
import Card from '@/shared/components/Card';
import Breadcrumb from '@/shared/components/Breadcrumb';
import styles from './page.module.css';

const SITE_URL = 'https://www.devrhythm.space';
const lastUpdated = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const metadata: Metadata = {
  title: 'Privacy Policy · DevRhythm – How We Handle Your Data',
  description:
    'DevRhythm respects your privacy. Learn what data we collect, how we use it, and your rights. No tracking, no ads, no selling – just your coding rhythm.',
  keywords: [
    'privacy policy',
    'data protection',
    'coding platform privacy',
    'DevRhythm privacy',
    'GDPR',
    'user data',
    'secure coding practice',
  ].join(', '),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
  openGraph: {
    title: 'Privacy Policy · DevRhythm',
    description:
      'DevRhythm respects your privacy. Learn what data we collect, how we use it, and your rights.',
    url: `${SITE_URL}/privacy`,
    siteName: 'DevRhythm',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy · DevRhythm',
    description:
      'DevRhythm respects your privacy. Learn what data we collect, how we use it, and your rights.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: '/' },
  { label: 'Privacy' },
];

export default function PrivacyPage() {
  return (
    <>
      {/* BreadcrumbList Schema */}
      <Script
        id="schema-breadcrumb"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: `${SITE_URL}/privacy` },
            ],
          }),
        }}
      />

      {/* WebPage Schema */}
      <Script
        id="schema-webpage"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': `${SITE_URL}/privacy#webpage`,
            url: `${SITE_URL}/privacy`,
            name: 'Privacy Policy · DevRhythm',
            isPartOf: { '@id': `${SITE_URL}/#website` },
            dateModified: new Date().toISOString(),
            primaryImageOfPage: {
              '@type': 'ImageObject',
              url: `${SITE_URL}/images/logos/dr-icon-dark-logo.png`,
            },
          }),
        }}
      />

      <div className={styles.container}>
        <Breadcrumb items={breadcrumbItems} renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>{props.children}</Link>
        )} />
        
        <Card className={styles.privacyCard}>
          <div className={styles.header}>
            <div className={styles.iconWrapper}>
              <FiHeart className={styles.icon} />
            </div>
            <h1 className={styles.title}>Privacy Policy</h1>
            <p className={styles.lastUpdated}>Last updated: {lastUpdated}</p>
            <p className={styles.tagline}>Your progress, your rhythm, your data.</p>
          </div>

          <div className={styles.content}>
            <section className={styles.section}>
              <h2><FiTrendingUp className={styles.sectionIcon} /> Our Philosophy</h2>
              <p>
                DevRhythm exists to help you build a sustainable DSA habit. We collect only what's necessary to track your progress, 
                generate revision schedules, and show you insights. We don't sell your data. We don't show ads. We don't track you across the web.
              </p>
            </section>

            <section className={styles.section}>
              <h2><FiDatabase className={styles.sectionIcon} /> What We Collect (and Why)</h2>
              <ul>
                <li><strong>Account info</strong> – name, email, avatar (from Google/GitHub) → so you can log in and we know who you are.</li>
                <li><strong>Problem solutions & attempts</strong> – to track your solved count, mastery, and revision needs.</li>
                <li><strong>Time spent & confidence ratings</strong> – to personalize revision schedules and show growth trends.</li>
                <li><strong>Notes & key insights</strong> – stored for your reference only; not shared publicly unless you choose to.</li>
                <li><strong>Heatmap data</strong> – daily activity, problem solves, revisions – visualized as your "garden."</li>
                <li><strong>Goal completions & streaks</strong> – to celebrate consistency (or gently nudge you).</li>
              </ul>
              <p className={styles.highlight}>
                We do NOT collect: raw code from runs (unless you save it), browsing history outside DevRhythm, or any financial information.
              </p>
            </section>

            <section className={styles.section}>
              <h2><FiLock className={styles.sectionIcon} /> How We Use Your Data</h2>
              <ul>
                <li>📊 Generate your personal dashboards and revision schedules.</li>
                <li>🔔 Send reminders (you can turn these off in settings).</li>
                <li>📈 Improve the platform (aggregated, anonymized).</li>
                <li>🛡️ Detect abuse or anomalous patterns.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2><FiEye className={styles.sectionIcon} /> What Others Can See</h2>
              <p>By default, your profile is semi‑public:</p>
              <ul>
                <li>👤 Your username, display name, avatar – visible to logged‑in users.</li>
                <li>📊 Your total solved count, streaks, and heatmap (if you choose public profile).</li>
                <li>❌ Your notes, confidence ratings, revision progress – always private to you.</li>
              </ul>
              <p>
                You can share specific progress via "shares" (coming soon) – you control exactly what's included.
              </p>
            </section>

            <section className={styles.section}>
              <h2><FiDatabase className={styles.sectionIcon} /> Data Retention</h2>
              <p>
                Your data stays with us as long as your account is active. If you delete your account, we will remove all personal data within 30 days. 
                Aggregated statistics (e.g., "users who solved 100+ problems") may be kept for platform insights – no personal identifiers remain.
              </p>
            </section>

            <section className={styles.section}>
              <h2><FiShield className={styles.sectionIcon} /> Third‑Party Services</h2>
              <p>
                DevRhythm uses:
              </p>
              <ul>
                <li><strong>Vercel</strong> – frontend hosting (see their privacy policy).</li>
                <li><strong>Render</strong> – backend hosting.</li>
                <li><strong>Google & GitHub</strong> – authentication (we only receive basic profile info).</li>
                <li><strong>LeetCode</strong> – problem data (we fetch public problem statements and test cases).</li>
              </ul>
              <p>
                We do not share your personal data with any other third parties.
              </p>
            </section>

            <section className={styles.section}>
              <h2><FiLock className={styles.sectionIcon} /> Cookies & Local Storage</h2>
              <p>
                We use essential cookies and localStorage for:
              </p>
              <ul>
                <li>🍪 Keeping you logged in (auth token).</li>
                <li>🌓 Remembering your theme preference (light/dark).</li>
                <li>📝 Caching your recent code runs (so you don't lose work).</li>
              </ul>
              <p>
                No tracking cookies. No analytics scripts that follow you around.
              </p>
            </section>

            <section className={styles.section}>
              <h2><FiTrendingUp className={styles.sectionIcon} /> Your Rights</h2>
              <ul>
                <li>✅ <strong>Access:</strong> See all your data via your profile and API (export coming soon).</li>
                <li>✅ <strong>Correction:</strong> Update your display name, preferences, and notes anytime.</li>
                <li>✅ <strong>Deletion:</strong> Delete your account from settings – we'll wipe your data.</li>
                <li>✅ <strong>Opt‑out:</strong> Disable notifications in preferences.</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2><FiGithub className={styles.sectionIcon} /> Contact Us</h2>
              <p>
                Have questions about your data or this policy? Open an issue on GitHub (public) or suggest improvements:
              </p>
              <p>
                <a 
                  href="https://github.com/anupam6335/DevRhythm/issues" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.contactLink}
                >
                  <FiGithub className={styles.contactIcon} /> github.com/anupam6335/DevRhythm/issues
                </a>
              </p>
              <p className={styles.note}>
                For sensitive privacy concerns, you can also reach out via GitHub (create a private issue if GitHub allows, or email if we add one later).
              </p>
            </section>

            <section className={styles.section}>
              <h2>Changes to This Policy</h2>
              <p>
                If we make significant changes, we'll notify you via email (if you have one) or a banner on the platform. 
                Minor updates (clarifications, typo fixes) happen without notice – but the "last updated" date will always reflect the latest change.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </>
  );
}