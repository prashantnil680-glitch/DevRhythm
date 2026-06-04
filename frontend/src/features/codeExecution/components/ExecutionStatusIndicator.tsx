// frontend/src/features/codeExecution/components/ExecutionStatusIndicator.tsx

import React, { useEffect, useState } from 'react';
import { FiPackage, FiClock, FiLoader, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import styles from './ExecutionStatusIndicator.module.css';

export type ExecutionStatus =
  | 'idle'
  | 'queued'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

interface ExecutionStatusIndicatorProps {
  status: ExecutionStatus;
  onHide?: () => void;
  className?: string;
}

interface Step {
  id: ExecutionStatus;
  label: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  { id: 'queued', label: 'Queued', icon: <FiPackage /> },
  { id: 'pending', label: 'Pending', icon: <FiClock /> },
  { id: 'processing', label: 'Processing', icon: <FiLoader /> },
  { id: 'completed', label: 'Completed', icon: <FiCheckCircle /> },
];

const failedStep: Step = { id: 'failed', label: 'Failed', icon: <FiXCircle /> };

export const ExecutionStatusIndicator: React.FC<ExecutionStatusIndicatorProps> = ({
  status,
  onHide,
  className = '',
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status === 'completed' || status === 'failed') {
      const delay = status === 'completed' ? 1000 : 2000;
      const timer = setTimeout(() => {
        setVisible(false);
        onHide?.();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [status, onHide]);

  if (!visible || status === 'idle') return null;

  const isFailed = status === 'failed';
  const activeIndex = steps.findIndex(s => s.id === status);

  return (
    <div className={`${styles.container} ${className}`}>
      {steps.map((step, idx) => {
        const isActive = idx === activeIndex && !isFailed;
        const isPast = idx < activeIndex && !isFailed;
        const isFuture = idx > activeIndex && !isFailed;
        let stepClass = styles.step;
        if (isFailed) stepClass = styles.step;
        else if (isActive) stepClass = `${styles.step} ${styles.activeStep}`;
        else if (isPast) stepClass = `${styles.step} ${styles.completedStep}`;
        else if (isFuture) stepClass = `${styles.step} ${styles.futureStep}`;

        const icon = isPast ? <FiCheckCircle /> : step.icon;

        return (
          <React.Fragment key={step.id}>
            <div className={stepClass}>
              <span className={styles.icon}>{icon}</span>
              <span className={styles.label}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <span className={styles.arrow}>→</span>
            )}
          </React.Fragment>
        );
      })}
      {/* Show Failed step if status is failed */}
      {isFailed && (
        <>
          {steps.length > 0 && <span className={styles.arrow}>→</span>}
          <div className={`${styles.step} ${styles.failedStep}`}>
            <span className={styles.icon}>{failedStep.icon}</span>
            <span className={styles.label}>{failedStep.label}</span>
          </div>
        </>
      )}
    </div>
  );
};