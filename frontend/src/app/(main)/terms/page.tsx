import React from 'react';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import {
  FiTrendingUp,
  FiRepeat,
  FiTarget,
  FiShield,
  FiAlertCircle,
  FiGithub,
  FiClock,
  FiZap,
  FiCalendar,
} from 'react-icons/fi';
import Breadcrumb from '@/shared/components/Breadcrumb';
import styles from './page.module.css';

const SITE_URL = 'https://www.devrhythm.space';
const lastUpdated = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const metadata: Metadata = {
  title: 'Terms of Service · DevRhythm – Fair Use & Code of Conduct',
  description:
    'Read the terms for using DevRhythm. Understand your rights, responsibilities, and what we expect from every developer in our community.',
  keywords: [
    'terms of service',
    'terms and conditions',
    'code of conduct',
    'DevRhythm terms',
    'fair use policy',
    'coding platform agreement',
    'user agreement',
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
    canonical: `${SITE_URL}/terms`,
  },
  openGraph: {
    title: 'Terms of Service · DevRhythm',
    description:
      'Read the terms for using DevRhythm. Understand your rights, responsibilities, and code of conduct.',
    url: `${SITE_URL}/terms`,
    siteName: 'DevRhythm',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service · DevRhythm',
    description:
      'Read the terms for using DevRhythm. Understand your rights, responsibilities, and code of conduct.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: '/' },
  { label: 'Terms' },
];

export default function TermsPage() {
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
              { '@type': 'ListItem', position: 2, name: 'Terms of Service', item: `${SITE_URL}/terms` },
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
            '@id': `${SITE_URL}/terms#webpage`,
            url: `${SITE_URL}/terms`,
            name: 'Terms of Service · DevRhythm',
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
        <Breadcrumb
          items={breadcrumbItems}
          renderLink={(item, props) => (
            <Link href={item.href!} className={props.className}>
              {props.children}
            </Link>
          )}
        />

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroIcon}>
            <FiShield />
          </div>
          <h1 className={styles.heroTitle}>Terms of Service</h1>
          <p className={styles.heroSubtitle}>Find your rhythm. Stay consistent. Master DSA.</p>
          <div className={styles.heroMeta}>
            <FiCalendar size={14} />
            <span>Last updated: {lastUpdated}</span>
          </div>
        </div>

        <hr className={styles.divider} />

        {/* The Spirit of DevRhythm */}
        <section className={styles.section}>
          <h2>
            <FiZap className={styles.sectionIcon} /> The Spirit of DevRhythm
          </h2>
          <p>
            DevRhythm exists to help developers build lasting coding habits – not cram, not cheat, but{' '}
            <strong>practice with rhythm</strong>. These terms exist to protect that environment.
            Use the platform honestly, respect others, and focus on your own growth.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* What You Can Do */}
        <section className={styles.section}>
          <h2>
            <FiTarget className={styles.sectionIcon} /> What You Can Do
          </h2>
          <ul>
            <li>✅ Solve problems at your own pace.</li>
            <li>✅ Use spaced repetition to truly master patterns.</li>
            <li>✅ Track your heatmap, streaks, and goals.</li>
            <li>✅ Share progress publicly or keep it private (sharing features are planned).</li>
            <li>✅ Learn from similar questions and revision timelines.</li>
          </ul>
        </section>

        <hr className={styles.divider} />

        {/* What You Cannot Do */}
        <section className={styles.section}>
          <h2>
            <FiAlertCircle className={styles.sectionIcon} /> What You Cannot Do
          </h2>
          <ul>
            <li>❌ Automate submissions or artificially inflate stats.</li>
            <li>❌ Scrape, reverse‑engineer, or abuse the platform.</li>
            <li>❌ Submit malicious code or attempt to disrupt services.</li>
            <li>❌ Impersonate others or share accounts.</li>
            <li>❌ Use DevRhythm to cheat on coding interviews or assessments elsewhere.</li>
          </ul>
          <p className={styles.highlight}>
            Your rhythm is yours. Don't fake it. The system detects anomalies – and we trust you to do the right thing.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* Revision Schedules & Goals */}
        <section className={styles.section}>
          <h2>
            <FiRepeat className={styles.sectionIcon} /> Revision Schedules &amp; Goals
          </h2>
          <p>
            DevRhythm automatically generates revision schedules based on your solves. These schedules are suggestions, not obligations.
            You can reschedule, skip, or complete revisions at any time. Goals are self‑set – we don't enforce them, but your heatmap will reflect the truth.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* Account & Data Retention */}
        <section className={styles.section}>
          <h2>
            <FiClock className={styles.sectionIcon} /> Account &amp; Data Retention
          </h2>
          <p>
            You own your progress data. If you delete your account, we will remove your personal data within 30 days.
            Aggregated, anonymised statistics (e.g., "average mastery rate") may be retained for platform improvement.
          </p>
          <p>
            <strong>Note:</strong> A self‑service account deletion feature is planned. In the meantime, you can request deletion by contacting us via GitHub.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* Service Availability */}
        <section className={styles.section}>
          <h2>
            <FiShield className={styles.sectionIcon} /> Service Availability
          </h2>
          <p>
            We strive for 99.9% uptime, but DevRhythm is provided "as is." There may be occasional maintenance, bugs, or downtime.
            We're a small team (sometimes one person) building this in the open – patience and constructive feedback are appreciated.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* Limitation of Liability */}
        <section className={styles.section}>
          <h2>
            <FiAlertCircle className={styles.sectionIcon} /> Limitation of Liability
          </h2>
          <p>DevRhythm is a tool to help you learn. We are not responsible for:</p>
          <ul>
            <li>Your performance in technical interviews.</li>
            <li>Loss of streaks due to technical issues (but we feel your pain).</li>
            <li>Decisions you make based on our analytics.</li>
          </ul>
        </section>

        <hr className={styles.divider} />

        {/* Governing Law */}
        <section className={styles.section}>
          <h2>
            <FiAlertCircle className={styles.sectionIcon} /> Governing Law
          </h2>
          <p>
            These terms are governed by the laws of India. Any disputes shall be handled in the courts of India.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* Contact & Feedback */}
        <section className={styles.section}>
          <h2>
            <FiGithub className={styles.sectionIcon} /> Contact &amp; Feedback
          </h2>
          <p>
            DevRhythm is open to feedback, bug reports, and feature requests. The best way to reach us is through GitHub Issues:
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
            For security concerns, please open a private issue or email (if provided in the future).
            We'll respond as soon as we can – usually within a few days.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* Changes to These Terms */}
        <section className={styles.section}>
          <h2>Changes to These Terms</h2>
          <p>
            If we make significant changes, we'll notify you via email (if you have one) or a banner on the platform.
            Minor updates (clarifications, typo fixes) happen without notice – but the "last updated" date will always reflect the latest change.
          </p>
        </section>
      </div>
    </>
  );
}