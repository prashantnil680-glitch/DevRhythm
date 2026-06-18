import React from 'react';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import Breadcrumb from '@/shared/components/Breadcrumb';
import AboutPageClient from './AboutPageClient';

const SITE_URL = 'https://www.devrhythm.space';
const OG_IMAGE = `${SITE_URL}/devrhythm-maker.jpg`;

export const metadata: Metadata = {
  title: 'The Story Behind DevRhythm – Why I Built a DSA Habit Platform',
  description:
    'The real story behind DevRhythm: why I built a platform to fix my own broken DSA practice, and how it helps developers build lasting coding habits with spaced repetition.',
  keywords: [
    'DevRhythm story',
    'coding habits',
    'spaced repetition',
    'DSA practice',
    'developer journey',
    'coding platform',
    'Anupam Debnath',
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
    canonical: `${SITE_URL}/about/me`,
  },
  openGraph: {
    title: 'The Story Behind DevRhythm',
    description:
      'Why I built a platform to fix my own broken DSA practice, and how it helps developers build lasting coding habits with spaced repetition.',
    url: `${SITE_URL}/about/me`,
    siteName: 'DevRhythm',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'The story behind DevRhythm',
      },
    ],
    locale: 'en_US',
    type: 'profile',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Story Behind DevRhythm',
    description:
      'Why I built a platform to fix my own broken DSA practice.',
    images: [OG_IMAGE],
    site: '@devrhythm',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: '/' },
  { label: 'About' },
];

export default function AboutPage() {
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
              { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE_URL}/about/me` },
            ],
          }),
        }}
      />

      {/* ProfilePage + Person Schema */}
      <Script
        id="schema-person"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            '@id': `${SITE_URL}/about/me#profilepage`,
            url: `${SITE_URL}/about/me`,
            name: 'About DevRhythm & Anupam Debnath',
            isPartOf: { '@id': `${SITE_URL}/#website` },
            mainEntity: {
              '@type': 'Person',
              '@id': `${SITE_URL}/about/me#person`,
              name: 'Anupam Debnath',
              url: `${SITE_URL}/about/me`,
              jobTitle: 'Web Developer',
              worksFor: {
                '@type': 'Organization',
                name: 'DevRhythm',
                url: SITE_URL,
              },
              image: OG_IMAGE,
              sameAs: [
                'https://github.com/anupam6335',
                'https://www.linkedin.com/in/anupamdebnath6335/',
                'https://leetcode.com/u/anupam_nlogn/',
                'https://anupamdebnath.vercel.app/',
              ],
              knowsAbout: [
                'Data Structures & Algorithms',
                'Spaced Repetition Systems',
                'Full-Stack Development',
                'Next.js',
                'React',
                'Node.js',
              ],
              description:
                'A web developer who built DevRhythm to fix his own broken DSA practice and help others build lasting coding habits through spaced repetition.',
            },
          }),
        }}
      />

      <Breadcrumb
        items={breadcrumbItems}
        renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>
            {props.children}
          </Link>
        )}
      />

      <AboutPageClient />
    </>
  );
}