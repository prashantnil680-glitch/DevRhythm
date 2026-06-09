import { Suspense } from 'react';
import { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config';
import { CreateSheetWrapper } from './parts/CreateSheetWrapper';
import CreateSheetSkeleton from './parts/CreateSheetSkeleton';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';

export const metadata: Metadata = {
  title: 'Create Sheet · DevRhythm',
  description: 'Create a new curated sheet of coding problems. Add questions manually or import from a file.',
  robots: 'noindex, follow',
  alternates: {
    canonical: `${APP_URL}/sheets/create`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: ROUTES.DASHBOARD },
  { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
  { label: 'Create Sheet' },
];

export default function CreateSheetPage() {
  return (
    <>
      <Breadcrumb
        items={breadcrumbItems}
        renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>
            {props.children}
          </Link>
        )}
      />
      <Suspense fallback={<CreateSheetSkeleton />}>
        <CreateSheetWrapper />
      </Suspense>
    </>
  );
}