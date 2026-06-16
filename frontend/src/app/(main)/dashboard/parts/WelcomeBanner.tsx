'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { FiX } from 'react-icons/fi';
import { Avatar } from '@/shared/components/Avatar';
import { useSession } from '@/features/auth/hooks/useSession';
import apiClient from '@/shared/lib/apiClient';
import styles from './WelcomeBanner.module.css';

interface WelcomeBannerProps {
  type: 'welcome' | 'welcomeBack';
  totalUsers: number;
  onDismiss: () => void;
}

const BANNER_AUTO_CLOSE_MS = 16500;

function WelcomeBanner({ type, totalUsers, onDismiss }: WelcomeBannerProps) {
  const { user } = useSession();
  const [isVisible, setIsVisible] = useState(true);
  const isClosingRef = useRef(false);
  const displayName = user?.displayName || user?.username || 'there';

  const handleClose = useCallback(async () => {
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
  }, [type, onDismiss]);

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      handleClose();
    }, BANNER_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [isVisible, handleClose]);

  const isFirstTime = type === 'welcome';

  return (
    <div className={styles.bannerWrapper}>
      {isVisible ? (
        <div className={styles.banner}>
          <button className={styles.closeButton} onClick={handleClose} aria-label="Dismiss">
            <FiX />
          </button>
          <div className={styles.avatarWrapper}>
            <Avatar
              src={user?.avatarUrl}
              name={displayName}
              size="lg"
              className={styles.avatar}
              priority={true}
            />
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
      ) : (
        <div className={styles.bannerPlaceholder} aria-hidden="true" />
      )}
    </div>
  );
}

export default memo(WelcomeBanner);