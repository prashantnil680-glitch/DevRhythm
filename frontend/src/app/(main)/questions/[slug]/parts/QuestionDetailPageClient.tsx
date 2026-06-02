'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/hooks/useSession';
import { useMarkRevision } from '@/features/revision/hooks/useMarkRevision';
import { useSaveNotes } from '@/features/progress/hooks/useSaveNotes';
import { useRunCode } from '@/features/codeExecution/hooks/useRunCode';
import { useDeleteQuestion } from '@/features/question/hooks/useDeleteQuestion';
import { useQuestionDetails } from '@/features/question/hooks/useQuestionDetails';
import { useUpdateStatus } from '@/features/progress/hooks/useUpdateStatus';
import { useSimilarQuestions } from '@/features/question/hooks/useSimilarQuestions';
import { useTimeTracker } from '@/features/revision/hooks/useTimeTracker';
import { questionsKeys, slugify } from '@/shared/lib';
import Button from '@/shared/components/Button';
import Tabs from '@/shared/components/Tabs';
import Modal from '@/shared/components/Modal';
import { toast } from '@/shared/components/Toast';
import { FiExternalLink, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import type { Question } from '@/shared/types';
import { ProgressCard } from './ProgressCard';
import { SimilarQuestionsGrid } from './SimilarQuestionsGrid';
import { EditableNotes } from './EditableNotes';
import { QuestionDetailSkeleton } from './QuestionDetailSkeleton';
import { LazyRightColumn } from './LazyRightColumn';
import { LazyRevisionTimeline } from './LazyRevisionTimeline';
import styles from './QuestionDetailPage.module.css';
import Link from 'next/link';
import SkeletonLoader from '@/shared/components/SkeletonLoader';

interface QuestionDetailPageClientProps {
  initialQuestion: Question;
  initialSimilarQuestions: Question[];
}

function decodeEscapedString(str: string): string {
  if (!str) return '';

  let result = str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

  return result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function prepareHtmlContent(raw: string): string {
  if (!raw) return '';

  const decoded = decodeEscapedString(raw);

  if (decoded.includes('<') && decoded.includes('>')) {
    return decoded;
  }

  const escaped = decoded
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return `<div style="white-space: pre-wrap;">${escaped.replace(/\n/g, '<br>')}</div>`;
}

function formatExamplePreBlocks(html: string): string {
  if (!html) return html;

  return html.replace(/<pre>([\s\S]*?)<\/pre>/g, (match, preContent) => {
    const parts: string[] = [];
    const labelRegex = /<strong>(Input|Output|Explanation):<\/strong>\s*([\s\S]*?)(?=<strong>(?:Input|Output|Explanation):<\/strong>|$)/g;
    let m: RegExpExecArray | null;
    while ((m = labelRegex.exec(preContent)) !== null) {
      const label = m[1];
      let content = m[2].trim();
      parts.push(`<div style="margin-bottom: 1rem;"><strong>${label}:</strong><br>${content}</div>`);
    }
    if (parts.length === 0) return match;
    return `<pre>${parts.join('')}</pre>`;
  });
}

export const QuestionDetailPageClient: React.FC<QuestionDetailPageClientProps> = ({
  initialQuestion,
  initialSimilarQuestions,
}) => {
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useSession();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [editorCode, setEditorCode] = useState<string>('');
  const [isFullWindow, setIsFullWindow] = useState(false);
  const [leftActiveTab, setLeftActiveTab] = useState('problem');
  const [rightActiveTab, setRightActiveTab] = useState('code');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [persistedResults, setPersistedResults] = useState<any[] | undefined>(undefined);

  // Client-side fallback for similar questions
  const [similarQuestions, setSimilarQuestions] = useState(initialSimilarQuestions);
  const [shouldFetchSimilar, setShouldFetchSimilar] = useState(initialSimilarQuestions.length === 0);

  const {
    data: clientSimilarQuestions,
    isLoading: clientSimilarLoading,
    error: clientSimilarError,
  } = useSimilarQuestions(initialQuestion._id, shouldFetchSimilar);

  useEffect(() => {
    if (clientSimilarQuestions && clientSimilarQuestions.length > 0) {
      setSimilarQuestions(clientSimilarQuestions);
      setShouldFetchSimilar(false);
    } else if (clientSimilarError && !clientSimilarLoading) {
      // If fetch fails, keep empty and stop retrying
      setShouldFetchSimilar(false);
    }
  }, [clientSimilarQuestions, clientSimilarLoading, clientSimilarError]);

  const updateStatusMutation = useUpdateStatus(initialQuestion._id);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(`lastResult-${initialQuestion._id}`);
    if (stored) {
      try {
        setPersistedResults(JSON.parse(stored));
      } catch (e) {}
    }
  }, [initialQuestion._id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullWindow) setIsFullWindow(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullWindow]);

  const {
    data: details,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuestionDetails(initialQuestion._id, { enabled: isAuthenticated && mounted });

  const progress = details?.progress ?? undefined;
  const revision = details?.revision ?? undefined;
  const codeHistory = details?.codeExecutionHistory ?? [];
  const starterCode = details?.question?.starterCode;

  const markRevisionMutation = useMarkRevision(initialQuestion._id);
  const saveNotesMutation = useSaveNotes(initialQuestion._id);
  const runCodeMutation = useRunCode();
  const deleteQuestionMutation = useDeleteQuestion();

  useEffect(() => {
    if (runCodeMutation.data?.results) {
      const resultsToStore = runCodeMutation.data.results;
      setPersistedResults(resultsToStore);
      localStorage.setItem(`lastResult-${initialQuestion._id}`, JSON.stringify(resultsToStore));
    }
  }, [runCodeMutation.data, initialQuestion._id]);

  const handleMarkRevised = useCallback(async () => {
    try {
      await markRevisionMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: [...questionsKeys.detail(initialQuestion._id), 'details'] });
    } catch (error) {
      console.error('Mark revision error:', error);
    }
  }, [markRevisionMutation, queryClient, initialQuestion._id]);

  const handleMarkSolved = useCallback(async () => {
    try {
      await updateStatusMutation.mutateAsync('Solved');
      queryClient.invalidateQueries({ queryKey: [...questionsKeys.detail(initialQuestion._id), 'details'] });
    } catch (error) {
      console.error('Mark solved error:', error);
    }
  }, [updateStatusMutation, queryClient, initialQuestion._id]);

  const handleSaveNotes = useCallback(async (notes: string, keyInsights: string) => {
    try {
      await saveNotesMutation.mutateAsync({ notes, keyInsights });
      queryClient.invalidateQueries({ queryKey: [...questionsKeys.detail(initialQuestion._id), 'details'] });
    } catch (error) {
      console.error('Save notes error:', error);
    }
  }, [saveNotesMutation, queryClient, initialQuestion._id]);

  const handleRunCode = useCallback(async (code: string, language: string, testCases: Array<{ stdin: string; expected: string }>) => {
    const sanitizedTestCases = testCases.map(({ stdin, expected }) => ({ stdin, expected }));
    try {
      await runCodeMutation.mutateAsync({
        questionId: initialQuestion._id,
        code,
        language,
        testCases: sanitizedTestCases,
      });
      await queryClient.invalidateQueries({ queryKey: [...questionsKeys.detail(initialQuestion._id), 'details'] });
      await queryClient.refetchQueries({ queryKey: [...questionsKeys.detail(initialQuestion._id), 'details'] });
    } catch (error) {
      console.error('Run code error:', error);
    }
  }, [initialQuestion._id, runCodeMutation, queryClient]);

  const handleEditQuestion = useCallback(() => {
    router.push(`/questions/${initialQuestion._id}/edit`);
  }, [initialQuestion._id, router]);

  const handleDeleteClick = useCallback(() => setDeleteModalOpen(true), []);
  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteQuestionMutation.mutateAsync(initialQuestion._id);
      toast.success('Question moved to deleted.');
      router.push('/questions');
    } catch (error) {
      toast.error('Failed to delete question.');
    } finally {
      setDeleteModalOpen(false);
    }
  }, [deleteQuestionMutation, initialQuestion._id, router]);

  const toggleFullWindow = useCallback(() => setIsFullWindow(prev => !prev), []);

  const defaultTestCases = initialQuestion.testCases || [];
  const initialCustomTestCases = progress?.customTestCases || [];

  const originalHtml = useMemo(() => {
    if (!initialQuestion.contentRef) return '';
    return prepareHtmlContent(initialQuestion.contentRef);
  }, [initialQuestion.contentRef]);

  const personalHtml = useMemo(() => {
    if (!progress?.personalContentRef) return '';
    return prepareHtmlContent(progress.personalContentRef);
  }, [progress?.personalContentRef]);

  const combinedHtml = useMemo(() => {
    let html = '';
    if (originalHtml) html = originalHtml;
    if (personalHtml) {
      html = html
        ? `${html}<hr class="${styles.separator}" /><div class="${styles.personalNotes}"><h3>Personal Notes</h3>${personalHtml}</div>`
        : personalHtml;
    }
    return formatExamplePreBlocks(html);
  }, [originalHtml, personalHtml]);

  const userStatus = useMemo(() => {
    if (!isAuthenticated) return null;
    if (detailsError) return 'Not Started';
    return progress?.status || 'Not Started';
  }, [progress, detailsError, isAuthenticated]);

  const getStatusClass = (status?: string) => {
    if (!status) return '';
    const statusMap: Record<string, string> = {
      'Not Started': 'notstarted',
      Attempted: 'attempted',
      Solved: 'solved',
      Mastered: 'mastered',
    };
    return styles[statusMap[status] || ''];
  };

  const isManual = initialQuestion.source === 'manual';
  const isCreator = isManual && initialQuestion.createdBy === currentUser?._id;

  const leftTabs = [
    { id: 'problem', label: 'Problem Statement' },
    { id: 'revision', label: 'Revision Timeline' },
    { id: 'notes', label: 'Notes' },
  ];

  useTimeTracker(initialQuestion._id, isAuthenticated && mounted);

  // Build URL for "View all questions" with current question's tags
  const viewAllQuestionsUrl = useMemo(() => {
    if (!initialQuestion.tags || initialQuestion.tags.length === 0) {
      return '/questions?page=1';
    }
    const tagsParams = initialQuestion.tags.map(tag => `tags=${encodeURIComponent(tag)}`).join('&');
    return `/questions?page=1&${tagsParams}`;
  }, [initialQuestion.tags]);

  const isLoading = detailsLoading && !details;

  if (isLoading) return <QuestionDetailSkeleton />;

  return (
    <div className={isFullWindow ? styles.fullWindow : styles.page}>
    {/* Header */}
    <div className={styles.header}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>{initialQuestion.title}</h1>
        {mounted && isAuthenticated && userStatus && (
          <span className={`${styles.statusBadge} ${getStatusClass(userStatus)}`}>
            {userStatus}
          </span>
        )}
      </div>
      <div className={styles.actionButtons}>
        <div className={styles.fullWindowButtonWrapper}>
          <div className={styles.rippleRing} />
          <div className={styles.rippleRing} />
          <div className={styles.rippleRing} />
          <Button
            className={styles.fullWindowButton}
            variant="ghost"
            size="sm"
            onClick={toggleFullWindow}
            leftIcon={isFullWindow ? <FiMinimize2 /> : <FiMaximize2 />}
          >
            {isFullWindow ? 'Exit' : 'Full'}
          </Button>
        </div>
        {mounted && isAuthenticated && isCreator && (
          <>
            <Button variant="outline" size="sm" onClick={handleEditQuestion}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteClick}>
              Delete
            </Button>
          </>
        )}
      </div>
    </div>

    {/* Metadata bar  */}
    <div className={styles.metadataBar}>
      <Link href={`/questions?platform=${encodeURIComponent(initialQuestion.platform)}&page=1`} className={styles.metadataChip}>
        {initialQuestion.platform}
      </Link>
      <Link href={`/questions?difficulty=${initialQuestion.difficulty}&page=1`} className={`${styles.metadataChip} ${styles.difficultyChip}`} data-difficulty={initialQuestion.difficulty.toLowerCase()}>
        {initialQuestion.difficulty}
      </Link>
        {initialQuestion.tags.map(tag => {
          const slug = slugify(tag);
          return (
            <Link key={tag} href={`/patterns/${slug}`} className={styles.metadataChip}>
              #{tag}
            </Link>
          );
        })}
      <a href={initialQuestion.problemLink} target="_blank" rel="noopener noreferrer" className={styles.metadataChip}>
        Solve on {initialQuestion.platform} <FiExternalLink size={10} />
      </a>
      {initialQuestion.solutionLinks && initialQuestion.solutionLinks.length > 0 && (
        <div className={styles.solutionDropdown}>
          <span className={styles.metadataChip}>
            🔗 Solutions
            <select className={styles.solutionSelect} onChange={(e) => window.open(e.target.value, '_blank')} value="">
              <option value="" disabled>Select solution</option>
              {initialQuestion.solutionLinks.map((link, idx) => (
                <option key={idx} value={link}>Solution {idx + 1}</option>
              ))}
            </select>
          </span>
        </div>
      )}
    </div>

      {/* Progress Card */}
      {mounted && isAuthenticated && (
        <div className={styles.progressCardWrapper}>
          <ProgressCard
            progress={progress}
            revision={revision}
            isLoading={isLoading}
            onMarkRevised={handleMarkRevised}
            isMarking={markRevisionMutation.isPending}
            onMarkSolved={handleMarkSolved}
            isMarkingSolved={updateStatusMutation.isPending}
            questionId={initialQuestion._id}
          />
        </div>
      )}

      {/* Two‑column layout */}
      <div className={styles.pageLayout}>
        {/* LEFT COLUMN */}
        <div className={styles.leftColumn}>
          <div className={styles.problemStatement}>
            <Tabs tabs={leftTabs} activeTab={leftActiveTab} onChange={setLeftActiveTab} variant="pills" />
            <div className={styles.tabContent}>
              {leftActiveTab === 'problem' && (
                <div className={styles.problemContent}>
                  {combinedHtml ? (
                    <div className={styles.content} dangerouslySetInnerHTML={{ __html: combinedHtml }} />
                  ) : (
                    <p className={styles.fallback}>Problem statement not available.</p>
                  )}
                </div>
              )}
              {leftActiveTab === 'revision' && (
                <LazyRevisionTimeline revision={revision} questionId={initialQuestion._id} />
              )}
              {leftActiveTab === 'notes' && (
                <EditableNotes
                  initialNotes={progress?.notes}
                  initialKeyInsights={progress?.keyInsights}
                  onSave={handleSaveNotes}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN – Lazy loaded with Intersection Observer */}
        <div className={styles.rightColumn}>
          <LazyRightColumn
            questionId={initialQuestion._id}
            defaultTestCases={defaultTestCases}
            starterCodeByLanguage={starterCode}
            initialLanguage={progress?.savedCode?.language || 'python'}
            initialCustomTestCases={initialCustomTestCases}
            onRun={handleRunCode}
            isRunning={runCodeMutation.isPending}
            results={persistedResults}
            onCodeChange={setEditorCode}
            initialHistory={codeHistory}
            activeTab={rightActiveTab}
            onTabChange={setRightActiveTab}
          />
        </div>
      </div>

      {/* Similar Questions - with client-side fallback */}
      <div className={styles.similarSection}>
        {similarQuestions.length > 0 ? (
          <SimilarQuestionsGrid
            questions={similarQuestions}
            viewAllHref={viewAllQuestionsUrl}
          />
        ) : clientSimilarLoading ? (
          <div className={styles.similarLoadingGrid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonLoader key={i} variant="custom" className={styles.skeletonSimilarCard} />
            ))}
          </div>
        ) : (
          <div className={styles.noSimilarMessage}>
            <p>No similar questions found.</p>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Question"
        size="sm"
        closeOnBackdropClick
        closeOnEsc
        showCloseButton
        footer={
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="error" onClick={handleConfirmDelete}>Delete</Button>
          </div>
        }
      >
        <p>Are you sure you want to delete this question?</p>
        <p className={styles.modalNote}>
          The question will be moved to the deleted page, where you can restore it later if needed.
        </p>
      </Modal>
    </div>
  );
};