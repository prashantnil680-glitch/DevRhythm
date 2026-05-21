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

  // console.log("=================: questions", questions);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recently Solved Questions</h3>
      </div>
      <div className={styles.timeline}>
        {questions.map((q, idx) => (
          <div key={idx} className={styles.item}>
            <div className={`${styles.node} ${styles.nodeGlow}`} />
            <div className={styles.date}>{formatDateForDisplay(new Date(q.solvedAt))}</div>
            <div className={styles.titleLine}>
              <span className={styles.connector}>╰─</span>
              <Link
                href={`/questions/${q.platformQuestionId || q.questionId}`}
                className={styles.titleLink}
              >
                {q.title}
              </Link>
              <span className={styles.status}>{q.status}</span>
            </div>
            <div className={styles.meta}>
              <span className={`${styles.difficulty} ${styles[q.difficulty.toLowerCase()]}`}>
                {q.difficulty}
              </span>
              <span className={styles.platform}>
                <PlatformIcon platform={q.platform} size="sm" />
                <span>{q.platform}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}