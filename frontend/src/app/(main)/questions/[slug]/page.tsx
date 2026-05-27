import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/shared/components/Breadcrumb';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import { questionServiceServer } from '@/features/question/services/questionService.server';
import { QuestionDetailPageClient } from './parts/QuestionDetailPageClient';
import NotFoundPage from '@/shared/components/NotFoundPage';
import { ROUTES } from '@/shared/config/routes';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const question = await questionServiceServer.getQuestionBySlug(slug);
    return {
      title: `${question.title} · DevRhythm`,
      description: `Solve ${question.title} on ${question.platform}. ${question.difficulty} · ${question.tags.join(', ')}`,
    };
  } catch (error) {
    return {
      title: 'Question Not Found',
      description: 'The requested question could not be found.',
    };
  }
}

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
    // similarQuestions remains []
  }

  return (
    <>
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