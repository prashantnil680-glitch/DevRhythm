import Link from 'next/link';
import { FiGrid } from 'react-icons/fi';
import NoRecordFound from '@/shared/components/NoRecordFound';
import Tooltip from '@/shared/components/Tooltip';
import { slugify } from '@/shared/lib/stringUtils';
import type { PatternMastery } from '@/shared/types';
import styles from './OtherPatternsList.module.css';

interface OtherPatternsListProps {
  patterns: PatternMastery[];
  currentPatternName: string;
}

export default function OtherPatternsList({ patterns, currentPatternName }: OtherPatternsListProps) {
  if (!patterns.length) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Other Patterns</h3>
          <Link href="/patterns" className={styles.viewAll}>
            View all patterns →
          </Link>
        </div>
        <NoRecordFound
          message="No other patterns available yet. Keep solving to discover more!"
          icon={<FiGrid size={48} />}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Other Patterns</h3>
        <Link href="/patterns" className={styles.viewAll}>
          View all patterns →
        </Link>
      </div>
      <div className={styles.list}>
        {patterns.map((pattern) => {
          const mastery = pattern.masteryRate || 0;
          const solved = pattern.solvedCount || 0;
          const slug = slugify(pattern.patternName);
          return (
            <Link key={pattern._id} href={`/patterns/${slug}`} className={styles.rowLink}>
              <div className={styles.row}>
                <span className={styles.patternName}>{pattern.patternName}</span>
                <div className={styles.progressWrapper}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${mastery}%` }} />
                  </div>
                  <Tooltip content={`Mastery: ${Math.round(mastery)}%`}>
                    <span className={styles.percentage}>
                      {solved} solved
                    </span>
                  </Tooltip>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}