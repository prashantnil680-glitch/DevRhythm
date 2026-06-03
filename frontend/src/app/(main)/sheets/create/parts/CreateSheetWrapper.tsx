'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCreateSheet, useImportSheet } from '@/features/sheets';
import { ROUTES } from '@/shared/config';
import Tabs from '@/shared/components/Tabs';
import Button from '@/shared/components/Button';
import ManualTab from './ManualTab';
import ImportTab from './ImportTab';
import styles from './CreateSheetWrapper.module.css';

export function CreateSheetWrapper() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');

  const createMutation = useCreateSheet();
  const importMutation = useImportSheet();

  const handleManualSubmit = async (data: any) => {
    const result = await createMutation.mutateAsync(data);
    const slug = result?.sheet?.slug;
    if (slug) {
      router.push(ROUTES.SHEETS.DETAIL(slug));
    } else {
      router.push(ROUTES.SHEETS.ROOT);
    }
  };

  const handleImportSubmit = async (formData: FormData) => {
    const result = await importMutation.mutateAsync(formData);
    const slug = result?.sheet?.slug;
    if (slug) {
      router.push(ROUTES.SHEETS.DETAIL(slug));
    } else {
      router.push(ROUTES.SHEETS.ROOT);
    }
  };

  const handleCancel = () => {
    router.push(ROUTES.SHEETS.ROOT);
  };

  const isSubmitting = createMutation.isPending || importMutation.isPending;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Tabs
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'manual' | 'import')}
          tabs={[
            { id: 'manual', label: 'Manual' },
            { id: 'import', label: 'Import' },
          ]}
          className={styles.tabs}
        />
      </div>

      <div className={styles.content}>
        {activeTab === 'manual' && (
          <ManualTab
            onSubmit={handleManualSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            onSuccess={() => {}}
          />
        )}
        {activeTab === 'import' && (
          <ImportTab
            onSubmit={handleImportSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            onSuccess={() => {}}
          />
        )}
      </div>
    </div>
  );
}