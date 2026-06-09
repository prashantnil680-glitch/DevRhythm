'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useMediaQuery } from '@/shared/hooks';
import Divider from '@/shared/components/Divider';
import Button from '@/shared/components/Button';
import Pagination from '@/shared/components/Pagination';
import { useQuestions } from '@/features/question/hooks/useQuestions';
import { useStatistics } from '@/features/question/hooks/useStatistics';
import { usePatterns } from '@/features/question/hooks/usePatterns';
import { useTags } from '@/features/question/hooks/useTags';
import { LazyQuestionList } from './LazyQuestionList';
import { QuestionFilterSidebar } from '@/app/(main)/questions/parts/QuestionFilterSidebar';
import { QuestionFilterDrawer } from '@/app/(main)/questions/parts/QuestionFilterDrawer';
import type { Filters } from '@/app/(main)/questions/parts/QuestionFilterControls';
import styles from './QuestionsPageClient.module.css';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';

const DEFAULT_FILTERS: Filters = {
  search: '',
  platform: '',
  difficulty: '',
  pattern: '',
  tags: [],
  sort: 'newest',
  status: '',
};

const sortParamMap: Record<string, { sortBy: string; sortOrder: 'asc' | 'desc' }> = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc' },
  oldest: { sortBy: 'createdAt', sortOrder: 'asc' },
  difficulty: { sortBy: 'difficulty', sortOrder: 'asc' },
  title: { sortBy: 'title', sortOrder: 'asc' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'title', label: 'Title' },
];

export const QuestionsPageClient: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // --- Restore last list URL on mount if current URL is bare ---
  useEffect(() => {
    const storedUrl = sessionStorage.getItem('lastQuestionsListUrl');
    if (storedUrl) {
      const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      // Only restore if current URL is the base path without any params
      // This avoids interfering with direct navigation that already has params
      if (currentUrl === pathname || currentUrl === '/questions') {
        sessionStorage.removeItem('lastQuestionsListUrl');
        router.replace(storedUrl);
        return;
      }
    }
  }, [pathname, searchParams, router]);

  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width: 480px)');
  const isTablet = useMediaQuery('(max-width: 768px)') && !isMobile;
  const isDesktop = !isMobile && !isTablet;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRestored = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const initialPageRestored = useRef(false);

  // Parse URL params into filters (including sort)
  const filters = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    const sort = params.get('sort') || DEFAULT_FILTERS.sort;
    return {
      search: params.get('search') || DEFAULT_FILTERS.search,
      platform: params.get('platform') || DEFAULT_FILTERS.platform,
      difficulty: params.get('difficulty') || DEFAULT_FILTERS.difficulty,
      pattern: params.get('pattern') || DEFAULT_FILTERS.pattern,
      tags: params.getAll('tags'),
      sort,
      status: params.get('status') || DEFAULT_FILTERS.status,
    };
  }, [searchParams]);

  // Update URL when filters change
  const updateFilters = (key: keyof Filters, value: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'tags') {
      params.delete('tags');
      (value as string[]).forEach((tag) => params.append('tags', tag));
    } else if (key === 'sort') {
      params.set('sort', value);
    } else if (key === 'status') {
      if (value && value !== '') {
        params.set('status', value);
      } else {
        params.delete('status');
      }
    } else {
      if (value && value !== '') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('?page=1');
  };

  // Pagination – read from URL
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  // --- Store current page in sessionStorage whenever it changes (including page 1) ---
  useEffect(() => {
    if (!isNaN(page)) {
      sessionStorage.setItem('questionsPage', page.toString());
    }
  }, [page]);

  // --- Restore page only when URL has NO page parameter ---
  useEffect(() => {
    if (initialPageRestored.current) return;
    const storedPage = sessionStorage.getItem('questionsPage');
    if (storedPage) {
      const storedPageNum = parseInt(storedPage, 10);
      const hasPageParam = searchParams.has('page');
      // Only restore if the URL doesn't already specify a page number
      if (!hasPageParam && storedPageNum > 1) {
        initialPageRestored.current = true;
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', storedPageNum.toString());
        router.replace(`?${params.toString()}`);
        // Clear the stored value after restoration to avoid interference on next visit
        sessionStorage.removeItem('questionsPage');
        return;
      }
    }
    initialPageRestored.current = true;
  }, [searchParams, router]);

  // Build params for useQuestions, including sort
  const queryParams = useMemo(() => {
    const params: any = { page, limit };
    if (filters.search) params.search = filters.search;
    if (filters.platform) params.platform = filters.platform;
    if (filters.difficulty) params.difficulty = filters.difficulty;
    if (filters.pattern) params.pattern = filters.pattern;
    if (filters.tags.length) params.tags = filters.tags;
    if (filters.status) params.status = filters.status;
    const sortParams = sortParamMap[filters.sort];
    if (sortParams) {
      params.sortBy = sortParams.sortBy;
      params.sortOrder = sortParams.sortOrder;
    }
    return params;
  }, [page, limit, filters]);

  const {
    data: questionsData,
    isLoading: questionsLoading,
    error: questionsError,
    refetch: refetchQuestions,
  } = useQuestions(queryParams);

  const { data: statsData } = useStatistics();
  const { data: patternsData } = usePatterns();
  const { data: tagsData } = useTags();

  const questions = questionsData?.questions ?? [];
  const pagination = questionsData?.pagination;

  // Options for dropdowns
  const platformOptions = useMemo(() => {
    if (!statsData) return [];
    return Object.keys(statsData.byPlatform).map((p) => ({ value: p, label: p }));
  }, [statsData]);

  const difficultyOptions = [
    { value: 'Easy', label: 'Easy' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Hard', label: 'Hard' },
  ];

  const patternOptions = useMemo(() => {
    return (patternsData ?? []).map((p) => ({ value: p, label: p }));
  }, [patternsData]);

  const tagOptions = useMemo(() => {
    return (tagsData ?? []).map((t) => ({ value: t, label: t }));
  }, [tagsData]);

  // Responsive sibling count for pagination
  const getSiblingCount = () => {
    if (isDesktop) return 2;
    if (isTablet) return 1;
    return 0;
  };
  const siblingCount = getSiblingCount();

  // Responsive pagination size
  const getPaginationSize = () => {
    if (isMobile) return 'sm';
    return 'md';
  };
  const paginationSize = getPaginationSize();

  // --- Scroll position persistence ---
  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      sessionStorage.setItem('questionsPageScrollY', window.scrollY.toString());
    }, 100);
  }, []);

  // Restore scroll position after data loads
  useEffect(() => {
    if (!questionsLoading && !scrollRestored.current && questions.length > 0) {
      const savedScrollY = sessionStorage.getItem('questionsPageScrollY');
      if (savedScrollY !== null) {
        const scrollY = parseInt(savedScrollY, 10);
        if (!isNaN(scrollY) && scrollY > 0) {
          window.scrollTo({ top: scrollY, behavior: 'instant' });
        }
        sessionStorage.removeItem('questionsPageScrollY');
      }
      scrollRestored.current = true;
    }
  }, [questionsLoading, questions.length]);

  // Attach scroll listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [handleScroll]);

  // Error state
  if (questionsError) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <h2>Failed to load questions</h2>
          <p>{(questionsError as Error).message || 'An unknown error occurred'}</p>
          <Button onClick={() => refetchQuestions()}>Retry</Button>
        </div>
      </div>
    );
  }

  // Range display
  const start = questions.length ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, pagination?.total ?? 0);
  const total = pagination?.total ?? 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Questions Bank</h1>
        <div className={styles.headerActions}>
          {!isDesktop && (
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
              Filter
            </Button>
          )}
          {isAuthenticated && (
            <Button asChild size={!isDesktop ? 'sm' : 'md'}>
              <Link href="/questions/create">Create New</Link>
            </Button>
          )}
        </div>
      </div>
      <Divider />

      {/* Desktop layout with sticky sidebar */}
      {isDesktop ? (
        <div className={styles.desktopLayout}>
          <div className={styles.sidebarWrapper}>
            <QuestionFilterSidebar
              filters={filters}
              onFilterChange={updateFilters}
              onClearFilters={clearFilters}
              stats={statsData}
              platformOptions={platformOptions}
              difficultyOptions={difficultyOptions}
              patternOptions={patternOptions}
              tagOptions={tagOptions}
              sortOptions={SORT_OPTIONS}
              isAuthenticated={isAuthenticated}
            />
          </div>
          <main className={styles.main}>
            <div className={styles.resultInfo}>
              <span>
                Showing {start}–{end} of {total} questions
              </span>
            </div>
            <LazyQuestionList questions={questions} isLoading={questionsLoading} />
            {pagination && pagination.pages > 1 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                siblingCount={siblingCount}
                size={paginationSize}
                onPageChange={(page) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('page', page.toString());
                  router.push(`?${params.toString()}`);
                }}
              />
            )}
          </main>
        </div>
      ) : (
        <>
          <div className={styles.mobileHeader}>
            <div className={styles.resultInfo}>
              <span>
                Showing {start}–{end} of {total} questions
              </span>
            </div>
            <div className={styles.sortRow}>
              <select
                value={filters.sort}
                onChange={(e) => updateFilters('sort', e.target.value)}
                className={styles.sortSelect}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <LazyQuestionList questions={questions} isLoading={questionsLoading} />
          {pagination && pagination.pages > 1 && (
            <div className={styles.paginationWrapper}>
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                siblingCount={siblingCount}
                size={paginationSize}
                onPageChange={(page) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('page', page.toString());
                  router.push(`?${params.toString()}`);
                }}
              />
            </div>
          )}
          <QuestionFilterDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            filters={filters}
            onFilterChange={updateFilters}
            onClearFilters={clearFilters}
            stats={statsData}
            platformOptions={platformOptions}
            difficultyOptions={difficultyOptions}
            patternOptions={patternOptions}
            tagOptions={tagOptions}
            sortOptions={SORT_OPTIONS}
            isAuthenticated={isAuthenticated}
          />
        </>
      )}
    </div>
  );
};