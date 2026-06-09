import { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config';
import Link from 'next/link';
import GoalCreateForm from './parts/GoalCreateForm';
import GoalCreateSkeleton from './parts/GoalCreateSkeleton';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';

export const metadata: Metadata = {
  title: 'Create New Goal | DevRhythm',
  description: 'Set a new daily, weekly, or planned coding goal. Define target questions and deadlines to stay on track.',
  robots: 'noindex, follow',
  alternates: {
    canonical: `${APP_URL}/goals/create`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Goals', href: ROUTES.GOALS.ROOT },
  { label: 'Create' },
];

export default function GoalCreatePage() {
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
      <Suspense fallback={<GoalCreateSkeleton />}>
        <GoalCreateForm />
      </Suspense>
    </>
  );
}