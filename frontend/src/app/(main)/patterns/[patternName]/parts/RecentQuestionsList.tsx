import Link from 'next/link';
import { FiBookOpen } from 'react-icons/fi';
import PlatformIcon from '@/shared/components/PlatformIcon';
import NoRecordFound from '@/shared/components/NoRecordFound';
import { formatDateForDisplay } from '@/shared/lib/dateUtils';
import styles from './RecentQuestionsList.module.css';

interface RecentQuestion {
  questionId: string;
  title: string;
  platform: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  solvedAt: string;
  status: 'Solved' | 'Mastered';
  platformQuestionId?: string;
}

interface RecentQuestionsListProps {
  questions: RecentQuestion[];
}

export default function RecentQuestionsList({ questions }: RecentQuestionsListProps) {
  if (!questions.length) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Recently Solved Questions</h3>
        </div>
        <NoRecordFound
          message="No solved questions yet for this pattern. Start solving to see your progress here."
          icon={<FiBookOpen size={48} />}
        />
      </div>
    );
  }

  // Format date for activity link (YYYY-MM-DD)
  const formatDateForLink = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recently Solved Questions</h3>
      </div>
      <div className={styles.timeline}>
        {questions.map((q, idx) => {
          const isLast = idx === questions.length - 1;
          const activityDate = formatDateForLink(q.solvedAt);
          const difficultyParam = q.difficulty.toLowerCase();
          const platformParam = encodeURIComponent(q.platform);

          return (
            <div key={idx} className={styles.questionItem}>
              {/* Left column: node dot + vertical line */}
              <div className={styles.leftColumn}>
                <div className={styles.nodeDot} />
                {!isLast && <div className={styles.verticalLine} />}
              </div>

              {/* Right column: title row + branch row */}
              <div className={styles.rightColumn}>
                {/* Title row: title + status badge */}
                <div className={styles.titleRow}>
                  <Link
                    href={`/questions/${q.platformQuestionId || q.questionId}`}
                    className={styles.titleLink}
                  >
                    {q.title}
                  </Link>
                  <span className={styles.statusBadge}>{q.status}</span>
                </div>

                {/* Branch row: difficulty, platform, date with links */}
                <div className={styles.branchRow}>
                  <span className={styles.branchSymbol}>╰─</span>
                  <div className={styles.branchContent}>
                    <Link
                      href={`/questions?difficulty=${difficultyParam}&page=1`}
                      className={`${styles.difficulty} ${styles[q.difficulty.toLowerCase()]}`}
                    >
                      {q.difficulty}
                    </Link>
                    <Link
                      href={`/questions?platform=${platformParam}&page=1`}
                      className={styles.platformLink}
                    >
                      <PlatformIcon platform={q.platform} size="sm" />
                      {q.platform}
                    </Link>
                    {activityDate && (
                      <Link
                        href={`/activity/${activityDate}`}
                        className={styles.dateLink}
                      >
                        {formatDateForDisplay(new Date(q.solvedAt))}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}