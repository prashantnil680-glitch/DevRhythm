'use client';

import { usePatternByName } from '@/features/patternMastery';
import { useQuestions } from '@/features/question';
import { usePatternMastery } from '@/features/patternMastery';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import NotFoundPage from '@/shared/components/NotFoundPage/NotFoundPage';
import MetricsCard from './MetricsCard';
import PatternHeader from './PatternHeader';
import RecentQuestionsList from './RecentQuestionsList';
import SuggestedQuestionsList from './SuggestedQuestionsList';
import OtherPatternsList from './OtherPatternsList';
import styles from './PatternDetailsClient.module.css';

interface PatternDetailsClientProps {
  patternName: string;
}

export default function PatternDetailsClient({ patternName }: PatternDetailsClientProps) {
  const {
    data: pattern,
    isLoading: patternLoading,
    error: patternError,
  } = usePatternByName(patternName);

  const { data: questionsData, isLoading: questionsLoading } = useQuestions({
    pattern: patternName,
    limit: 20,
  });

  const { data: otherPatternsData, isLoading: otherLoading } = usePatternMastery({
    limit: 20,
    sortBy: 'masteryRate',
    sortOrder: 'desc',
  });

  if (patternLoading || questionsLoading || otherLoading) {
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

  const unsolvedQuestions =
    questionsData?.questions?.filter((q) => !q.isSolved).slice(0, 5) || [];

  const otherPatterns =
    otherPatternsData?.patterns?.filter((p) => p.patternName !== patternName).slice(0, 10) || [];


    // console.log("===========pattern ", pattern);
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

      <SuggestedQuestionsList
        questions={unsolvedQuestions}
        patternName={patternName}
      />

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