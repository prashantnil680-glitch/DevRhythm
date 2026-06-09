import { Suspense } from 'react';
import Script from 'next/script';
import type { Metadata, Viewport } from 'next';
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, OG_IMAGE } from '@/shared/config/seo';
import LoginPageWrapper from '@/features/auth/components/LoginPageWrapper';

export const metadata: Metadata = {
  title: `Login to ${SITE_NAME} – Start Your Coding Rhythm`,
  description: `Join ${SITE_NAME} to track your coding problems, build streaks, and grow with a community of developers. Master DSA with spaced repetition.`,
  keywords: [
    'coding login',
    'sign in',
    'developer platform',
    'DSA practice',
    'leetcode tracker',
    'coding habits',
    'spaced repetition login',
    'DevRhythm signin',
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
    canonical: `${SITE_URL}/login`,
  },
  openGraph: {
    title: `Login to ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_URL}/login`,
    siteName: SITE_NAME,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} – Find your coding rhythm`,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Login to ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE],
    site: '@devrhythm',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function LoginPage() {
  return (
    <>
      {/* Structured data for the website */}
      <Script
        id="schema-org"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL,
            description: DEFAULT_DESCRIPTION,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${SITE_URL}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      {/* How‑To schema for login/registration */}
      <Script
        id="schema-howto-login"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How to start using DevRhythm',
            description: 'Sign in with Google or GitHub to begin tracking your coding progress.',
            totalTime: 'PT2M',
            estimatedCost: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
            step: [
              {
                '@type': 'HowToStep',
                name: 'Choose your provider',
                text: 'Click either "Sign in with Google" or "Sign in with GitHub".',
                image: OG_IMAGE,
              },
              {
                '@type': 'HowToStep',
                name: 'Authorize access',
                text: 'Approve the requested permissions on the provider’s consent screen.',
              },
              {
                '@type': 'HowToStep',
                name: 'Start practicing',
                text: 'Once logged in, you will be redirected to your dashboard where you can set goals, solve problems, and track progress.',
              },
            ],
          }),
        }}
      />
      <Suspense fallback={<div className="devRhythmContainer" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>}>
        <LoginPageWrapper />
      </Suspense>
    </>
  );
}