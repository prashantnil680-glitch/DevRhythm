import React, { memo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import Tooltip from '@/shared/components/Tooltip';
import styles from './HeatmapCell.module.css';

export interface HeatmapCellProps {
  /** The date of this cell (as a Date object or ISO string) */
  date: Date | string;
  /** Number of activities (problems solved) on this day */
  count: number;
  /** Intensity level (0–4) that determines the cell colour */
  intensity: 0 | 1 | 2 | 3 | 4;
  /** Optional pre‑formatted tooltip content (if not provided, a default is generated) */
  tooltipContent?: string;
  /** Optional click handler (if not provided, the cell becomes a link to /activity/YYYY-MM-DD) */
  onClick?: () => void;
  /** Additional CSS class for the cell wrapper */
  className?: string;
}

/**
 * A single square cell in the heatmap.
 * The colour intensity reflects the activity count.
 * On hover, a tooltip shows the date and the number of problems solved.
 * If no custom onClick is provided, the cell becomes a clickable link to the activity page for that date.
 */
const HeatmapCell: React.FC<HeatmapCellProps> = ({
  date,
  count,
  intensity,
  tooltipContent,
  onClick,
  className,
}) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Format date string as YYYY-MM-DD for the link
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const datePath = `${year}-${month}-${day}`;

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const tooltip = tooltipContent || `${count} ${count === 1 ? 'problem' : 'problems'} solved on ${formattedDate}`;

  // Determine tooltip placement to avoid clipping at the top/bottom edges
  const dayOfWeek = dateObj.getUTCDay(); // 0 = Sunday, 6 = Saturday
  let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  if (dayOfWeek === 0) {
    placement = 'bottom'; // top row → show below
  } else if (dayOfWeek === 6) {
    placement = 'top'; // bottom row → show above (though 'top' is already default)
  }

  const cellElement = (
    <button
      className={clsx(styles.cell, styles[`level${intensity}`])}
      onClick={onClick}
      aria-label={tooltip}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    />
  );

  const content = (
    <Tooltip
      content={tooltip}
      placement={placement}
      className={clsx(styles.cellWrapper, className)}
    >
      {onClick ? (
        cellElement
      ) : (
        <Link href={`/activity/${datePath}`} style={{ display: 'block' }}>
          <div className={styles.cellWrapper}>
            <div
              className={clsx(styles.cell, styles[`level${intensity}`])}
              aria-label={tooltip}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </Link>
      )}
    </Tooltip>
  );

  // To avoid double wrapping when there's no onClick, we already wrapped inside Tooltip.
  // But when onClick exists, Tooltip wraps the button directly.
  return content;
};

export default memo(HeatmapCell);