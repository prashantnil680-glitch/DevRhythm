'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCreateSheet, useImportSheet } from '@/features/sheets';
import { ROUTES } from '@/shared/config';
import Tabs from '@/shared/components/Tabs';
import Button from '@/shared/components/Button';
import Modal from '@/shared/components/Modal';
import ManualTab from './ManualTab';
import ImportTab from './ImportTab';
import styles from './CreateSheetWrapper.module.css';

interface CreateSheetWrapperProps {
  isAuthenticated: boolean;
}

export function CreateSheetWrapper({ isAuthenticated }: CreateSheetWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authModalOpen, setAuthModalOpen] = useState(!isAuthenticated);

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

  const handleLoginRedirect = () => {
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?returnTo=${returnTo}`;
  };

  // If not authenticated, show a modal overlay
  if (!isAuthenticated) {
    return (
      <>
        <div className={styles.container} style={{ opacity: 0.5, pointerEvents: 'none' }}>
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
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading form...
            </div>
          </div>
        </div>
        <Modal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          title="Authentication Required"
          size="sm"
          closeOnBackdropClick={false}
          closeOnEsc={false}
          showCloseButton={false}
        >
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p>You need to be logged in to create a sheet.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Button variant="outline" onClick={() => router.push(ROUTES.SHEETS.ROOT)}>
                Go to Sheets
              </Button>
              <Button variant="primary" onClick={handleLoginRedirect}>
                Log In
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

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