'use client';

import { useState, useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import { Avatar } from '@/shared/components/Avatar';
import { useUser } from '@/features/user';
import apiClient from '@/shared/lib/apiClient';
import styles from './WelcomeBanner.module.css';

interface WelcomeBannerProps {
  type: 'welcome' | 'welcomeBack';
  totalUsers: number;
  onDismiss: () => void;
}

const BANNER_AUTO_CLOSE_MS = 16500;

export default function WelcomeBanner({ type, totalUsers, onDismiss }: WelcomeBannerProps) {
  const { user } = useUser();
  const [isVisible, setIsVisible] = useState(true);
  const isClosingRef = useRef(false); // prevents double execution
  const displayName = user?.displayName || user?.username || 'there';

  const handleClose = async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    setIsVisible(false);

    try {
      if (type === 'welcome') {
        await apiClient.post('/users/welcome-shown');
      } else {
        await apiClient.post('/users/welcome-back-shown');
      }
    } catch (err) {
      console.error('Failed to record welcome shown:', err);
    }

    onDismiss();
  };

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      handleClose();
    }, BANNER_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [isVisible]); // only depends on isVisible, no handleClose dependency

  if (!isVisible) return null;

  const isFirstTime = type === 'welcome';

  return (
    <div className={styles.banner}>
      <button className={styles.closeButton} onClick={handleClose} aria-label="Dismiss">
        <FiX />
      </button>
      <div className={styles.avatarWrapper}>
        <Avatar src={user?.avatarUrl} name={displayName} size="lg" className={styles.avatar} />
      </div>
      <div className={styles.content}>
        {isFirstTime ? (
          <>
            <h2 className={styles.title}>Welcome to DevRhythm, {displayName}!</h2>
            <p className={styles.message}>
              You're joining a community of <strong>{totalUsers.toLocaleString()}</strong> developers who are building consistency, solving problems, and growing their skills every day.
            </p>
            <p className={styles.submessage}>
              Every solved problem, completed revision, and focused study session compounds over time.
              Start building momentum today.
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Welcome back, {displayName}.</h2>
            <p className={styles.message}>
              Your progress is already underway. Pick up where you left off, stay consistent, and continue building momentum toward your goals.
            </p>
          </>
        )}
      </div>
    </div>
  );
}