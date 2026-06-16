'use client';

import React, { useState, forwardRef } from "react";
import Image from "next/image";
import { FaUser } from "react-icons/fa";
import clsx from "clsx";
import { extractInitials } from "@/shared/lib";
import styles from "./Avatar.module.css";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "busy";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  badge?: React.ReactNode;
  ring?: boolean;
  className?: string;
  priority?: boolean; // NEW: whether to prioritise loading this image
}

const sizeMap = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 96,
};

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = "md",
      status,
      badge,
      ring = false,
      className,
      priority = false,
      ...rest
    },
    ref
  ) => {
    const [imgError, setImgError] = useState(false);

    const shouldShowImage = src && !imgError;

    let fallbackContent: React.ReactNode;
    if (name) {
      fallbackContent = <span className={styles.initials}>{extractInitials(name)}</span>;
    } else {
      fallbackContent = <FaUser className={styles.defaultIcon} />;
    }

    const statusLabel = status
      ? {
          online: "Online",
          offline: "Offline",
          busy: "Do not disturb",
        }[status]
      : undefined;

    const badgeProps = badge
      ? {
          role: typeof badge === "number" ? "status" : undefined,
          "aria-label": typeof badge === "number" ? `${badge} notifications` : undefined,
        }
      : {};

    return (
      <div
        ref={ref}
        className={clsx(
          styles.avatar,
          styles[size],
          ring && styles.ring,
          className
        )}
        {...rest}
      >
        {shouldShowImage ? (
          <Image
            src={src}
            alt={alt || name || "Avatar"}
            onError={() => setImgError(true)}
            className={styles.image}
            width={sizeMap[size]}
            height={sizeMap[size]}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            priority={priority}
          />
        ) : (
          <div className={styles.fallback}>{fallbackContent}</div>
        )}

        {status && (
          <span
            className={clsx(styles.status, styles[`status-${status}`])}
            aria-label={statusLabel}
          />
        )}

        {badge && (
          <span className={styles.badge} {...badgeProps}>
            {badge}
          </span>
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";

export default Avatar;

// AvatarGroup unchanged
export interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  max,
  size = "md",
  className,
}) => {
  const childrenArray = React.Children.toArray(children);
  const visibleChildren = max ? childrenArray.slice(0, max) : childrenArray;
  const extraCount = max ? childrenArray.length - max : 0;

  return (
    <div className={clsx(styles.avatarGroup, className)}>
      {visibleChildren}
      {extraCount > 0 && (
        <div className={clsx(styles.avatar, styles[size], styles.extraCount)}>
          +{extraCount}
        </div>
      )}
    </div>
  );
};