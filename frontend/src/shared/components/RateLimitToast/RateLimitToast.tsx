// src/shared/components/RateLimitToast/RateLimitToast.tsx

'use client';

import React from 'react';
import { toast as hotToast } from '@/shared/components/Toast';
import Button from '@/shared/components/Button';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

export interface RateLimitToastProps {
  /** The ID of the toast instance (used to dismiss it programmatically) */
  toastId: string;
  /** The number of seconds remaining in the cooldown */
  remainingTime: number;
  /** Callback to retry the original request */
  onRetry: () => void;
  /** Callback to dismiss the toast and clear the rate‑limit state */
  onDismiss: () => void;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * Renders the toast content for rate‑limit notifications.
 * This is a presentational component – all data is passed via props.
 */
export const RateLimitToast: React.FC<RateLimitToastProps> = ({
  toastId,
  remainingTime,
  onRetry,
  onDismiss,
  className = '',
}) => {
  const handleRetry = () => {
    // Dismiss the toast immediately, then retry
    hotToast.dismiss(toastId);
    onRetry();
  };

  const handleDismiss = () => {
    hotToast.dismiss(toastId);
    onDismiss();
  };

  const isRetryDisabled = remainingTime > 0;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '1rem 1rem 1rem 1.25rem',
        borderRadius: 'var(--radius, 6px)',
        backgroundColor: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
        fontSize: '0.95rem',
        lineHeight: '1.5',
        boxShadow: '0 4px 12px var(--shadow)',
        maxWidth: '420px',
        width: '100%',
        borderLeft: '4px solid var(--toast-warning)',
        pointerEvents: 'auto',
      }}
    >
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          fontSize: '1.25rem',
          color: 'var(--toast-warning)',
        }}
      >
        <FaExclamationTriangle />
      </div>

      {/* Message with countdown */}
      <div style={{ flex: 1 }}>
        <span>
          Too many requests. Please wait{' '}
          <strong>{remainingTime}s</strong> before trying again.
        </span>
      </div>

      {/* Retry button – disabled during countdown */}
      <Button
        variant="primary"
        size="sm"
        onClick={handleRetry}
        disabled={isRetryDisabled}
      >
        Retry
      </Button>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.25rem',
          lineHeight: '1',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '0.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.backgroundColor = 'var(--hover-surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label="Dismiss notification"
      >
        <FaTimes />
      </button>
    </div>
  );
};

export default RateLimitToast;