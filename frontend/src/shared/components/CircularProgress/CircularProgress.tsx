'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CircularProgress.module.css';

interface CircularProgressProps {
  /** Progress percentage (0–100) */
  progress: number;
  /** Size in pixels (width and height) */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Color of the progress stroke (CSS variable or direct color) */
  progressColor?: string;
  /** Color of the background stroke */
  backgroundColor?: string;
  /** Children to display inside the circle (e.g., percentage text) */
  children?: React.ReactNode;
  /** Animate on mount (default: true) */
  animate?: boolean;
  /** Re‑animate the progress ring on hover (like DifficultyRing) */
  hoverAnimate?: boolean;
}

export default function CircularProgress({
  progress,
  size = 80,
  strokeWidth = 6,
  progressColor = 'var(--accent-moss)',
  backgroundColor = 'var(--border)',
  children,
  animate = true,
  hoverAnimate = true,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const circleRef = useRef<SVGCircleElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers‑reduced‑motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Animate on mount (if animate=true)
  useEffect(() => {
    if (!animate || reducedMotion) return;
    if (circleRef.current) {
      // Reset to full circle
      circleRef.current.style.transition = 'none';
      circleRef.current.style.strokeDashoffset = String(circumference);
      // Force reflow
      circleRef.current.getBoundingClientRect();
      // Animate to target offset
      circleRef.current.style.transition = 'stroke-dashoffset 0.6s ease-out';
      circleRef.current.style.strokeDashoffset = String(offset);
    }
  }, [offset, circumference, animate, reducedMotion]);

  // Hover animation (replay)
  const handleMouseEnter = () => {
    if (reducedMotion || !hoverAnimate) return;
    if (circleRef.current) {
      // Remove existing transition temporarily
      circleRef.current.style.transition = 'none';
      circleRef.current.style.strokeDashoffset = String(circumference);
      // Force reflow
      circleRef.current.getBoundingClientRect();
      // Animate to target offset
      circleRef.current.style.transition = 'stroke-dashoffset 0.6s ease-out';
      circleRef.current.style.strokeDashoffset = String(offset);
    }
  };

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={styles.container}
      style={{ width: size, height: size }}
      onMouseEnter={handleMouseEnter}
    >
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          className={styles.background}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          ref={circleRef}
          className={styles.progress}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate && !reducedMotion ? circumference : offset}
        />
      </svg>
      <div className={styles.content}>{children}</div>
    </div>
  );
}