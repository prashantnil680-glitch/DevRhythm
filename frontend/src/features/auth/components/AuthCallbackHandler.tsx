'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tokenStorage } from '../utils/tokenStorage';
import { useSession } from '../hooks/useSession';
import apiClient from '@/shared/lib/apiClient';
import { isPublicPath } from '@/shared/lib/publicPaths';
import styles from './AuthCallbackHandler.module.css';

const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

const updateUserTimezone = async (token: string, timezone: string) => {
  try {
    await apiClient.put(
      '/users/me/timezone',
      { newTimezone: timezone, confirm: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    console.warn('Failed to update timezone:', error);
  }
};

export const AuthCallbackHandler: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setIsLoading(false);
      const currentPath = window.location.pathname;
      if (!isPublicPath(currentPath)) {
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setTimeout(() => router.push('/'), 3000);
      }
      return;
    }

    if (!code) {
      setError('No authentication code provided');
      setIsLoading(false);
      const currentPath = window.location.pathname;
      if (!isPublicPath(currentPath)) {
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setTimeout(() => router.push('/'), 3000);
      }
      return;
    }

    apiClient
      .post('/auth/exchange', { code })
      .then(async (response) => {
        const { token, refreshToken, userId, showWelcome, showWelcomeBack } =
          response.data;
        tokenStorage.setTokens(token, refreshToken, userId);

        if (showWelcome === true) {
          sessionStorage.setItem('showWelcome', 'true');
        }
        if (showWelcomeBack === true) {
          sessionStorage.setItem('showWelcomeBack', 'true');
        }

        const detectedTz = getBrowserTimezone();
        if (detectedTz === 'Asia/Kolkata' || detectedTz === 'Asia/Calcutta') {
          updateUserTimezone(token, 'Asia/Kolkata');
        }

        await refetch();

        const returnTo = localStorage.getItem('returnTo');
        if (returnTo && returnTo !== '/login' && returnTo !== '/') {
          localStorage.removeItem('returnTo');
          router.push(returnTo);
        } else {
          localStorage.removeItem('returnTo');
          router.push('/dashboard');
        }
      })
      .catch((err) => {
        console.error('Code exchange error:', err);
        setError(err.message || 'Authentication failed');
        setIsLoading(false);
        const currentPath = window.location.pathname;
        if (!isPublicPath(currentPath)) {
          setTimeout(() => router.push('/login'), 3000);
        } else {
          setTimeout(() => router.push('/'), 3000);
        }
      });
  }, [searchParams, router, refetch]);

  if (error) {
    return (
      <div className={styles.error}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className={styles.loading}>
      <div className={styles.brandText}>DevRhythm</div>
      <div className={styles.subText}>
        <span>Almost there</span>
        <span className={styles.dots}>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  );
};