import { Suspense } from 'react';
import { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import Breadcrumb from '@/shared/components/Breadcrumb';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import { questionServiceServer } from '@/features/question/services/questionService.server';
import { QuestionDetailPageClient } from './parts/QuestionDetailPageClient';
import NotFoundPage from '@/shared/components/NotFoundPage';
import { ROUTES } from '@/shared/config/routes';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const question = await questionServiceServer.getQuestionBySlug(slug);
    const title = `${question.title} · ${question.difficulty} · ${question.platform} | DevRhythm`;
    const description = `Solve ${question.title} (${question.difficulty}) on ${question.platform}. Tags: ${question.tags?.slice(0, 5).join(', ') || 'coding problem'}. Practice with spaced repetition and track your progress.`;
    const keywords = [question.title, question.difficulty, question.platform, ...(question.tags || []), 'coding problem', 'DSA', 'algorithm'].join(', ');
    const canonicalUrl = `${SITE_URL}/questions/${slug}`;

    return {
      title,
      description,
      keywords,
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
        canonical: canonicalUrl,
      },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        siteName: 'DevRhythm',
        type: 'article',
        locale: 'en_US',
        authors: ['DevRhythm Team'],
        tags: question.tags || [],
        images: [
          {
            url: `${SITE_URL}/images/logos/og-question.png`,
            width: 1200,
            height: 630,
            alt: `${question.title} – Solve on DevRhythm`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [`${SITE_URL}/images/logos/og-question.png`],
        site: '@devrhythm',
      },
    };
  } catch (error) {
    return {
      title: 'Question Not Found | DevRhythm',
      description: 'The requested coding problem could not be found.',
      robots: 'noindex, nofollow',
    };
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = (questionTitle: string) => [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Questions', href: ROUTES.QUESTIONS.ROOT },
  { label: questionTitle },
];

function QuestionPageSkeleton() {
  return (
    <div className="devRhythmContainer" style={{ paddingTop: '2rem' }}>
      <SkeletonLoader variant="text" width="30%" height={24} style={{ marginBottom: '1rem' }} />
      <SkeletonLoader variant="text" width="80%" height={40} style={{ marginBottom: '1rem' }} />
      <SkeletonLoader variant="text" width="100%" height={20} count={3} style={{ marginBottom: '1rem' }} />
      <SkeletonLoader variant="custom" height={400} width="100%" />
    </div>
  );
}

// Generate schemas for the question
async function getQuestionSchemas(slug: string) {
  try {
    const question = await questionServiceServer.getQuestionBySlug(slug);
    const canonicalUrl = `${SITE_URL}/questions/${slug}`;
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Questions', item: `${SITE_URL}/questions` },
        { '@type': 'ListItem', position: 3, name: question.title, item: canonicalUrl },
      ],
    };
    const questionSchema = {
      '@context': 'https://schema.org',
      '@type': 'Question',
      name: question.title,
      text: question.contentRef?.substring(0, 200) || `Solve ${question.title} on ${question.platform}.`,
      keywords: question.tags?.join(', ') || '',
      author: {
        '@type': 'Organization',
        name: 'DevRhythm',
        url: SITE_URL,
      },
      datePublished: question.createdAt,
      educationalLevel: question.difficulty,
      about: {
        '@type': 'Thing',
        name: 'Coding Problem',
        description: `Practice ${question.title} to master ${question.tags?.join(', ') || 'DSA'} patterns.`,
      },
      learningResourceType: 'Coding Problem',
      teaches: question.tags || [],
    };
    const techArticleSchema = {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: question.title,
      description: `Solve ${question.title} (${question.difficulty}) on ${question.platform}.`,
      url: canonicalUrl,
      author: {
        '@type': 'Organization',
        name: 'DevRhythm',
      },
      datePublished: question.createdAt,
      articleSection: 'Coding Problems',
      dependencies: question.tags?.join(', ') || '',
      proficiencyLevel: question.difficulty === 'Hard' ? 'Advanced' : question.difficulty === 'Medium' ? 'Intermediate' : 'Beginner',
    };
    return { breadcrumbSchema, questionSchema, techArticleSchema };
  } catch {
    return null;
  }
}

export default async function QuestionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  let question;
  let similarQuestions: any[] = [];

  // 1. Fetch main question – if fails, show custom NotFoundPage
  try {
    question = await questionServiceServer.getQuestionBySlug(slug);
  } catch (error) {
    console.error(`Question not found for slug: ${slug}`, error);
    return (
      <NotFoundPage
        title="Question Not Found"
        message="The question you're looking for doesn't exist or may have been removed."
        actions={[
          { text: 'Create Question', href: '/questions/create', variant: 'primary' as const },
          { text: 'Browse All Questions', href: '/questions', variant: 'outline' as const },
        ]}
      />
    );
  }

  // 2. Fetch similar questions – if fails, just log and continue with empty array
  try {
    similarQuestions = await questionServiceServer.getSimilarQuestions(question._id);
  } catch (error) {
    console.error(`Failed to fetch similar questions for question ID: ${question._id}`, error);
  }

  const schemas = await getQuestionSchemas(slug);
  const canonicalUrl = `${SITE_URL}/questions/${slug}`;

  return (
    <>
      {schemas && (
        <>
          <Script
            id="schema-breadcrumb"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.breadcrumbSchema) }}
          />
          <Script
            id="schema-question"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.questionSchema) }}
          />
          <Script
            id="schema-techarticle"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.techArticleSchema) }}
          />
        </>
      )}
      <Breadcrumb
        items={breadcrumbItems(question.title)}
        renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>
            {props.children}
          </Link>
        )}
      />
      <Suspense fallback={<QuestionPageSkeleton />}>
        <QuestionDetailPageClient
          initialQuestion={question}
          initialSimilarQuestions={similarQuestions}
        />
      </Suspense>
    </>
  );
}