'use client';

import { useState, useEffect } from 'react';
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
  const searchParams = useSearchParams();

  // Read tab from URL query parameter
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'import' ? 'import' : 'manual';
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>(initialTab);

  const createMutation = useCreateSheet();
  const importMutation = useImportSheet();

  // Update URL when activeTab changes, but only if the URL doesn't already match
  useEffect(() => {
    const currentSearch = window.location.search;
    const params = new URLSearchParams(currentSearch);
    if (activeTab === 'manual') {
      params.delete('tab');
    } else {
      params.set('tab', activeTab);
    }
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
    // Only replace if the URL would actually change
    if (newUrl !== window.location.href) {
      router.replace(newUrl, { scroll: false });
    }
  }, [activeTab, router]);

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