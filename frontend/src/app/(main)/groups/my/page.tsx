import React from 'react';
import { FiUsers, FiCoffee } from 'react-icons/fi';
import Card from '@/shared/components/Card';
import styles from './page.module.css';

export default function MyGroupsPage() {
  return (
    <div className={styles.container}>
      <Card className={styles.comingSoonCard}>
        <div className={styles.iconWrapper}>
          <FiUsers className={styles.icon} />
          <FiCoffee className={styles.iconCoffee} />
        </div>
        <h1 className={styles.title}>My Groups</h1>
        <p className={styles.message}>
          Your personal groups dashboard is under construction.
        </p>
        <p className={styles.subMessage}>
          I'm refining the experience – think progress tracking, shared goals,
          and a sprinkle of friendly competition. Should be worth the wait.
        </p>
        <div className={styles.divider} />
        <p className={styles.note}>☕ Brewing. Launching soon. ☕</p>
      </Card>
    </div>
  );
}