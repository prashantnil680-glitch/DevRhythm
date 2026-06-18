'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useSheet, useUpdateSheet } from '@/features/sheets';
import { ROUTES } from '@/shared/config';
import Breadcrumb from '@/shared/components/Breadcrumb';
import Button from '@/shared/components/Button';
import ManualTab from '../../create/parts/ManualTab';
import EditSheetSkeleton from './parts/EditSheetSkeleton';
import styles from './page.module.css';

export default function EditSheetPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [originalSlug] = useState(slug);

  const { data: sheetData, isLoading, error } = useSheet(originalSlug);
  const updateMutation = useUpdateSheet();

  const draftKey = `sheet_edit_draft_${originalSlug}`;

  const handleSubmit = async (formData: {
    name: string;
    description: string;
    questions: string[];
    specialTag?: string;
    originalSourceName?: string;
    originalSourceUrl?: string;
  }) => {
    const { name, description, questions, specialTag, originalSourceName, originalSourceUrl } = formData;
    const result = await updateMutation.mutateAsync({
      slug: originalSlug,
      updates: {
        name,
        description,
        questions,
        specialTag,
        originalSourceName,
        originalSourceUrl,
      },
    });
    localStorage.removeItem(draftKey);
    const newSlug = result?.sheet?.slug || originalSlug;
    router.push(ROUTES.SHEETS.DETAIL(newSlug));
  };

  if (isLoading) {
    return <EditSheetSkeleton />;
  }

  if (error || !sheetData) {
    return (
      <div className={styles.errorContainer}>
        <p>Sheet not found or you don't have permission to edit it.</p>
        <Button variant="outline" onClick={() => router.push(ROUTES.SHEETS.ROOT)}>
          Back to Sheets
        </Button>
      </div>
    );
  }

  const { sheet, currentUserProgress, questions } = sheetData;

  const initialData = {
    name: sheet.name,
    description: sheet.description || '',
    targetDate: currentUserProgress?.targetDate || null,
    specialTag: sheet.specialTag || '',
    originalSourceName: sheet.originalSourceName || '',
    originalSourceUrl: sheet.originalSourceUrl || '',
    selectedQuestions: (questions || []).map((q: any) => ({
      id: q._id,
      title: q.title,
    })),
  };

  const breadcrumbItems = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
    { label: sheet.name, href: ROUTES.SHEETS.DETAIL(originalSlug) },
    { label: 'Edit' },
  ];

  const renderLink = (item: any, props: any) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  };

  return (
    <div className={styles.container}>
      <Breadcrumb items={breadcrumbItems} renderLink={renderLink} />

      <div className={styles.header}>
        <h1 className={styles.title}>Edit Sheet</h1>
        <Button variant="outline" onClick={() => router.push(ROUTES.SHEETS.DETAIL(originalSlug))}>
          Cancel
        </Button>
      </div>

      <ManualTab
        initialData={initialData}
        onSuccess={() => {}}
        onSubmit={handleSubmit}
        onCancel={() => router.push(ROUTES.SHEETS.DETAIL(originalSlug))}
        isSubmitting={updateMutation.isPending}
        submitButtonText="Update Sheet"
        hideTargetDate={true}
        disableDraftSaving={false}
        draftKey={draftKey}
        mode="edit"
      />
    </div>
  );
}