'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useInView } from 'react-intersection-observer';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import type { ExecutionStatus } from '@/features/codeExecution/components/ExecutionStatusIndicator';

// Dynamically import the heavy CodeExecutionArea with SSR disabled
const CodeExecutionArea = dynamic(
  () => import('./CodeExecutionArea').then(mod => mod.CodeExecutionArea),
  { ssr: false, loading: () => <RightColumnSkeleton /> }
);

interface LazyRightColumnProps {
  questionId: string;
  defaultTestCases: any[];
  starterCodeByLanguage?: Record<string, string>;
  initialLanguage: string;
  initialCustomTestCases: any[];
  onRun: (code: string, language: string, testCases: any[]) => Promise<void>;
  isRunning: boolean;
  results?: any[];
  executionError?: string | null;
  onCodeChange: (code: string) => void;
  initialHistory: any[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  executionStatus?: ExecutionStatus;  // NEW: status for the indicator
}

export const LazyRightColumn: React.FC<LazyRightColumnProps> = (props) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px',
    threshold: 0,
  });

  const handlePreload = () => {
    import('./CodeExecutionArea');
  };

  return (
    <div ref={ref} onMouseEnter={handlePreload}>
      {inView ? <CodeExecutionArea {...props} /> : <RightColumnSkeleton />}
    </div>
  );
};

const RightColumnSkeleton: React.FC = () => (
  <div
    style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <SkeletonLoader variant="text" width={120} height={32} />
      <SkeletonLoader variant="text" width={200} height={32} />
    </div>
    <SkeletonLoader variant="custom" height={400} width="100%" />
    <div>
      <SkeletonLoader variant="text" width={100} height={24} />
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
        <SkeletonLoader variant="text" width="45%" height={60} />
        <SkeletonLoader variant="text" width="45%" height={60} />
      </div>
    </div>
  </div>
);