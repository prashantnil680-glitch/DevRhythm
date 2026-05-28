'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tokenStorage } from '../utils/tokenStorage';
import { useSession } from '../hooks/useSession';
import apiClient from '@/shared/lib/apiClient';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import styles from './AuthCallbackHandler.module.css';

// Helper to detect browser timezone
const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

// Helper to update user's timezone on backend
const updateUserTimezone = async (token: string, timezone: string) => {
  try {
    await apiClient.put(
      '/users/me/timezone',
      { newTimezone: timezone, confirm: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // console.log(`Timezone updated to: ${timezone}`);
  } catch (error) {
    // Silently fail – timezone update is not critical for login
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
      setTimeout(() => router.push('/login'), 3000);
      return;
    }

    if (!code) {
      setError('No authentication code provided');
      setIsLoading(false);
      setTimeout(() => router.push('/login'), 3000);
      return;
    }

    // Exchange code for tokens
    apiClient.post('/auth/exchange', { code })
      .then(async (response) => {
        const { token, refreshToken, userId } = response.data;
        tokenStorage.setTokens(token, refreshToken, userId);

        // Detect browser timezone and update backend (asynchronously)
        const detectedTz = getBrowserTimezone();
        // Only set timezone to Asia/Kolkata for Indian users
        if (detectedTz === 'Asia/Kolkata' || detectedTz === 'Asia/Calcutta') {
          updateUserTimezone(token, 'Asia/Kolkata');
        }

        // Trigger background refetch of user data
        await refetch();

        // Redirect immediately
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
        setTimeout(() => router.push('/login'), 3000);
      });
  }, [searchParams, router, refetch]);

  if (error) {
    return (
      <div className={styles.error}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className={styles.loading}>
      <SkeletonLoader variant="card" width={300} height={120} />
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
        Completing authentication...
      </p>
    </div>
  );
};