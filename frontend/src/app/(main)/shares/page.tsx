import React from 'react';
import { FiShare2, FiCompass } from 'react-icons/fi';
import Card from '@/shared/components/Card';
import styles from './page.module.css';

export default function SharesPage() {
  return (
    <div className={styles.container}>
      <Card className={styles.comingSoonCard}>
        <div className={styles.iconWrapper}>
          <FiShare2 className={styles.icon} />
          <FiCompass className={styles.iconCompass} />
        </div>
        <h1 className={styles.title}>Shared Insights</h1>
        <p className={styles.message}>
          Show off your progress – or keep it private. Your call.
        </p>
        <p className={styles.subMessage}>
          I'm building a way for you to share your journey: solved problems, patterns mastered, streaks achieved.  
          Choose what to show, generate links, and inspire (or compete with) others.
        </p>
        <div className={styles.divider} />
        <p className={styles.note}>🌀 Sharing. Soon. 🌀</p>
      </Card>
    </div>
  );
}