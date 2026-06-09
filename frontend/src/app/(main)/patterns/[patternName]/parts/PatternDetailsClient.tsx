'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePatternByName } from '@/features/patternMastery';
import { usePatternMastery } from '@/features/patternMastery';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import NotFoundPage from '@/shared/components/NotFoundPage/NotFoundPage';
import Modal from '@/shared/components/Modal';
import Button from '@/shared/components/Button';
import { slugify } from '@/shared/lib/stringUtils';
import MetricsCard from './MetricsCard';
import PatternHeader from './PatternHeader';
import RecentQuestionsList from './RecentQuestionsList';
import SuggestedQuestionsList from './SuggestedQuestionsList';
import OtherPatternsList from './OtherPatternsList';
import styles from './PatternDetailsClient.module.css';

interface PatternDetailsClientProps {
  patternName: string;
  requiresAuth?: boolean;
}

export default function PatternDetailsClient({ patternName, requiresAuth = false }: PatternDetailsClientProps) {
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(requiresAuth);

  const {
    data: pattern,
    isLoading: patternLoading,
    error: patternError,
  } = usePatternByName(patternName);

  const { data: otherPatternsData, isLoading: otherLoading } = usePatternMastery({
    limit: 20,
    sortBy: 'masteryRate',
    sortOrder: 'desc',
  });

  const isLoading = patternLoading || otherLoading;

  const handleLoginRedirect = () => {
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?returnTo=${returnTo}`;
  };

  // Show modal if authentication required
  if (requiresAuth) {
    return (
      <>
        <div className={styles.container} style={{ opacity: 0.5, pointerEvents: 'none' }}>
          <SkeletonLoader variant="custom" className={styles.metricsSkeleton} />
        </div>
        <Modal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          title="Authentication Required"
          size="sm"
          closeOnBackdropClick={false}
          closeOnEsc={false}
          showCloseButton={false}
        >
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p>You need to be logged in to view pattern details and track your progress.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Button variant="outline" onClick={() => router.push('/patterns')}>
                Browse Patterns
              </Button>
              <Button variant="primary" onClick={handleLoginRedirect}>
                Log In
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  if (isLoading) {
    return <PatternDetailsSkeleton />;
  }

  if (patternError || !pattern) {
    return (
      <NotFoundPage
        title="Pattern Not Found"
        message={`The pattern "${patternName}" could not be found.`}
        actions={[
          { text: 'View All Patterns', href: '/patterns', variant: 'primary' },
          { text: 'Browse Questions', href: '/questions', variant: 'outline' },
        ]}
      />
    );
  }

  const otherPatterns =
    otherPatternsData?.patterns?.filter((p) => p.patternName !== patternName).slice(0, 10) || [];

  return (
    <div className={styles.container}>
      {/* Hero section: 60% metrics / 40% name */}
      <div className={styles.hero}>
        <div className={styles.metricsWrapper}>
          <MetricsCard pattern={pattern} />
        </div>
        <div className={styles.nameWrapper}>
          <PatternHeader pattern={pattern} />
        </div>
      </div>

      <RecentQuestionsList questions={pattern.recentQuestions || []} />

      <SuggestedQuestionsList patternSlug={slugify(patternName)} />

      <OtherPatternsList patterns={otherPatterns} currentPatternName={patternName} />
    </div>
  );
}

function PatternDetailsSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.metricsWrapper}>
          <SkeletonLoader variant="custom" className={styles.metricsSkeleton} />
        </div>
        <div className={styles.nameWrapper}>
          <SkeletonLoader variant="custom" className={styles.headerSkeleton} />
        </div>
      </div>
      <SkeletonLoader variant="custom" className={styles.listSkeleton} />
      <SkeletonLoader variant="custom" className={styles.listSkeleton} />
      <SkeletonLoader variant="custom" className={styles.gridSkeleton} />
    </div>
  );
}