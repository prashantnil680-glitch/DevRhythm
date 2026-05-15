import React from 'react';
import {
  SiLeetcode,
  SiHackerrank,
  SiCodeforces,
  SiGeeksforgeeks,
} from 'react-icons/si';
import { FaCode } from 'react-icons/fa';
import clsx from 'clsx';
import styles from './PlatformIcon.module.css';

export interface PlatformIconProps {
  platform: string;
  size?: 'sm' | 'md' | 'lg' | number;
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

const platformIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  leetcode: SiLeetcode,
  hackerrank: SiHackerrank,
  codeforces: SiCodeforces,
  geeksforgeeks: SiGeeksforgeeks,
};

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  size = 'md',
  className,
}) => {
  // Guard against undefined/null/empty platform
  const safePlatform = platform?.trim() || '';
  const normalizedPlatform = safePlatform ? safePlatform.toLowerCase().replace(/\s+/g, '') : '';
  const IconComponent = normalizedPlatform && platformIcons[normalizedPlatform] ? platformIcons[normalizedPlatform] : FaCode;

  const iconSize = typeof size === 'number' ? size : sizeMap[size];

  return (
    <span
      className={clsx(styles.iconWrapper, className)}
      aria-label={`${safePlatform || 'unknown'} icon`}
      role="img"
    >
      <IconComponent size={iconSize} className={styles.icon} />
    </span>
  );
};

export default PlatformIcon;