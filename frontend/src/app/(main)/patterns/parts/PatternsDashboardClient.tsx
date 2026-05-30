'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiGrid,
  FiCheckCircle,
  FiStar,
  FiBarChart2,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiBookOpen,
  FiZap,
  FiAward,
  FiChevronDown,
  FiLoader,
} from 'react-icons/fi';
import { useMediaQuery } from '@/shared/hooks';
import {
  usePatternStats,
  useStrongestPatterns,
  useWeakestPatterns,
  usePatternMastery,
} from '@/features/patternMastery';
import { usePatterns } from '@/features/question/hooks/usePatterns';
import ConfidenceStars from '@/shared/components/ConfidenceStars';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import NoRecordFound from '@/shared/components/NoRecordFound';
import { slugify } from '@/shared/lib/stringUtils';
import type { PatternMastery } from '@/shared/types';
import styles from './PatternsDashboardClient.module.css';
import Tooltip from '@/shared/components/Tooltip';

const INITIAL_ALL_PATTERNS_VISIBLE = 20;
const ALL_PATTERNS_INCREMENT = 20;
const MASTER_PAGE_SIZE = 10;

type TabType = 'master' | 'all';

// ========== Helper Components (unchanged) ==========

const TrendIndicator: React.FC<{ improvementRate: number }> = ({ improvementRate }) => {
  const formattedRate = Math.abs(improvementRate).toFixed(1);
  if (improvementRate > 0) {
    return (
      <span className={styles.trendUp}>
        <FiTrendingUp /> +{formattedRate}%
      </span>
    );
  }
  if (improvementRate < 0) {
    return (
      <span className={styles.trendDown}>
        <FiTrendingDown /> {formattedRate}%
      </span>
    );
  }
  return (
    <span className={styles.trendNeutral}>
      <FiMinus /> 0%
    </span>
  );
};

const formatPercentage = (value: number): string => {
  if (value === undefined || value === null) return '0';
  return value.toFixed(1);
};

const formatSolvedText = (count: number): string => {
  return `${count} question${count !== 1 ? 's' : ''} solved`;
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  value: number;
  label: string;
  rotation: string;
}> = ({ icon, value, label, rotation }) => (
  <div className={styles.statCard} style={{ transform: `rotate(${rotation})` }}>
    <div className={styles.statIcon}>{icon}</div>
    <div className={styles.statValue}>{value.toLocaleString()}</div>
    <div className={styles.statLabel}>{label}</div>
  </div>
);

const DifficultyDot: React.FC<{ difficulty: 'Easy' | 'Medium' | 'Hard' }> = ({ difficulty }) => {
  const color = {
    Easy: '#2e7d32',
    Medium: '#ed6c02',
    Hard: '#d32f2f',
  }[difficulty];
  return <span className={styles.difficultyDot} style={{ backgroundColor: color }} title={difficulty} />;
};

const StrongestCard: React.FC<{ pattern: PatternMastery }> = ({ pattern }) => {
  const recent = pattern.recentQuestions?.slice(0, 3) || [];
  const patternSlug = slugify(pattern.patternName);
  return (
    <div className={styles.strongestCard}>
      <div className={styles.heroBadge}>
        <FiStar className={styles.badgeIcon} /> strongest pattern
      </div>
      <Link href={`/patterns/${patternSlug}`} className={styles.heroTitleLink}>
        <h2 className={styles.heroTitle}>{pattern.patternName}</h2>
      </Link>
      <div className={styles.statPills}>
        <div className={styles.statPill}>
          <FiZap className={styles.statPillIcon} />
          <span className={styles.statPillValue}>{formatPercentage(pattern.masteryRate)}%</span>
          <span className={styles.statPillLabel}>mastery</span>
        </div>
        <div className={styles.statPill}>
          <FiStar className={styles.statPillIcon} />
          <span className={styles.statPillValue}>{pattern.confidenceLevel}/5</span>
          <span className={styles.statPillLabel}>confidence</span>
        </div>
        <div className={styles.statPill}>
          <FiBookOpen className={styles.statPillIcon} />
          <span className={styles.statPillValue}>{pattern.solvedCount}</span>
          <span className={styles.statPillLabel}>solved</span>
        </div>
        <div className={styles.statPill}>
          <FiAward className={styles.statPillIcon} />
          <span className={styles.statPillValue}>{pattern.masteredCount}</span>
          <span className={styles.statPillLabel}>mastered</span>
        </div>
      </div>
      {recent.length > 0 && (
        <div className={styles.recentSection}>
          <div className={styles.recentTitle}>
            <FiBookOpen className={styles.recentIcon} /> recent solved
          </div>
          <div className={styles.recentList}>
            {recent.map((q, idx) => (
              <div key={idx} className={styles.recentItem}>
                <span className={styles.recentConnector}>╰─</span>
                <DifficultyDot difficulty={q.difficulty} />
                <Link href={`/questions/${q.platformQuestionId}`} className={styles.recentLink}>
                  {q.title}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const WeakestCard: React.FC<{ pattern: PatternMastery }> = ({ pattern }) => {
  const recent = pattern.recentQuestions?.slice(0, 2) || [];
  const patternSlug = slugify(pattern.patternName);
  return (
    <div className={styles.weakestCard}>
      <div className={styles.heroBadge}>
        <FiBarChart2 className={styles.badgeIcon} /> weakest pattern
      </div>
      <Link href={`/patterns/${patternSlug}`} className={styles.heroTitleLink}>
        <h3 className={styles.weakestTitle}>{pattern.patternName}</h3>
      </Link>
      <div className={styles.statPills}>
        <div className={styles.statPill}>
          <FiBookOpen className={styles.statPillIcon} />
          <span className={styles.statPillValue}>{pattern.solvedCount}</span>
          <span className={styles.statPillLabel}>solved</span>
        </div>
        <div className={styles.statPill}>
          <FiAward className={styles.statPillIcon} />
          <span className={styles.statPillValue}>{pattern.masteredCount}</span>
          <span className={styles.statPillLabel}>mastered</span>
        </div>
        <div className={styles.statPill}>
          <FiStar className={styles.statPillIcon} />
          <span className={styles.statPillValue}>{pattern.confidenceLevel}/5</span>
          <span className={styles.statPillLabel}>confidence</span>
        </div>
      </div>
      {recent.length > 0 && (
        <div className={styles.recentSection}>
          <div className={styles.recentTitle}>
            <FiBookOpen className={styles.recentIcon} /> recent solved
          </div>
          <div className={styles.recentList}>
            {recent.map((q, idx) => (
              <div key={idx} className={styles.recentItem}>
                <span className={styles.recentConnector}>╰─</span>
                <DifficultyDot difficulty={q.difficulty} />
                <Link href={`/questions/${q.platformQuestionId}`} className={styles.recentLink}>
                  {q.title}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PatternRow: React.FC<{ pattern: PatternMastery }> = ({ pattern }) => {
  const patternSlug = slugify(pattern.patternName);
  return (
    <div className={styles.patternRow}>
      <div className={styles.patternInfo}>
        <Link href={`/patterns/${patternSlug}`} className={styles.patternName}>
          {pattern.patternName}
        </Link>
        <div className={styles.patternMeta}>
          <span>{formatSolvedText(pattern.solvedCount)}</span>
          <span className={styles.metaSeparator}>·</span>
          <span>{pattern.masteredCount} mastered</span>
          <span className={styles.metaSeparator}>·</span>
          <span>mastery {formatPercentage(pattern.masteryRate)}%</span>
          <span className={styles.metaSeparator}>·</span>
          <ConfidenceStars level={pattern.confidenceLevel} size={14} />
        </div>
      </div>
      <div className={styles.patternTrend}>
        <Tooltip content="Improvement rate over the last 30 days">
          <TrendIndicator improvementRate={pattern.trend?.improvementRate || 0} />
        </Tooltip>
      </div>
    </div>
  );
};

// ========== All Patterns Card ==========
const AllPatternCard: React.FC<{ patternName: string }> = ({ patternName }) => {
  const patternSlug = slugify(patternName);
  return (
    <Link href={`/patterns/${patternSlug}`} className={styles.allPatternCardLink}>
      <div className={styles.allPatternCard}>
        <span className={styles.allPatternName}>{patternName}</span>
      </div>
    </Link>
  );
};

interface PatternsDashboardClientProps {
  initialData?: {
    stats: any;
    strongest: PatternMastery[];
    weakest: PatternMastery[];
    patterns: any;
  } | null;
}

export default function PatternsDashboardClient({ initialData }: PatternsDashboardClientProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 940px)');
  const [activeTab, setActiveTab] = useState<TabType>('master');
  const [allPatternsVisible, setAllPatternsVisible] = useState(INITIAL_ALL_PATTERNS_VISIBLE);
  const listHeaderRef = useRef<HTMLDivElement>(null);

  // ---------- Master tab state (show more / infinite load) ----------
  const [masterPatterns, setMasterPatterns] = useState<PatternMastery[]>([]);
  const [masterCurrentPage, setMasterCurrentPage] = useState(1);
  const [masterTotalPages, setMasterTotalPages] = useState(1);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterLoadingMore, setMasterLoadingMore] = useState(false);
  const [masterHasMore, setMasterHasMore] = useState(true);
  const [masterError, setMasterError] = useState<Error | null>(null);

  // ---------- All patterns data (unchanged) ----------
  const {
    data: allPatternsList,
    isLoading: allPatternsLoading,
    error: allPatternsError,
    refetch: refetchAllPatterns,
  } = usePatterns();

  // ---------- Stats & strongest/weakest (unchanged) ----------
  const { data: statsData, isLoading: statsLoading } = usePatternStats();
  const { data: strongestData, isLoading: strongestLoading } = useStrongestPatterns(1);
  const { data: weakestData, isLoading: weakestLoading } = useWeakestPatterns(1);

  const stats = statsData ?? initialData?.stats;
  const strongest = strongestData?.[0] ?? initialData?.strongest?.[0];
  const weakest = weakestData?.[0] ?? initialData?.weakest?.[0];
  const allPatterns = allPatternsList ?? [];
  const totalPatternsCount = allPatterns.length;

  const totalSolvedCount = stats?.totalSolved ?? 0;
  const totalMasteredCount = stats?.totalMastered ?? 0;
  const avgConfidence = stats?.averageConfidence ?? 0;
  const totalPatternsStat = stats?.totalPatterns ?? 0;

  // ---------- Helper: fetch a specific page of master patterns ----------
  const fetchMasterPage = useCallback(
    async (page: number, isLoadMore = false) => {
      if (isLoadMore) {
        setMasterLoadingMore(true);
      } else {
        setMasterLoading(true);
      }
      setMasterError(null);
      try {
        // Use the existing hook's underlying service? We'll import the service directly to avoid hook restrictions.
        // Instead, we'll use the same patternMasteryService.
        const { patternMasteryService } = await import('@/features/patternMastery');
        const response = await patternMasteryService.getPatternMasteryList({
          page,
          limit: MASTER_PAGE_SIZE,
          sortBy: 'confidenceLevel',
          sortOrder: 'desc',
        });
        const fetchedPatterns = response.patterns || [];
        // Filter only patterns with solvedCount > 0 (attempted patterns)
        const filtered = fetchedPatterns.filter((p: PatternMastery) => p.solvedCount > 0);
        if (isLoadMore) {
          setMasterPatterns((prev) => [...prev, ...filtered]);
        } else {
          setMasterPatterns(filtered);
        }
        const total = response.pagination?.total ?? 0;
        const totalPages = Math.ceil(total / MASTER_PAGE_SIZE);
        setMasterTotalPages(totalPages);
        setMasterHasMore(page < totalPages);
        setMasterCurrentPage(page);
      } catch (err) {
        console.error('Failed to fetch master patterns:', err);
        setMasterError(err as Error);
      } finally {
        if (isLoadMore) {
          setMasterLoadingMore(false);
        } else {
          setMasterLoading(false);
        }
      }
    },
    []
  );

  // ---------- Reset master patterns when tab becomes active ----------
  useEffect(() => {
    if (activeTab === 'master') {
      // Reset state
      setMasterPatterns([]);
      setMasterCurrentPage(1);
      setMasterHasMore(true);
      setMasterError(null);
      fetchMasterPage(1, false);
    }
  }, [activeTab, fetchMasterPage]);

  // ---------- Load more (show more) ----------
  const handleLoadMoreMaster = () => {
    if (masterLoadingMore || !masterHasMore) return;
    fetchMasterPage(masterCurrentPage + 1, true);
  };

  // ---------- All Patterns load more ----------
  const handleLoadMoreAllPatterns = () => {
    setAllPatternsVisible((prev) => Math.min(prev + ALL_PATTERNS_INCREMENT, totalPatternsCount));
  };

  // ---------- Tab change ----------
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'all') {
      setAllPatternsVisible(INITIAL_ALL_PATTERNS_VISIBLE);
    }
  };

  // ---------- Header rendering ----------
  const renderListHeader = () => {
    if (activeTab === 'master') {
      return (
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>
            Attempted Pattern · {masterPatterns.length}
          </h2>
          <span className={styles.trendHeaderLabel}>Improvement Rate</span>
        </div>
      );
    } else {
      return (
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>All Patterns · {totalPatternsCount}</h2>
        </div>
      );
    }
  };

  // ---------- Content rendering ----------
  const renderContent = () => {
    if (activeTab === 'master') {
      if (masterLoading && masterPatterns.length === 0) {
        return (
          <div className={styles.patternList}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLoader key={i} variant="custom" className={styles.patternRowSkeleton} />
            ))}
          </div>
        );
      }
      if (masterError) {
        return (
          <NoRecordFound
            message="Could not load pattern mastery data. Please try again later."
            icon={<FiBarChart2 />}
          />
        );
      }
      if (masterPatterns.length === 0 && !masterLoading) {
        return (
          <NoRecordFound
            message="You haven't solved any pattern questions yet. Start solving to see your attempted patterns!"
            icon={<FiGrid />}
          />
        );
      }
      return (
        <>
          <div className={styles.patternList}>
            {masterPatterns.map((pattern) => (
              <PatternRow key={pattern._id} pattern={pattern} />
            ))}
          </div>
          {masterHasMore && (
            <div className={styles.loadMoreWrapper}>
              <button
                onClick={handleLoadMoreMaster}
                disabled={masterLoadingMore}
                className={styles.loadMoreButton}
              >
                {masterLoadingMore ? (
                  <>
                    <FiLoader className={styles.spinner} /> Loading...
                  </>
                ) : (
                  <>
                    Show more <FiChevronDown />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      );
    } else {
      // All patterns tab
      if (allPatternsError) {
        return (
          <div className={styles.errorContainer}>
            <NoRecordFound
              message="Unable to load all patterns. Please try again."
              icon={<FiBarChart2 />}
            />
            <button onClick={() => refetchAllPatterns()} className={styles.retryButton}>
              Retry
            </button>
          </div>
        );
      }
      const visiblePatterns = allPatterns.slice(0, allPatternsVisible);
      const hasMore = allPatternsVisible < totalPatternsCount;
      return (
        <>
          <div className={styles.allPatternsGrid}>
            {visiblePatterns.map((patternName) => (
              <AllPatternCard key={patternName} patternName={patternName} />
            ))}
          </div>
          {hasMore && (
            <div className={styles.loadMoreWrapper}>
              <button onClick={handleLoadMoreAllPatterns} className={styles.loadMoreButton}>
                Show more <FiChevronDown />
              </button>
            </div>
          )}
        </>
      );
    }
  };

  // ---------- Loading state for stats & hero (unchanged) ----------
  const isLoadingHero =
    (statsLoading && !stats) || (strongestLoading && !strongest) || (weakestLoading && !weakest);

  if (isLoadingHero && activeTab === 'master') {
    return (
      <div className={styles.container}>
        <div className={styles.statsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonLoader key={i} variant="custom" className={styles.statCardSkeleton} />
          ))}
        </div>
        <div className={styles.heroArea}>
          <SkeletonLoader variant="custom" className={styles.strongestCardSkeleton} />
          <SkeletonLoader variant="custom" className={styles.weakestCardSkeleton} />
        </div>
        <div className={styles.listHeader}>
          <SkeletonLoader variant="text" width={200} height={24} />
        </div>
        <div className={styles.patternList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} variant="custom" className={styles.patternRowSkeleton} />
          ))}
        </div>
      </div>
    );
  }

  // ---------- Main render ----------
  return (
    <div className={styles.container}>
      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard icon={<FiGrid />} value={totalPatternsStat} label="patterns" rotation="-0.5deg" />
        <StatCard icon={<FiCheckCircle />} value={totalSolvedCount} label="solved question" rotation="0.5deg" />
        <StatCard icon={<FiStar />} value={totalMasteredCount} label="mastered" rotation="-0.3deg" />
        <StatCard icon={<FiBarChart2 />} value={parseFloat(avgConfidence.toFixed(1))} label="avg confidence" rotation="0.3deg" />
      </div>

      {/* Hero Area */}
      <div className={styles.heroArea}>
        {strongest ? (
          <StrongestCard pattern={strongest} />
        ) : (
          <div className={styles.strongestCardPlaceholder}>
            <div className={styles.heroBadge}>
              <FiStar className={styles.badgeIcon} /> strongest pattern
            </div>
            <p>No patterns yet. Start solving problems to cultivate your first pattern!</p>
          </div>
        )}
        {weakest ? (
          <WeakestCard pattern={weakest} />
        ) : (
          <div className={styles.weakestCardPlaceholder}>
            <div className={styles.heroBadge}>
              <FiBarChart2 className={styles.badgeIcon} /> weakest pattern
            </div>
            <p>Solve more problems to discover your weak spots.</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'master' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('master')}
        >
          Attempted Pattern
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'all' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('all')}
        >
          All Patterns
        </button>
      </div>

      {/* List Header */}
      {renderListHeader()}

      {/* Content */}
      {allPatternsLoading && activeTab === 'all' ? (
        <div className={styles.allPatternsGrid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonLoader key={i} variant="custom" className={styles.allPatternSkeleton} />
          ))}
        </div>
      ) : (
        renderContent()
      )}
    </div>
  );
}