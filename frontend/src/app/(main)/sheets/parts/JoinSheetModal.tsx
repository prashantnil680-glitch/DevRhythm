'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from '@/shared/components/Toast';
import Modal from '@/shared/components/Modal';
import Button from '@/shared/components/Button';
import DatePicker from '@/shared/components/DatePicker';
import styles from './JoinSheetModal.module.css';

interface JoinSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetDate: string) => void;
  isLoading: boolean;
}

export default function JoinSheetModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: JoinSheetModalProps) {
  const [targetDate, setTargetDate] = useState<Date | null>(null);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  tomorrow.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (isOpen) {
      setTargetDate(null);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!targetDate) {
      toast.error('Please select a target date');
      return;
    }
    if (targetDate < tomorrow) {
      toast.error('Target date must be tomorrow or later');
      return;
    }
    onConfirm(format(targetDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
  };

  const handleClose = () => {
    setTargetDate(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Join Sheet"
      size="sm"
      closeOnBackdropClick
      closeOnEsc
      showCloseButton
    >
      <div className={styles.modalContent}>
        <p className={styles.description}>
          Set your target completion date for this sheet. This will help you track your progress.
        </p>
        <div className={styles.dateField}>
          <label htmlFor="targetDate" className={styles.label}>
            Target Date *
          </label>
          <DatePicker
            selected={targetDate}
            onChange={(date: Date | null) => setTargetDate(date)}
            placeholder="Select a future date"
            minDate={tomorrow}
            dateFormat="yyyy-MM-dd"
            id="targetDate"
          />
        </div>
        <div className={styles.actions}>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} isLoading={isLoading}>
            Join Sheet
          </Button>
        </div>
      </div>
    </Modal>
  );
}