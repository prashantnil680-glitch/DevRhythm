import React from 'react';
import { FiClock, FiSmile } from 'react-icons/fi';
import Card from '@/shared/components/Card';
import styles from './page.module.css';

export default function CreateGroupPage() {
  return (
    <div className={styles.container}>
      <Card className={styles.comingSoonCard}>
        <div className={styles.iconWrapper}>
          <FiClock className={styles.icon} />
          <FiSmile className={styles.iconSmile} />
        </div>
        <h1 className={styles.title}>Group Creation</h1>
        <p className={styles.message}>
          Building a space for collaboration – one commit at a time.
        </p>
        <p className={styles.subMessage}>
          I'm working hard to bring you group features. Expect clean interfaces,
          meaningful metrics, and maybe a few hidden easter eggs.
        </p>
        <div className={styles.divider} />
        <p className={styles.note}>⚡ Shipping soon. Stay tuned. ⚡</p>
      </Card>
    </div>
  );
}